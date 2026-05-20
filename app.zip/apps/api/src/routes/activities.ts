import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAuditLog } from '../middleware/audit'
import { CreateActivitySchema, UpdateActivitySchema } from '@shieldiq/shared'
import { activityEmailsQueue } from '../workers/queues'

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  // GET /activities
  app.get('/activities', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const activities = await prisma.activity.findMany({
      where: { orgId: request.user.orgId },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ success: true, data: activities })
  })

  // POST /activities
  app.post('/activities', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const body = CreateActivitySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, error: body.error.flatten() })
    }

    const { launch, ...data } = body.data
    const activity = await prisma.activity.create({
      data: {
        ...data,
        orgId: request.user.orgId,
        status: launch ? 'active' : 'draft',
        launchedAt: launch ? new Date() : undefined,
      },
    })

    if (launch) {
      await activityEmailsQueue.add('launch', { activityId: activity.id, orgId: request.user.orgId })
    }

    await writeAuditLog(request, { action: 'activity.created', resource: 'Activity', resourceId: activity.id })
    return reply.status(201).send({ success: true, data: activity })
  })

  // GET /activities/:id
  app.get('/activities/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const activity = await prisma.activity.findFirst({
      where: { id, orgId: request.user.orgId },
      include: { completions: { include: { employee: { include: { dept: true } }, module: true } } },
    })
    if (!activity) return reply.status(404).send({ success: false, error: 'Not found' })

    // Build per-dept stats
    const depts = await prisma.department.findMany({ where: { orgId: request.user.orgId }, include: { employees: { where: { deletedAt: null } } } })
    const deptStats = depts.map((d) => {
      const empIds = d.employees.map((e) => e.id)
      const completed = activity.completions.filter((c) => empIds.includes(c.employeeId)).length
      const total = empIds.length * activity.moduleIds.length
      return {
        id: d.id, name: d.name, color: d.color,
        completedCompletions: completed,
        totalCompletions: total,
        pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      }
    })

    return reply.send({ success: true, data: { ...activity, deptStats } })
  })

  // PATCH /activities/:id
  app.patch('/activities/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const existing = await prisma.activity.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Not found' })
    if (existing.status !== 'draft') return reply.status(409).send({ success: false, error: 'Can only edit draft activities' })

    const body = UpdateActivitySchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const { launch, ...data } = body.data
    const updated = await prisma.activity.update({ where: { id }, data })
    await writeAuditLog(request, { action: 'activity.updated', resource: 'Activity', resourceId: id })
    return reply.send({ success: true, data: updated })
  })

  // POST /activities/:id/launch
  app.post('/activities/:id/launch', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const activity = await prisma.activity.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!activity) return reply.status(404).send({ success: false, error: 'Not found' })
    if (activity.status !== 'draft') return reply.status(409).send({ success: false, error: 'Already launched' })

    await prisma.activity.update({ where: { id }, data: { status: 'active', launchedAt: new Date() } })

    // Queue email sending — gracefully handle failures so launch still succeeds
    try {
      await activityEmailsQueue.add('launch', { activityId: id, orgId: request.user.orgId })
    } catch (err) {
      // Email queue failed but activity is still launched
      console.warn('Email queue failed, activity still launched:', (err as Error).message)
    }

    await writeAuditLog(request, { action: 'activity.launched', resource: 'Activity', resourceId: id })
    return reply.send({ success: true })
  })

  // GET /activities/:id/completion — per-employee table
  app.get('/activities/:id/completion', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const activity = await prisma.activity.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!activity) return reply.status(404).send({ success: false, error: 'Not found' })

    const employees = await prisma.employee.findMany({
      where: { orgId: request.user.orgId, deletedAt: null },
      include: { dept: true, completions: { where: { activityId: id } } },
    })

    const rows = employees.map((e) => {
      const completedModules = e.completions.map((c) => c.moduleId)
      const total = activity.moduleIds.length
      const done = activity.moduleIds.filter((m) => completedModules.includes(m)).length
      const status =
        done === total ? 'completed' :
        done > 0 ? 'in_progress' :
        new Date() > activity.deadline ? 'overdue' :
        'not_started'
      return { id: e.id, name: e.name, email: e.email, dept: e.dept.name, done, total, status }
    })

    return reply.send({ success: true, data: rows })
  })
}
