import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAuditLog } from '../middleware/audit'
import { UpdateOrgSchema, CreateDeptSchema, CreateModuleSchema, UpdateModuleSchema } from '@shieldiq/shared'

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // GET /org
  app.get('/org', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const org = await prisma.organisation.findUnique({ where: { id: request.user.orgId } })
    if (!org) return reply.status(404).send({ success: false, error: 'Not found' })
    return reply.send({ success: true, data: org })
  })

  // PATCH /org
  app.patch('/org', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    if (!['admin', 'superadmin'].includes(request.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
    const body = UpdateOrgSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const org = await prisma.organisation.update({ where: { id: request.user.orgId }, data: body.data })
    await writeAuditLog(request, { action: 'org.updated', resource: 'Organisation', resourceId: org.id })
    return reply.send({ success: true, data: org })
  })

  // ─── Modules ───────────────────────────────────────────────────────────────
  app.get('/org/modules', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const modules = await prisma.module.findMany({
      where: { orgId: request.user.orgId },
      orderBy: { sortOrder: 'asc' },
    })
    return reply.send({ success: true, data: modules })
  })

  app.post('/org/modules', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const body = CreateModuleSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const module = await prisma.module.create({ data: { ...body.data, orgId: request.user.orgId } })
    await writeAuditLog(request, { action: 'module.created', resource: 'Module', resourceId: module.id })
    return reply.status(201).send({ success: true, data: module })
  })

  app.patch('/org/modules/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const existing = await prisma.module.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Not found' })

    const body = UpdateModuleSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const updated = await prisma.module.update({ where: { id }, data: body.data })
    await writeAuditLog(request, { action: 'module.updated', resource: 'Module', resourceId: id })
    return reply.send({ success: true, data: updated })
  })

  app.delete('/org/modules/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const existing = await prisma.module.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Not found' })

    await prisma.module.delete({ where: { id } })
    await writeAuditLog(request, { action: 'module.deleted', resource: 'Module', resourceId: id })
    return reply.send({ success: true })
  })

  // ─── Departments ───────────────────────────────────────────────────────────
  app.get('/org/departments', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const depts = await prisma.department.findMany({
      where: { orgId: request.user.orgId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    })
    return reply.send({ success: true, data: depts })
  })

  app.post('/org/departments', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const body = CreateDeptSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const dept = await prisma.department.create({ data: { ...body.data, orgId: request.user.orgId } })
    await writeAuditLog(request, { action: 'dept.created', resource: 'Department', resourceId: dept.id })
    return reply.status(201).send({ success: true, data: dept })
  })

  app.patch('/org/departments/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const existing = await prisma.department.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Not found' })

    const body = CreateDeptSchema.partial().safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const updated = await prisma.department.update({ where: { id }, data: body.data })
    await writeAuditLog(request, { action: 'dept.updated', resource: 'Department', resourceId: id })
    return reply.send({ success: true, data: updated })
  })

  app.delete('/org/departments/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const existing = await prisma.department.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Not found' })

    const count = await prisma.employee.count({ where: { deptId: id, deletedAt: null } })
    if (count > 0) return reply.status(409).send({ success: false, error: 'Cannot delete department with active employees' })

    await prisma.department.delete({ where: { id } })
    await writeAuditLog(request, { action: 'dept.deleted', resource: 'Department', resourceId: id })
    return reply.send({ success: true })
  })

  // ─── Audit Logs ────────────────────────────────────────────────────────────
  app.get('/audit-logs', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    if (!['admin', 'superadmin'].includes(request.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
      action: z.string().max(100).optional(),
    }).safeParse(request.query)
    if (!query.success) return reply.status(400).send({ success: false, error: 'Invalid query' })

    const { page, pageSize, action } = query.data
    const where: Record<string, unknown> = { orgId: request.user.orgId }
    if (action) where['action'] = { contains: action }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return reply.send({ success: true, data: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  })
}
