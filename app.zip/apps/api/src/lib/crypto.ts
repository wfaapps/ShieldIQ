import crypto from 'crypto'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'

const PHISH_SECRET = process.env['PHISH_HMAC_SECRET'] ?? ''

// ─── Password hashing ─────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

// ─── Session tokens ───────────────────────────────────────────────────────────
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // pad to prevent length-leaking — compare anyway returns false
    const padded = Buffer.alloc(bufA.length)
    crypto.timingSafeEqual(bufA, padded)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

// ─── Phishing tracking tokens ─────────────────────────────────────────────────
export function signPhishToken(payload: {
  campaignId: string
  employeeId: string
  action: string
}): string {
  if (!PHISH_SECRET) throw new Error('PHISH_HMAC_SECRET not set')
  return jwt.sign(payload, PHISH_SECRET, { expiresIn: '30d', algorithm: 'HS256' })
}

export function verifyPhishToken(token: string): {
  campaignId: string
  employeeId: string
  action: string
} {
  if (!PHISH_SECRET) throw new Error('PHISH_HMAC_SECRET not set')
  return jwt.verify(token, PHISH_SECRET) as {
    campaignId: string
    employeeId: string
    action: string
  }
}

// ─── MFA TOTP ─────────────────────────────────────────────────────────────────
const MFA_KEY = Buffer.from(process.env['MFA_ENCRYPTION_KEY'] ?? '0'.repeat(64), 'hex')

export function encryptMfaSecret(secret: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', MFA_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptMfaSecret(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', MFA_KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
