import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { writeAuditLog } from '../middleware/audit'
import { CreateCampaignSchema, UpdateCampaignSchema } from '@shieldiq/shared'
import { campaignEmailsQueue } from '../workers/queues'

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  // GET /campaigns
  app.get('/campaigns', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const campaigns = await prisma.campaign.findMany({
      where: { orgId: request.user.orgId },
      orderBy: { createdAt: 'desc' },
      include: { template: { select: { name: true, icon: true } }, clicks: true },
    })
    const data = campaigns.map((c) => {
      const sent = c.clicks.filter((x) => x.action === 'opened').length
      const clicked = c.clicks.filter((x) => x.action === 'clicked').length
      const reported = c.clicks.filter((x) => x.action === 'reported').length
      return {
        id: c.id, name: c.name, status: c.status, sentAt: c.sentAt,
        templateName: c.template.name, templateIcon: c.template.icon,
        sent, clicked, reported,
        clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
      }
    })
    return reply.send({ success: true, data })
  })

  // POST /campaigns
  app.post('/campaigns', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const body = CreateCampaignSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    // Verify template belongs to org
    const template = await prisma.template.findFirst({
      where: { id: body.data.templateId, orgId: request.user.orgId },
    })
    if (!template) return reply.status(404).send({ success: false, error: 'Template not found' })

    const campaign = await prisma.campaign.create({
      data: { ...body.data, orgId: request.user.orgId },
    })
    await writeAuditLog(request, { action: 'campaign.created', resource: 'Campaign', resourceId: campaign.id })
    return reply.status(201).send({ success: true, data: campaign })
  })

  // GET /campaigns/stats
  app.get('/campaigns/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const orgId = request.user.orgId
    const [opened, clicked, submitted, reported] = await Promise.all([
      prisma.phishClick.count({ where: { campaign: { orgId }, action: 'opened' } }),
      prisma.phishClick.count({ where: { campaign: { orgId }, action: 'clicked' } }),
      prisma.phishClick.count({ where: { campaign: { orgId }, action: 'submitted' } }),
      prisma.phishClick.count({ where: { campaign: { orgId }, action: 'reported' } }),
    ])
    return reply.send({
      success: true,
      data: {
        sent: opened,
        openRate: 100,
        clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
        submitRate: opened > 0 ? Math.round((submitted / opened) * 100) : 0,
        reportRate: opened > 0 ? Math.round((reported / opened) * 100) : 0,
      },
    })
  })

  // GET /campaigns/:id
  app.get('/campaigns/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const campaign = await prisma.campaign.findFirst({
      where: { id, orgId: request.user.orgId },
      include: { template: true, clicks: { include: { employee: { select: { name: true, email: true, dept: { select: { name: true } } } } } } },
    })
    if (!campaign) return reply.status(404).send({ success: false, error: 'Not found' })
    return reply.send({ success: true, data: campaign })
  })

  // PATCH /campaigns/:id
  app.patch('/campaigns/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const existing = await prisma.campaign.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Not found' })
    if (!['draft', 'scheduled'].includes(existing.status)) {
      return reply.status(409).send({ success: false, error: 'Cannot edit sent campaign' })
    }

    const body = UpdateCampaignSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    const updated = await prisma.campaign.update({ where: { id }, data: body.data })
    await writeAuditLog(request, { action: 'campaign.updated', resource: 'Campaign', resourceId: id })
    return reply.send({ success: true, data: updated })
  })

  // POST /campaigns/:id/send
  app.post('/campaigns/:id/send', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const campaign = await prisma.campaign.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!campaign) return reply.status(404).send({ success: false, error: 'Not found' })
    if (campaign.status === 'sent') return reply.status(409).send({ success: false, error: 'Already sent' })

    await prisma.campaign.update({ where: { id }, data: { status: 'active', sentAt: new Date() } })
    await campaignEmailsQueue.add('send', { campaignId: id, orgId: request.user.orgId })
    await writeAuditLog(request, { action: 'campaign.sent', resource: 'Campaign', resourceId: id })
    return reply.send({ success: true })
  })
}
