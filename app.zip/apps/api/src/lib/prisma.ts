import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
    ],
  })

prisma.$on('error', (e) => {
  logger.error({ msg: 'Prisma error', error: e.message })
})

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma
}
