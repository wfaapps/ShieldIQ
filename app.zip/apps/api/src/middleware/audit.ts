import type { FastifyRequest } from 'fastify'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'

export async function writeAuditLog(
  request: FastifyRequest,
  opts: {
    action: string
    resource: string
    resourceId?: string
    meta?: Record<string, unknown>
  },
): Promise<void> {
  if (!request.user) return
  try {
    await prisma.auditLog.create({
      data: {
        orgId: request.user.orgId,
        userId: request.user.id,
        action: opts.action,
        resource: opts.resource,
        resourceId: opts.resourceId,
        meta: opts.meta ?? {},
        ip: request.ip,
        userAgent: request.headers['user-agent']?.substring(0, 255),
      },
    })
  } catch (err) {
    logger.error({ msg: 'Audit log write failed', error: (err as Error).message })
  }
}
