import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'
import { hashToken, timingSafeEqual } from '../lib/crypto'
import { logger } from '../lib/logger'

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string
      orgId: string
      email: string
      name: string
      role: string
    } | null
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies['session']
  if (!token) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' })
  }

  const tokenHash = hashToken(token)
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, orgId: true, email: true, name: true, role: true, mfaEnabled: true } } },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => void 0)
    }
    return reply.status(401).send({ success: false, error: 'Session expired' })
  }

  request.user = {
    id: session.user.id,
    orgId: session.user.orgId,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
    if (!roles.includes(request.user.role)) {
      logger.warn({ msg: 'Access denied', userId: request.user.id, role: request.user.role, required: roles })
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
  }
}
