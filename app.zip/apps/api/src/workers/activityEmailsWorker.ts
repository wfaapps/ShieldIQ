import { Worker } from 'bullmq'
import Handlebars from 'handlebars'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'
import { sendMail } from '../lib/email'
import { logger } from '../lib/logger'
import { reminderEmailsQueue } from './queues'

const LAUNCH_TEMPLATE = Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; background: #f4f4f4; }
  .container { max-width: 600px; margin: 30px auto; background: #fff; padding: 30px; border-radius: 8px; }
  .header { background: {{accentColor}}; color: #fff; padding: 20px; border-radius: 6px 6px 0 0; text-align: center; }
  .module { background: #f8f9fa; padding: 10px 15px; margin: 8px 0; border-radius: 4px; border-left: 4px solid {{accentColor}}; }
  .cta { display: inline-block; background: {{accentColor}}; color: #fff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
  .footer { color: #666; font-size: 12px; margin-top: 20px; }
</style></head>
<body>
<div class="container">
  <div class="header"><h2>{{orgName}} — Security Awareness Training</h2></div>
  <div style="padding: 20px;">
    <p>Hi {{employeeName}},</p>
    <p>{{emailBody}}</p>
    <p><strong>Modules to complete:</strong></p>
    {{#each modules}}
    <div class="module">{{this}}</div>
    {{/each}}
    <p><strong>Deadline:</strong> {{deadline}}</p>
    <a href="{{portalLink}}" class="cta">Start Training →</a>
  </div>
  <div class="footer"><p>This email was sent by {{orgName}} Information Security Team.</p></div>
</div>
</body></html>
`)

const REMINDER_TEMPLATE = Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; background: #f4f4f4; }
  .container { max-width: 600px; margin: 30px auto; background: #fff; padding: 30px; border-radius: 8px; }
  .header { background: #f59e0b; color: #fff; padding: 20px; border-radius: 6px 6px 0 0; text-align: center; }
  .cta { display: inline-block; background: #f59e0b; color: #fff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
</style></head>
<body>
<div class="container">
  <div class="header"><h2>Reminder: Security Training Due {{daysLeft}} Days</h2></div>
  <div style="padding: 20px;">
    <p>Hi {{employeeName}},</p>
    <p>You still have <strong>{{remaining}}</strong> module(s) to complete.</p>
    <p><strong>Deadline:</strong> {{deadline}}</p>
    <a href="{{portalLink}}" class="cta">Complete Training →</a>
  </div>
</div>
</body></html>
`)

export const activityEmailsWorker = new Worker(
  'activity-emails',
  async (job) => {
    const { activityId, orgId } = job.data as { activityId: string; orgId: string }
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: { org: true },
    })
    if (!activity) throw new Error(`Activity ${activityId} not found`)

    const modules = await prisma.module.findMany({
      where: { id: { in: activity.moduleIds }, orgId },
    })

    // Determine target employees
    let employees = await prisma.employee.findMany({
      where: {
        orgId,
        deletedAt: null,
        ...(activity.deptIds.length > 0 ? { deptId: { in: activity.deptIds } } : {}),
      },
    })

    const portalLink = `${process.env['APP_URL']}/portal`
    const deadline = activity.deadline.toLocaleDateString('en-GB', { dateStyle: 'long' })

    for (const emp of employees) {
      try {
        const html = LAUNCH_TEMPLATE({
          orgName: activity.org.name,
          accentColor: activity.org.accentColor,
          employeeName: emp.name,
          emailBody: activity.emailBody,
          modules: modules.map((m) => m.name),
          deadline,
          portalLink,
        })
        await sendMail({
          to: emp.email,
          subject: activity.emailSubject,
          html,
          from: `${activity.org.senderName} <${activity.org.senderEmail}>`,
        })
      } catch (err) {
        logger.error({ msg: 'Activity email failed', empId: emp.id, error: (err as Error).message })
      }
    }

    // Schedule Day 20 reminder
    const now = Date.now()
    const deadline20 = activity.deadline.getTime() - 20 * 24 * 60 * 60 * 1000
    if (deadline20 > now) {
      await reminderEmailsQueue.add('reminder', { activityId, orgId, daysLeft: 20 }, { delay: deadline20 - now })
    }

    logger.info({ msg: 'Activity launch emails sent', activityId, count: employees.length })
  },
  { connection: redis, concurrency: 2, limiter: { max: 50, duration: 60_000 } },
)
