import { Worker } from 'bullmq'
import Handlebars from 'handlebars'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'
import { sendMail } from '../lib/email'
import { logger } from '../lib/logger'

const REMINDER_TEMPLATE = Handlebars.compile(`
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #e5e7eb;">
  <h2 style="color:#f59e0b;">⚠️ Security Training Reminder — {{daysLeft}} Days Remaining</h2>
  <p>Hi {{employeeName}},</p>
  <p>You have <strong>{{remaining}}</strong> training module(s) still to complete before <strong>{{deadline}}</strong>.</p>
  <a href="{{portalLink}}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">Complete Now →</a>
</div>
</body></html>
`)

export const reminderEmailsWorker = new Worker(
  'reminder-emails',
  async (job) => {
    const { activityId, orgId, daysLeft } = job.data as { activityId: string; orgId: string; daysLeft: number }
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: { org: true },
    })
    if (!activity || activity.status !== 'active') return

    const employees = await prisma.employee.findMany({
      where: { orgId, deletedAt: null, ...(activity.deptIds.length > 0 ? { deptId: { in: activity.deptIds } } : {}) },
      include: { completions: { where: { activityId } } },
    })

    const incomplete = employees.filter((e) => {
      const completedModuleIds = e.completions.map((c) => c.moduleId)
      return activity.moduleIds.some((m) => !completedModuleIds.includes(m))
    })

    const deadline = activity.deadline.toLocaleDateString('en-GB', { dateStyle: 'long' })
    const portalLink = `${process.env['APP_URL']}/portal`

    for (const emp of incomplete) {
      const remaining = activity.moduleIds.filter(
        (m) => !emp.completions.map((c) => c.moduleId).includes(m),
      ).length
      try {
        const html = REMINDER_TEMPLATE({
          employeeName: emp.name,
          daysLeft,
          remaining,
          deadline,
          portalLink,
        })
        await sendMail({
          to: emp.email,
          subject: `Reminder: ${remaining} security training module(s) due in ${daysLeft} days`,
          html,
          from: `${activity.org.senderName} <${activity.org.senderEmail}>`,
        })
      } catch (err) {
        logger.error({ msg: 'Reminder email failed', empId: emp.id, error: (err as Error).message })
      }
    }

    logger.info({ msg: 'Reminders sent', activityId, count: incomplete.length, daysLeft })
  },
  { connection: redis, concurrency: 2 },
)
