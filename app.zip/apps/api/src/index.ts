import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { logger } from './lib/logger'
import { redis } from './lib/redis'
import { authenticate } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboard'
import { activityRoutes } from './routes/activities'
import { campaignRoutes } from './routes/campaigns'
import { templateRoutes } from './routes/templates'
import { phishRoutes } from './routes/phish'
import { exerciseRoutes } from './routes/exercises'
import { employeeRoutes } from './routes/employees'
import { settingsRoutes } from './routes/settings'
import { secureCodeRoutes } from './routes/secureCode'
import { contentRoutes } from './routes/content'
import { portalRoutes } from './routes/portal'
import { demoRoutes } from './routes/demo'
import { activityEmailsWorker } from './workers/activityEmailsWorker'
import { campaignEmailsWorker } from './workers/campaignEmailsWorker'
import { reminderEmailsWorker } from './workers/reminderEmailsWorker'

const PORT = Number(process.env['PORT'] ?? 3001)
const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'

async function build() {
  const app = Fastify({ logger: { level: 'warn' }, trustProxy: true })

  // ─── Security headers ───────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Allow the qrserver.com QR code image used by the MFA setup flow only.
        // No script or iframe permissions to that origin — image-only.
        imgSrc: ["'self'", 'data:', 'blob:', 'https://api.qrserver.com'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })

  // ─── CORS ───────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: APP_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // ─── Cookie ─────────────────────────────────────────────────────────────────
  await app.register(cookie, {
    secret: process.env['SESSION_SECRET'] ?? 'CHANGE_ME',
  })

  // ─── Rate limiting ──────────────────────────────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => req.ip,
  })

  // ─── Multipart (file uploads) ───────────────────────────────────────────────
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  })

  // ─── Auth decorator ─────────────────────────────────────────────────────────
  app.decorate('authenticate', authenticate)

  // ─── Routes ─────────────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/v1' })
  await app.register(dashboardRoutes, { prefix: '/api/v1' })
  await app.register(activityRoutes, { prefix: '/api/v1' })
  await app.register(campaignRoutes, { prefix: '/api/v1' })
  await app.register(templateRoutes, { prefix: '/api/v1' })
  await app.register(phishRoutes, { prefix: '/api/v1' })
  await app.register(exerciseRoutes, { prefix: '/api/v1' })
  await app.register(employeeRoutes, { prefix: '/api/v1' })
  await app.register(settingsRoutes, { prefix: '/api/v1' })
  await app.register(secureCodeRoutes, { prefix: '/api/v1' })
  await app.register(contentRoutes, { prefix: '/api/v1' })
  await app.register(portalRoutes, { prefix: '/api/v1' })
  await app.register(demoRoutes, { prefix: '/api/v1' })

  // ─── Health check ────────────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    version: process.env['npm_package_version'] ?? '1.0.0',
    uptime: process.uptime(),
  }))

  return app
}

async function main() {
  try {
    const app = await build()
    await app.listen({ port: PORT, host: '0.0.0.0' })
    logger.info({ msg: 'ShieldIQ API started', port: PORT })

    // Workers start alongside the API
    logger.info({ msg: 'BullMQ workers started' })
  } catch (err) {
    logger.error({ msg: 'Startup failed', error: (err as Error).message })
    process.exit(1)
  }
}

main()
