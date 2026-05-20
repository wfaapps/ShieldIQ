import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const orgId = request.user.orgId

    const [totalEmployees, depts, modules, activities, campaigns, recentActivity] =
      await Promise.all([
        prisma.employee.count({ where: { orgId, deletedAt: null } }),
        prisma.department.findMany({ where: { orgId }, include: { employees: { where: { deletedAt: null } } } }),
        prisma.module.findMany({ where: { orgId, enabled: true } }),
        prisma.activity.findMany({ where: { orgId, status: 'active' }, orderBy: { createdAt: 'desc' }, take: 5 }),
        prisma.campaign.findMany({
          where: { orgId },
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: { clicks: true },
        }),
        prisma.auditLog.findMany({
          where: { orgId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { name: true } } },
        }),
      ])

    // Completion stats across all active activities
    const allCompletions = await prisma.moduleCompletion.findMany({
      where: { activity: { orgId, status: 'active' } },
      select: { employeeId: true, moduleId: true },
    })
    const completedEmployeeIds = new Set(allCompletions.map((c) => c.employeeId))
    const completedCount = completedEmployeeIds.size

    // Click rate across all campaigns
    const totalSent = await prisma.phishClick.count({ where: { campaign: { orgId }, action: 'opened' } })
    const totalClicked = await prisma.phishClick.count({ where: { campaign: { orgId }, action: 'clicked' } })
    const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0

    // Dept completion bars
    const deptStats = depts.map((d) => {
      const empIds = d.employees.map((e) => e.id)
      const completed = empIds.filter((id) => completedEmployeeIds.has(id)).length
      return {
        id: d.id,
        name: d.name,
        color: d.color,
        total: empIds.length,
        completed,
        pct: empIds.length > 0 ? Math.round((completed / empIds.length) * 100) : 0,
      }
    })

    // Risk score: invert of completion + weighted click rate
    const overallCompletion = totalEmployees > 0 ? completedCount / totalEmployees : 0
    const riskScore = Math.round(100 - overallCompletion * 60 - (1 - clickRate / 100) * 40)

    return reply.send({
      success: true,
      data: {
        totalEmployees,
        completedCount,
        pendingCount: totalEmployees - completedCount,
        clickRate,
        riskScore: Math.max(0, Math.min(100, riskScore)),
        deptStats,
        activeActivities: activities,
        activeCampaigns: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          clickCount: c.clicks.filter((x) => x.action === 'clicked').length,
        })),
        recentActivity: recentActivity.map((l) => ({
          id: l.id,
          action: l.action,
          resource: l.resource,
          user: l.user.name,
          createdAt: l.createdAt,
        })),
      },
    })
  })
}
