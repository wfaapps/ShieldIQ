import { Worker } from 'bullmq'
import Handlebars from 'handlebars'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'
import { sendMail } from '../lib/email'
import { signPhishToken } from '../lib/crypto'
import { logger } from '../lib/logger'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'

export const campaignEmailsWorker = new Worker(
  'campaign-emails',
  async (job) => {
    const { campaignId, orgId } = job.data as { campaignId: string; orgId: string }
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { template: true, org: true },
    })
    if (!campaign?.template.body) throw new Error(`Campaign ${campaignId} or template missing`)

    const targetEmployees =
      campaign.targetScope === 'all'
        ? await prisma.employee.findMany({ where: { orgId, deletedAt: null } })
        : await prisma.employee.findMany({ where: { orgId, deptId: campaign.targetScope, deletedAt: null } })

    for (const emp of targetEmployees) {
      try {
        const openToken = signPhishToken({ campaignId, employeeId: emp.id, action: 'opened' })
        const clickToken = signPhishToken({ campaignId, employeeId: emp.id, action: 'clicked' })

        // Rewrite links in body to track clicks
        const trackingPixel = `<img src="${APP_URL}/api/v1/track/open/${openToken}" width="1" height="1" alt="" />`
        let body = campaign.template.body.replace(
          /href="(https?:\/\/[^"]+)"/g,
          (_, url: string) => `href="${APP_URL}/api/v1/track/click/${clickToken}?url=${encodeURIComponent(url)}"`,
        )
        body += trackingPixel

        const compiledBody = Handlebars.compile(body)({ name: emp.name, email: emp.email, org: campaign.org.name })

        await sendMail({
          to: emp.email,
          subject: campaign.template.subject ?? 'Important Security Notice',
          html: compiledBody,
          from: `${campaign.org.senderName} <${campaign.org.senderEmail}>`,
        })
      } catch (err) {
        logger.error({ msg: 'Campaign email failed', empId: emp.id, error: (err as Error).message })
      }
    }

    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'sent', sentAt: new Date() } })
    logger.info({ msg: 'Campaign emails sent', campaignId, count: targetEmployees.length })
  },
  { connection: redis, concurrency: 1, limiter: { max: 50, duration: 60_000 } },
)
