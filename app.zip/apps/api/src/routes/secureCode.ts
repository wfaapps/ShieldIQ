import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { z } from 'zod'

export async function secureCodeRoutes(app: FastifyInstance): Promise<void> {
  // ─── List all courses (with challenge counts & user progress) ──────────────
  app.get('/secure-code/courses', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const courses = await prisma.secureCodeCourse.findMany({
      where: { orgId: request.user.orgId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        challenges: {
          select: { id: true, points: true },
        },
      },
    })

    // Get all attempts for this org's employees
    const attempts = await prisma.challengeAttempt.findMany({
      where: {
        challenge: { course: { orgId: request.user.orgId } },
      },
      select: { challengeId: true, isCorrect: true, pointsEarned: true, employeeId: true },
    })

    const attemptMap = new Map<string, { total: number; correct: number }>()
    for (const a of attempts) {
      const key = a.challengeId
      const cur = attemptMap.get(key) ?? { total: 0, correct: 0 }
      cur.total++
      if (a.isCorrect) cur.correct++
      attemptMap.set(key, cur)
    }

    const data = courses.map((c) => {
      const totalChallenges = c.challenges.length
      const totalPoints = c.challenges.reduce((sum, ch) => sum + ch.points, 0)
      const challengeIds = c.challenges.map((ch) => ch.id)
      const completedChallenges = challengeIds.filter((id) => {
        const stats = attemptMap.get(id)
        return stats && stats.correct > 0
      }).length

      return {
        id: c.id,
        title: c.title,
        category: c.category,
        subcategory: c.subcategory,
        description: c.description,
        icon: c.icon,
        color: c.color,
        difficulty: c.difficulty,
        isSystem: c.isSystem,
        totalChallenges,
        totalPoints,
        completedChallenges,
        completionPct: totalChallenges > 0 ? Math.round((completedChallenges / totalChallenges) * 100) : 0,
      }
    })

    return { success: true, data }
  })

  // ─── Get single course with all challenges ─────────────────────────────────
  app.get('/secure-code/courses/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }

    const course = await prisma.secureCodeCourse.findFirst({
      where: { id, orgId: request.user.orgId },
      include: {
        challenges: {
          orderBy: { sortOrder: 'asc' },
          include: {
            attempts: {
              select: { employeeId: true, isCorrect: true, pointsEarned: true, answer: true },
            },
          },
        },
      },
    })

    if (!course) {
      return { success: false, error: 'Course not found' }
    }

    const employee = await prisma.employee.findUnique({
      where: { orgId_email: { orgId: request.user.orgId, email: request.user.email } },
    })

    const data = {
      ...course,
      challenges: course.challenges.map((ch) => {
        const userAttempt = ch.attempts.find((a) => a.employeeId === employee?.id)
        return {
          id: ch.id,
          title: ch.title,
          description: ch.description,
          type: ch.type,
          language: ch.language,
          codeSnippet: ch.codeSnippet,
          options: ch.options,
          correctAnswer: ch.correctAnswer,
          explanation: ch.explanation,
          points: ch.points,
          sortOrder: ch.sortOrder,
          totalAttempts: ch.attempts.length,
          correctAttempts: ch.attempts.filter((a) => a.isCorrect).length,
          userAttempt: userAttempt ? { answer: userAttempt.answer, isCorrect: userAttempt.isCorrect } : null,
        }
      }),
    }

    return { success: true, data }
  })

  // ─── Submit a challenge attempt ────────────────────────────────────────────
  const AttemptSchema = z.object({
    challengeId: z.string().min(1),
    employeeId: z.string().min(1),
    answer: z.string().min(1),
  })

  app.post('/secure-code/attempt', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const parsed = AttemptSchema.safeParse(request.body)
    if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors }

    const { challengeId, answer } = parsed.data

    let employee = await prisma.employee.findUnique({
      where: { orgId_email: { orgId: request.user.orgId, email: request.user.email } },
    })

    if (!employee) {
      // Auto-create employee profile for admins testing the system
      const firstDept = await prisma.department.findFirst({ where: { orgId: request.user.orgId } })
      if (!firstDept) {
        return { success: false, error: 'Employee profile not found and could not be auto-created.' }
      }
      employee = await prisma.employee.create({
        data: {
          orgId: request.user.orgId,
          deptId: firstDept.id,
          name: request.user.name,
          email: request.user.email,
          role: 'Admin / Tester',
        }
      })
    }

    const employeeId = employee.id

    const challenge = await prisma.codeChallenge.findUnique({
      where: { id: challengeId },
      include: { course: { select: { orgId: true } } },
    })

    if (!challenge || challenge.course.orgId !== request.user.orgId) {
      return { success: false, error: 'Challenge not found' }
    }

    // Check if already attempted
    const existing = await prisma.challengeAttempt.findUnique({
      where: { challengeId_employeeId: { challengeId, employeeId } },
    })

    if (existing) {
      return {
        success: true,
        data: {
          alreadyAttempted: true,
          isCorrect: existing.isCorrect,
          pointsEarned: existing.pointsEarned,
          correctAnswer: challenge.correctAnswer,
          explanation: challenge.explanation,
        },
      }
    }

    const isCorrect = answer.trim().toLowerCase() === challenge.correctAnswer.trim().toLowerCase()
    const pointsEarned = isCorrect ? challenge.points : 0

    await prisma.challengeAttempt.create({
      data: { challengeId, employeeId, answer, isCorrect, pointsEarned },
    })

    return {
      success: true,
      data: {
        alreadyAttempted: false,
        isCorrect,
        pointsEarned,
        correctAnswer: challenge.correctAnswer,
        explanation: challenge.explanation,
      },
    }
  })

  // ─── Leaderboard ───────────────────────────────────────────────────────────
  app.get('/secure-code/leaderboard', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const attempts = await prisma.challengeAttempt.findMany({
      where: {
        challenge: { course: { orgId: request.user.orgId } },
        isCorrect: true,
      },
      select: {
        employeeId: true,
        pointsEarned: true,
        employee: { select: { name: true, email: true, role: true, dept: { select: { name: true } } } },
      },
    })

    const leaderMap = new Map<string, { name: string; email: string; role: string | null; dept: string; points: number; solved: number }>()
    for (const a of attempts) {
      const cur = leaderMap.get(a.employeeId) ?? {
        name: a.employee.name,
        email: a.employee.email,
        role: a.employee.role,
        dept: a.employee.dept.name,
        points: 0,
        solved: 0,
      }
      cur.points += a.pointsEarned
      cur.solved++
      leaderMap.set(a.employeeId, cur)
    }

    const data = Array.from(leaderMap.entries())
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 50)

    return { success: true, data }
  })

  // ─── Stats for dashboard ───────────────────────────────────────────────────
  app.get('/secure-code/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })

    const orgId = request.user.orgId
    const [totalCourses, totalChallenges, totalAttempts, correctAttempts] = await Promise.all([
      prisma.secureCodeCourse.count({ where: { orgId } }),
      prisma.codeChallenge.count({ where: { course: { orgId } } }),
      prisma.challengeAttempt.count({ where: { challenge: { course: { orgId } } } }),
      prisma.challengeAttempt.count({ where: { challenge: { course: { orgId } }, isCorrect: true } }),
    ])

    return {
      success: true,
      data: {
        totalCourses,
        totalChallenges,
        totalAttempts,
        correctAttempts,
        accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
      },
    }
  })
}
