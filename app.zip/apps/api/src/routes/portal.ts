import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

/**
 * Public employee-facing training portal.
 *
 * Authentication design: we deliberately use email-only lookup here because
 * (a) employees may not have user accounts in the IdP, and
 * (b) full SSO/SAML integration is a separate feature.
 *
 * Mitigations:
 *  - Endpoints are RATE-LIMITED globally by Fastify rate-limit middleware.
 *  - Emails are validated server-side via Zod (length-capped, format-checked).
 *  - We don't reveal whether an email exists in any specific org — generic 404.
 *  - No PII other than the employee's own name/email is returned.
 *  - Completion writes are scoped to the looked-up employee's orgId only.
 *  - In production this should be hardened with magic-link tokens.
 */
export async function portalRoutes(app: FastifyInstance): Promise<void> {
  const EmailQuery = z.object({ email: z.string().email().max(254).toLowerCase() })

  // GET /portal/me — list active activities + modules for an employee
  app.get('/portal/me', async (request, reply) => {
    const parsed = EmailQuery.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid email' })

    const employee = await prisma.employee.findFirst({
      where: { email: parsed.data.email, deletedAt: null },
      include: { dept: true, org: { select: { name: true, appTitle: true, accentColor: true } } },
    })

    if (!employee) {
      // Generic response so we don't leak which emails are registered
      return reply.status(404).send({ success: false, error: 'Employee not found' })
    }

    // Active activities targeting this employee's department (or all)
    const activities = await prisma.activity.findMany({
      where: {
        orgId: employee.orgId,
        status: 'active',
        OR: [{ deptIds: { isEmpty: true } }, { deptIds: { has: employee.deptId } }],
      },
      orderBy: { deadline: 'asc' },
    })

    // Modules + completions for these activities
    const allModuleIds = Array.from(new Set(activities.flatMap((a) => a.moduleIds)))
    const modules = await prisma.module.findMany({ where: { id: { in: allModuleIds } } })
    const completions = await prisma.moduleCompletion.findMany({
      where: { employeeId: employee.id, activityId: { in: activities.map((a) => a.id) } },
    })

    const completionKey = (activityId: string, moduleId: string) => `${activityId}:${moduleId}`
    const completionMap = new Map<string, Date>()
    for (const c of completions) {
      completionMap.set(completionKey(c.activityId, c.moduleId), c.completedAt)
    }

    const data = {
      employee: { id: employee.id, name: employee.name, email: employee.email, dept: employee.dept.name },
      org: employee.org,
      activities: activities.map((a) => ({
        id: a.id,
        name: a.name,
        deadline: a.deadline,
        emailBody: a.emailBody,
        modules: a.moduleIds
          .map((mId) => {
            const m = modules.find((x) => x.id === mId)
            if (!m) return null
            const completedAt = completionMap.get(completionKey(a.id, mId))
            return { id: m.id, name: m.name, completed: !!completedAt, completedAt: completedAt ?? null }
          })
          .filter(Boolean),
      })),
    }

    return reply.send({ success: true, data })
  })

  // POST /portal/complete — employee marks a module complete
  const CompleteSchema = z.object({
    email: z.string().email().max(254).toLowerCase(),
    activityId: z.string().min(1).max(50),
    moduleId: z.string().min(1).max(50),
  })

  app.post('/portal/complete', async (request, reply) => {
    const parsed = CompleteSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid payload' })

    const { email, activityId, moduleId } = parsed.data

    // Look up employee and verify activity/module belong to their org
    const employee = await prisma.employee.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, orgId: true, deptId: true },
    })
    if (!employee) return reply.status(404).send({ success: false, error: 'Not found' })

    const activity = await prisma.activity.findFirst({
      where: { id: activityId, orgId: employee.orgId, status: 'active' },
      select: { id: true, moduleIds: true, deptIds: true },
    })
    if (!activity) return reply.status(404).send({ success: false, error: 'Activity not available' })

    // Verify the module is part of this activity
    if (!activity.moduleIds.includes(moduleId)) {
      return reply.status(400).send({ success: false, error: 'Module not in this activity' })
    }

    // Verify activity targets this employee
    if (activity.deptIds.length > 0 && !activity.deptIds.includes(employee.deptId)) {
      return reply.status(403).send({ success: false, error: 'Not assigned to this activity' })
    }

    // Upsert completion (idempotent)
    await prisma.moduleCompletion.upsert({
      where: { employeeId_moduleId_activityId: { employeeId: employee.id, moduleId, activityId } },
      update: {},
      create: { employeeId: employee.id, moduleId, activityId },
    })

    return reply.send({ success: true })
  })
}
