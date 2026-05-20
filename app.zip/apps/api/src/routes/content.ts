import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { z } from 'zod'

export async function contentRoutes(app: FastifyInstance): Promise<void> {
  // ─── List content items with progress ──────────────────────────────────────
  app.get('/content', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const items = await prisma.contentItem.findMany({
      where: { orgId: request.user.orgId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        questions: { select: { id: true } },
        progress: { select: { employeeId: true, status: true, score: true } },
      },
    })

    const data = items.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      category: item.category,
      description: item.description,
      icon: item.icon,
      color: item.color,
      duration: item.duration,
      difficulty: item.difficulty,
      isSystem: item.isSystem,
      questionCount: item.questions.length,
      totalAssigned: item.progress.length,
      completedCount: item.progress.filter((p) => p.status === 'completed').length,
      avgScore: item.progress.filter((p) => p.score != null).length > 0
        ? Math.round(item.progress.filter((p) => p.score != null).reduce((sum, p) => sum + (p.score ?? 0), 0) / item.progress.filter((p) => p.score != null).length)
        : null,
    }))

    return { success: true, data }
  })

  // ─── Get single content item with questions ────────────────────────────────
  app.get('/content/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }

    const item = await prisma.contentItem.findFirst({
      where: { id, orgId: request.user.orgId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        progress: {
          select: { employeeId: true, status: true, score: true, startedAt: true, completedAt: true,
            employee: { select: { name: true, email: true } } },
        },
      },
    })

    if (!item) return { success: false, error: 'Content not found' }

    return { success: true, data: item }
  })

  // ─── Submit quiz answers ───────────────────────────────────────────────────
  const QuizSubmitSchema = z.object({
    contentId: z.string().min(1),
    employeeId: z.string().min(1),
    answers: z.record(z.string(), z.string()), // { questionId: answerId }
  })

  app.post('/content/quiz-submit', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const parsed = QuizSubmitSchema.safeParse(request.body)
    if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors }

    const { contentId, employeeId, answers } = parsed.data

    const item = await prisma.contentItem.findFirst({
      where: { id: contentId, orgId: request.user.orgId },
      include: { questions: true },
    })

    if (!item) return { success: false, error: 'Content not found' }

    // Score the quiz
    let correct = 0
    const results = item.questions.map((q) => {
      const userAnswer = answers[q.id]
      const isCorrect = userAnswer === q.correctAnswer
      if (isCorrect) correct++
      return { questionId: q.id, userAnswer, correctAnswer: q.correctAnswer, isCorrect, explanation: q.explanation }
    })

    const score = item.questions.length > 0 ? Math.round((correct / item.questions.length) * 100) : 0

    // Update or create progress
    await prisma.contentProgress.upsert({
      where: { contentId_employeeId: { contentId, employeeId } },
      update: { status: 'completed', score, completedAt: new Date() },
      create: { contentId, employeeId, status: 'completed', score, startedAt: new Date(), completedAt: new Date() },
    })

    return {
      success: true,
      data: { score, correct, total: item.questions.length, results },
    }
  })

  // ─── Mark content as started/completed ─────────────────────────────────────
  const ProgressSchema = z.object({
    contentId: z.string().min(1),
    employeeId: z.string().min(1),
    status: z.enum(['in_progress', 'completed']),
  })

  app.post('/content/progress', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const parsed = ProgressSchema.safeParse(request.body)
    if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors }

    const { contentId, employeeId, status } = parsed.data

    const progress = await prisma.contentProgress.upsert({
      where: { contentId_employeeId: { contentId, employeeId } },
      update: {
        status,
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
        ...(status === 'in_progress' ? { startedAt: new Date() } : {}),
      },
      create: {
        contentId, employeeId, status,
        startedAt: new Date(),
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
      },
    })

    return { success: true, data: progress }
  })

  // ─── Content stats ─────────────────────────────────────────────────────────
  app.get('/content/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const orgId = request.user.orgId
    const [totalItems, totalQuizzes, totalProgress, completedProgress] = await Promise.all([
      prisma.contentItem.count({ where: { orgId } }),
      prisma.contentItem.count({ where: { orgId, type: 'quiz' } }),
      prisma.contentProgress.count({ where: { content: { orgId } } }),
      prisma.contentProgress.count({ where: { content: { orgId }, status: 'completed' } }),
    ])

    return {
      success: true,
      data: {
        totalItems,
        totalQuizzes,
        totalProgress,
        completedProgress,
        completionRate: totalProgress > 0 ? Math.round((completedProgress / totalProgress) * 100) : 0,
      },
    }
  })
}
