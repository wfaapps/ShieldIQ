import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { writeAuditLog } from '../middleware/audit'
import { CreateExerciseSchema, UpdateExerciseSchema, CreateScenarioSchema } from '@shieldiq/shared'

export async function exerciseRoutes(app: FastifyInstance): Promise<void> {
  // GET /exercises
  app.get('/exercises', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const exercises = await prisma.exercise.findMany({
      where: { orgId: request.user.orgId },
      include: { scenario: true },
      orderBy: { startedAt: 'desc' },
    })
    return reply.send({ success: true, data: exercises })
  })

  // POST /exercises
  app.post('/exercises', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const body = CreateExerciseSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const scenario = await prisma.scenario.findFirst({ where: { id: body.data.scenarioId, orgId: request.user.orgId } })
    if (!scenario) return reply.status(404).send({ success: false, error: 'Scenario not found' })

    const exercise = await prisma.exercise.create({
      data: { ...body.data, orgId: request.user.orgId },
      include: { scenario: true },
    })
    await writeAuditLog(request, { action: 'exercise.created', resource: 'Exercise', resourceId: exercise.id })
    return reply.status(201).send({ success: true, data: exercise })
  })

  // GET /exercises/:id
  app.get('/exercises/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const exercise = await prisma.exercise.findFirst({
      where: { id, orgId: request.user.orgId },
      include: { scenario: true },
    })
    if (!exercise) return reply.status(404).send({ success: false, error: 'Not found' })
    return reply.send({ success: true, data: exercise })
  })

  // PATCH /exercises/:id
  app.patch('/exercises/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const exercise = await prisma.exercise.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!exercise) return reply.status(404).send({ success: false, error: 'Not found' })

    const body = UpdateExerciseSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const updated = await prisma.exercise.update({ where: { id }, data: body.data })
    await writeAuditLog(request, { action: 'exercise.updated', resource: 'Exercise', resourceId: id })
    return reply.send({ success: true, data: updated })
  })

  // POST /exercises/:id/end
  app.post('/exercises/:id/end', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const exercise = await prisma.exercise.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!exercise) return reply.status(404).send({ success: false, error: 'Not found' })

    const updated = await prisma.exercise.update({ where: { id }, data: { status: 'ended', endedAt: new Date() } })
    await writeAuditLog(request, { action: 'exercise.ended', resource: 'Exercise', resourceId: id })
    return reply.send({ success: true, data: updated })
  })

  // GET /scenarios
  app.get('/scenarios', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const scenarios = await prisma.scenario.findMany({
      where: { orgId: request.user.orgId },
      orderBy: [{ isSystem: 'desc' }, { title: 'asc' }],
    })
    return reply.send({ success: true, data: scenarios })
  })

  // POST /scenarios
  app.post('/scenarios', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const body = CreateScenarioSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const scenario = await prisma.scenario.create({
      data: { ...body.data, orgId: request.user.orgId, isSystem: false },
    })
    await writeAuditLog(request, { action: 'scenario.created', resource: 'Scenario', resourceId: scenario.id })
    return reply.status(201).send({ success: true, data: scenario })
  })
}
