import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { verifyPhishToken } from '../lib/crypto'
import { logger } from '../lib/logger'

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

export async function phishRoutes(app: FastifyInstance): Promise<void> {
  // GET /phish/stats
  app.get('/phish/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
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
        totalSent: opened,
        openRate: 100,
        clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
        submitRate: opened > 0 ? Math.round((submitted / opened) * 100) : 0,
        reportRate: opened > 0 ? Math.round((reported / opened) * 100) : 0,
      },
    })
  })

  // GET /phish/funnel/:campaignId
  app.get('/phish/funnel/:campaignId', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { campaignId } = request.params as { campaignId: string }
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, orgId: request.user.orgId } })
    if (!campaign) return reply.status(404).send({ success: false, error: 'Not found' })

    const clicks = await prisma.phishClick.findMany({ where: { campaignId } })
    const sent = new Set(clicks.map((c) => c.employeeId)).size
    const opened = clicks.filter((c) => c.action === 'opened').length
    const clicked = clicks.filter((c) => c.action === 'clicked').length
    const submitted = clicks.filter((c) => c.action === 'submitted').length
    const reported = clicks.filter((c) => c.action === 'reported').length

    return reply.send({
      success: true,
      data: { sent, opened, clicked, submitted, reported },
    })
  })

  // GET /phish/by-dept
  app.get('/phish/by-dept', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const orgId = request.user.orgId
    const depts = await prisma.department.findMany({
      where: { orgId },
      include: { employees: { where: { deletedAt: null }, include: { clicks: { where: { campaign: { orgId } } } } } },
    })
    const data = depts.map((d) => {
      const allClicks = d.employees.flatMap((e) => e.clicks)
      const opened = allClicks.filter((c) => c.action === 'opened').length
      const clicked = allClicks.filter((c) => c.action === 'clicked').length
      return {
        id: d.id,
        name: d.name,
        color: d.color,
        clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
        employeeCount: d.employees.length,
      }
    })
    return reply.send({ success: true, data })
  })

  // GET /phish/clicks — user-level table with pagination
  app.get('/phish/clicks', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      campaignId: z.string().optional(),
    }).safeParse(request.query)
    if (!query.success) return reply.status(400).send({ success: false, error: 'Invalid query' })

    const { page, pageSize, campaignId } = query.data
    const where: Record<string, unknown> = { campaign: { orgId: request.user.orgId } }
    if (campaignId) where['campaignId'] = campaignId

    const [total, clicks] = await Promise.all([
      prisma.phishClick.count({ where }),
      prisma.phishClick.findMany({
        where,
        include: {
          employee: { select: { name: true, email: true, dept: { select: { name: true } } } },
          campaign: { select: { name: true } },
        },
        orderBy: { clickedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return reply.send({
      success: true,
      data: clicks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  })

  // GET /track/open/:token — tracking pixel (unauthenticated)
  app.get('/track/open/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    try {
      const payload = verifyPhishToken(token)
      // Ignore duplicate opens — best-effort tracking only
      await prisma.phishClick.create({
        data: {
          campaignId: payload.campaignId,
          employeeId: payload.employeeId,
          action: 'opened',
        },
      }).catch(() => void 0)
    } catch {
      // Silently fail — never leak errors on tracking endpoint
    }
    return reply
      .header('Content-Type', 'image/gif')
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .send(TRACKING_PIXEL)
  })

  // GET /track/click/:token — link rewrite (unauthenticated)
  app.get('/track/click/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const query = z.object({ url: z.string().url().max(2000) }).safeParse(request.query)

    let redirectUrl = process.env['APP_URL'] ?? '/'
    try {
      const payload = verifyPhishToken(token)
      await prisma.phishClick.create({
        data: { campaignId: payload.campaignId, employeeId: payload.employeeId, action: 'clicked' },
      }).catch(() => void 0) // ignore duplicate

      if (query.success) {
        // Only allow redirects to app domain or awareness page
        const allowed = new URL(query.data.url).hostname === new URL(process.env['APP_URL'] ?? 'http://localhost').hostname
        if (allowed) redirectUrl = query.data.url
        else redirectUrl = `${process.env['APP_URL']}/awareness-landing`
      } else {
        redirectUrl = `${process.env['APP_URL']}/awareness-landing`
      }
    } catch (err) {
      logger.warn({ msg: 'Phish token verify failed', error: (err as Error).message })
    }

    return reply.redirect(302, redirectUrl)
  })
}
