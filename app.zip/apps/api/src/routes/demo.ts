import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { writeAuditLog } from '../middleware/audit'

/**
 * Demo data generator — admin-only endpoint that populates realistic
 * completion/click data so dashboards have something to display.
 *
 * Safety:
 *  - Requires authentication + admin role (enforced server-side).
 *  - Only writes to the requester's own org (orgId from session, never client).
 *  - Idempotent: re-running rebuilds stats from current employee roster.
 */
export async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.post('/demo/generate', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    if (!['admin', 'superadmin'].includes(request.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
    const orgId = request.user.orgId

    // Make sure there's at least one active activity to attach completions to
    let activity = await prisma.activity.findFirst({
      where: { orgId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    const modules = await prisma.module.findMany({ where: { orgId, enabled: true } })
    if (modules.length === 0) {
      return reply.status(400).send({ success: false, error: 'Add some training modules first' })
    }

    if (!activity) {
      // Create one
      activity = await prisma.activity.create({
        data: {
          orgId,
          name: 'Q3 Security Awareness Training',
          scope: 'all',
          deptIds: [],
          moduleIds: modules.map((m) => m.id),
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          emailSubject: 'Your security training has been launched',
          emailBody: 'Please complete the assigned modules before the deadline. Reach out to IT Security if you have any questions.',
          status: 'active',
          launchedAt: new Date(),
        },
      })
    }

    // Get all active employees in org
    const employees = await prisma.employee.findMany({ where: { orgId, deletedAt: null } })

    // Generate completion data — ~70% complete all modules, 20% partial, 10% none
    // Uses CSPRNG (crypto.randomInt) for the role-bucket assignment.
    let totalCompletions = 0
    for (const emp of employees) {
      const bucket = crypto.randomInt(0, 100)
      let modulesToComplete: typeof modules = []
      if (bucket < 70) modulesToComplete = modules
      else if (bucket < 90) modulesToComplete = modules.slice(0, Math.max(1, Math.floor(modules.length / 2)))
      // else: no completion

      for (const m of modulesToComplete) {
        await prisma.moduleCompletion.upsert({
          where: { employeeId_moduleId_activityId: { employeeId: emp.id, moduleId: m.id, activityId: activity.id } },
          update: {},
          create: { employeeId: emp.id, moduleId: m.id, activityId: activity.id },
        })
        totalCompletions++
      }
    }

    // Generate phishing campaign + clicks
    const template = await prisma.template.findFirst({ where: { orgId, category: 'phishing' } })
    if (template) {
      const campaign = await prisma.campaign.upsert({
        where: { id: `demo-campaign-${activity.id}` },
        update: {},
        create: {
          id: `demo-campaign-${activity.id}`,
          orgId,
          name: 'Q3 Phishing Simulation',
          templateId: template.id,
          targetScope: 'all',
          status: 'sent',
          sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      })

      // ~95% opened, 25% clicked, 5% submitted, 15% reported (CSPRNG-driven)
      for (const emp of employees) {
        const openRoll = crypto.randomInt(0, 100)
        if (openRoll < 95) {
          await prisma.phishClick.create({
            data: { campaignId: campaign.id, employeeId: emp.id, action: 'opened' },
          }).catch(() => void 0)
        }
        const clickRoll = crypto.randomInt(0, 100)
        if (clickRoll < 25) {
          await prisma.phishClick.create({
            data: { campaignId: campaign.id, employeeId: emp.id, action: 'clicked' },
          }).catch(() => void 0)
          const submitRoll = crypto.randomInt(0, 100)
          if (submitRoll < 20) {
            await prisma.phishClick.create({
              data: { campaignId: campaign.id, employeeId: emp.id, action: 'submitted' },
            }).catch(() => void 0)
          }
        }
        const reportRoll = crypto.randomInt(0, 100)
        if (reportRoll < 15) {
          await prisma.phishClick.create({
            data: { campaignId: campaign.id, employeeId: emp.id, action: 'reported' },
          }).catch(() => void 0)
        }
      }
    }

    await writeAuditLog(request, { action: 'demo.generated', resource: 'Demo', meta: { completions: totalCompletions, employees: employees.length } })

    return reply.send({
      success: true,
      data: {
        employees: employees.length,
        completions: totalCompletions,
        activityId: activity.id,
        message: 'Demo data generated. Refresh the dashboard to see realistic stats.',
      },
    })
  })
}
