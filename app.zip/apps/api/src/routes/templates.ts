import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAuditLog } from '../middleware/audit'
import { CreateTemplateSchema, UpdateTemplateSchema } from '@shieldiq/shared'

export async function templateRoutes(app: FastifyInstance): Promise<void> {
  // GET /templates
  app.get('/templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const query = z.object({ category: z.string().optional() }).safeParse(request.query)
    const where: Record<string, unknown> = { orgId: request.user.orgId }
    if (query.success && query.data.category) where['category'] = query.data.category

    const templates = await prisma.template.findMany({ where, orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] })
    return reply.send({ success: true, data: templates })
  })

  // POST /templates
  app.post('/templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const body = CreateTemplateSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const template = await prisma.template.create({
      data: { ...body.data, orgId: request.user.orgId, isSystem: false },
    })
    await writeAuditLog(request, { action: 'template.created', resource: 'Template', resourceId: template.id })
    return reply.status(201).send({ success: true, data: template })
  })

  // PATCH /templates/:id
  app.patch('/templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const template = await prisma.template.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!template) return reply.status(404).send({ success: false, error: 'Not found' })
    if (template.isSystem) return reply.status(403).send({ success: false, error: 'Cannot edit system template' })

    const body = UpdateTemplateSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const updated = await prisma.template.update({ where: { id }, data: body.data })
    await writeAuditLog(request, { action: 'template.updated', resource: 'Template', resourceId: id })
    return reply.send({ success: true, data: updated })
  })

  // DELETE /templates/:id
  app.delete('/templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const template = await prisma.template.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!template) return reply.status(404).send({ success: false, error: 'Not found' })
    if (template.isSystem) return reply.status(403).send({ success: false, error: 'Cannot delete system template' })

    await prisma.template.delete({ where: { id } })
    await writeAuditLog(request, { action: 'template.deleted', resource: 'Template', resourceId: id })
    return reply.send({ success: true })
  })
}
