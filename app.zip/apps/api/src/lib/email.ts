import nodemailer from 'nodemailer'
import { logger } from './logger'

let transporter: nodemailer.Transporter | null = null

export async function sendMail(opts: {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}): Promise<void> {
  if (!transporter) {
    if (process.env['SMTP_HOST']) {
      transporter = nodemailer.createTransport({
        host: process.env['SMTP_HOST'],
        port: Number(process.env['SMTP_PORT'] ?? 587),
        secure: process.env['SMTP_PORT'] === '465',
        auth: {
          user: process.env['SMTP_USER'],
          pass: process.env['SMTP_PASS'],
        },
        tls: {
          rejectUnauthorized: process.env['NODE_ENV'] === 'production',
        },
      })
    } else {
      // Create Ethereal test account for live demo without config
      logger.info('No SMTP config found. Creating Ethereal test account...')
      const testAccount = await nodemailer.createTestAccount()
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      })
      logger.info('Ethereal test account created!')
    }
  }

  try {
    const info = await transporter.sendMail({
      from: opts.from ?? process.env['SMTP_FROM'] ?? 'security@company.com',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })

    if (!process.env['SMTP_HOST']) {
      const url = nodemailer.getTestMessageUrl(info)
      console.log('\n======================================================')
      console.log('📬 LIVE DEMO EMAIL SENT!')
      console.log('To: ', opts.to)
      console.log('Subject: ', opts.subject)
      console.log('👀 VIEW THE LIVE EMAIL HERE: ', url)
      console.log('======================================================\n')
    }
  } catch (err) {
    logger.error({ msg: 'Email send failed', to: opts.to, error: (err as Error).message })
    throw err
  }
}
