import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  encryptMfaSecret,
  decryptMfaSecret,
} from '../lib/crypto'
import { logger } from '../lib/logger'
import { redis } from '../lib/redis'
import { LoginSchema, MfaVerifySchema } from '@shieldiq/shared'
import * as OTPAuth from 'otpauth'

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours
const MAX_FAILED = 10
const LOCKOUT_MINUTES = 15

async function incrementFailedAttempts(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { failedAttempts: true } })
  if (!user) return
  const next = (user.failedAttempts ?? 0) + 1
  const lockedUntil =
    next >= MAX_FAILED ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : undefined
  await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: next, ...(lockedUntil ? { lockedUntil } : {}) },
  })
}

async function clearFailedAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedUntil: null },
  })
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/login
  app.post('/auth/login', async (request, reply) => {
    const body = LoginSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Invalid credentials' })
    }

    const { email, password } = body.data

    // Rate-limit per IP
    const ipKey = `login_attempt:${request.ip}`
    const attempts = await redis.incr(ipKey)
    if (attempts === 1) await redis.expire(ipKey, 900)
    if (attempts > 20) {
      return reply.status(429).send({ success: false, error: 'Too many attempts' })
    }

    const user = await prisma.user.findFirst({
      where: { email },
      include: { org: true },
    })

    // Generic error — do not reveal whether email exists
    if (!user) {
      await new Promise((r) => setTimeout(r, 200)) // timing equalisation
      return reply.status(401).send({ success: false, error: 'Invalid credentials' })
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return reply.status(403).send({ success: false, error: 'Account locked. Try again later.' })
    }

    const valid = await verifyPassword(user.passwordHash, password)
    if (!valid) {
      await incrementFailedAttempts(user.id)
      return reply.status(401).send({ success: false, error: 'Invalid credentials' })
    }

    await clearFailedAttempts(user.id)

    if (user.mfaEnabled) {
      // Issue a short-lived MFA challenge token instead of full session
      const challengeToken = generateSessionToken()
      await redis.set(`mfa_challenge:${challengeToken}`, user.id, 'EX', 300)
      return reply.send({ success: true, mfaRequired: true, challengeToken })
    }

    const token = generateSessionToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: request.ip,
        userAgent: request.headers['user-agent']?.substring(0, 255),
      },
    })

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    reply.setCookie('session', token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS / 1000,
    })

    return reply.send({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId },
    })
  })

  // POST /auth/mfa/verify
  app.post('/auth/mfa/verify', async (request, reply) => {
    const body = z
      .object({ code: z.string().regex(/^\d{6}$/), challengeToken: z.string().min(10).max(200) })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Invalid request' })
    }

    const userId = await redis.get(`mfa_challenge:${body.data.challengeToken}`)
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'Challenge expired or invalid' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.mfaSecret) {
      return reply.status(401).send({ success: false, error: 'MFA not configured' })
    }

    const secret = decryptMfaSecret(user.mfaSecret)
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) })
    const delta = totp.validate({ token: body.data.code, window: 1 })
    if (delta === null) {
      return reply.status(401).send({ success: false, error: 'Invalid MFA code' })
    }

    await redis.del(`mfa_challenge:${body.data.challengeToken}`)

    const token = generateSessionToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

    await prisma.session.create({
      data: { userId: user.id, tokenHash, expiresAt, ip: request.ip, userAgent: request.headers['user-agent']?.substring(0, 255) },
    })
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    reply.setCookie('session', token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS / 1000,
    })

    return reply.send({ success: true })
  })

  // POST /auth/logout
  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies['session']
    if (token) {
      const tokenHash = hashToken(token)
      await prisma.session.deleteMany({ where: { tokenHash } })
      reply.clearCookie('session', { path: '/' })
    }
    return reply.send({ success: true })
  })

  // GET /auth/me — requires auth
  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, email: true, name: true, role: true, orgId: true, mfaEnabled: true, org: { select: { name: true, accentColor: true, appTitle: true, logoUrl: true, senderEmail: true, senderName: true } } },
    })
    return reply.send({ success: true, data: user })
  })

  // POST /auth/mfa/setup — setup MFA for current user
  app.post('/auth/mfa/setup', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const secret = new OTPAuth.Secret()
    const totp = new OTPAuth.TOTP({
      issuer: 'ShieldIQ',
      label: request.user.email,
      secret,
    })

    const encrypted = encryptMfaSecret(secret.base32)
    await prisma.user.update({ where: { id: request.user.id }, data: { mfaSecret: encrypted } })

    return reply.send({ success: true, data: { otpauthUrl: totp.toString(), secret: secret.base32 } })
  })

  // POST /auth/mfa/confirm — confirm and enable MFA
  app.post('/auth/mfa/confirm', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const body = MfaVerifySchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid code' })

    const user = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!user?.mfaSecret) return reply.status(400).send({ success: false, error: 'MFA not set up' })

    const secret = decryptMfaSecret(user.mfaSecret)
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) })
    if (totp.validate({ token: body.data.code, window: 1 }) === null) {
      return reply.status(401).send({ success: false, error: 'Invalid code' })
    }

    await prisma.user.update({ where: { id: request.user.id }, data: { mfaEnabled: true } })
    return reply.send({ success: true })
  })
}
