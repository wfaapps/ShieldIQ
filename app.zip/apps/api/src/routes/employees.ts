import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { stringify } from 'csv-stringify/sync'
import { parse } from 'csv-parse/sync'
import { prisma } from '../lib/prisma'
import { writeAuditLog } from '../middleware/audit'
import { CreateEmployeeSchema, UpdateEmployeeSchema } from '@shieldiq/shared'

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  // GET /employees
  app.get('/employees', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const query = z.object({
      search: z.string().max(200).optional(),
      dept: z.string().optional(),
      status: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(50),
    }).safeParse(request.query)
    if (!query.success) return reply.status(400).send({ success: false, error: 'Invalid query' })

    const { search, dept, page, pageSize } = query.data
    const where: Record<string, unknown> = { orgId: request.user.orgId, deletedAt: null }
    if (dept) where['deptId'] = dept
    if (search) {
      where['OR'] = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: { dept: true, completions: { include: { activity: { select: { moduleIds: true, status: true } } } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const data = employees.map((e) => {
      const activeActivities = e.completions.filter((c) => c.activity.status === 'active')
      const totalModules = activeActivities.reduce((acc, c) => acc + c.activity.moduleIds.length, 0)
      const doneModules = new Set(activeActivities.map((c) => c.moduleId)).size
      const status =
        totalModules === 0 ? 'not_started' :
        doneModules >= totalModules ? 'completed' :
        doneModules > 0 ? 'in_progress' : 'not_started'
      return { id: e.id, name: e.name, email: e.email, role: e.role, dept: e.dept, status, doneModules, totalModules }
    })

    return reply.send({ success: true, data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  })

  // POST /employees
  app.post('/employees', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const body = CreateEmployeeSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    // Verify dept belongs to org
    const dept = await prisma.department.findFirst({ where: { id: body.data.deptId, orgId: request.user.orgId } })
    if (!dept) return reply.status(404).send({ success: false, error: 'Department not found' })

    const employee = await prisma.employee.create({
      data: { ...body.data, orgId: request.user.orgId },
      include: { dept: true },
    })
    await writeAuditLog(request, { action: 'employee.created', resource: 'Employee', resourceId: employee.id })
    return reply.status(201).send({ success: true, data: employee })
  })

  // PATCH /employees/:id
  app.patch('/employees/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const existing = await prisma.employee.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Not found' })

    const body = UpdateEmployeeSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() })

    if (body.data.deptId) {
      const dept = await prisma.department.findFirst({ where: { id: body.data.deptId, orgId: request.user.orgId } })
      if (!dept) return reply.status(404).send({ success: false, error: 'Department not found' })
    }

    const updated = await prisma.employee.update({ where: { id }, data: body.data, include: { dept: true } })
    await writeAuditLog(request, { action: 'employee.updated', resource: 'Employee', resourceId: id })
    return reply.send({ success: true, data: updated })
  })

  // DELETE /employees/:id — soft delete
  app.delete('/employees/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const { id } = request.params as { id: string }
    const existing = await prisma.employee.findFirst({ where: { id, orgId: request.user.orgId } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Not found' })

    await prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } })
    await writeAuditLog(request, { action: 'employee.deleted', resource: 'Employee', resourceId: id })
    return reply.send({ success: true })
  })

  // POST /employees/import — CSV bulk import
  app.post('/employees/import', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const data = await request.file()
    if (!data) return reply.status(400).send({ success: false, error: 'No file uploaded' })
    if (data.mimetype !== 'text/csv' && !data.filename.endsWith('.csv')) {
      return reply.status(400).send({ success: false, error: 'Only CSV files allowed' })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
      if (Buffer.concat(chunks).length > 5 * 1024 * 1024) {
        return reply.status(413).send({ success: false, error: 'File too large (max 5MB)' })
      }
    }
    const csvContent = Buffer.concat(chunks).toString('utf8')

    const rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true })
    const depts = await prisma.department.findMany({ where: { orgId: request.user.orgId } })
    const deptMap = new Map(depts.map((d) => [d.name.toLowerCase(), d.id]))

    let created = 0
    const errors: string[] = []
    for (const [i, row] of rows.entries()) {
      const parsed = CreateEmployeeSchema.safeParse({
        name: row.name ?? row.Name,
        email: (row.email ?? row.Email ?? '').toLowerCase(),
        deptId: deptMap.get((row.department ?? row.Department ?? '').toLowerCase()),
        role: row.role ?? row.Role,
      })
      if (!parsed.success) { errors.push(`Row ${i + 2}: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`); continue }
      if (!parsed.data.deptId) { errors.push(`Row ${i + 2}: Department not found`); continue }

      await prisma.employee.upsert({
        where: { orgId_email: { orgId: request.user.orgId, email: parsed.data.email } },
        update: { name: parsed.data.name, deptId: parsed.data.deptId, role: parsed.data.role, deletedAt: null },
        create: { ...parsed.data, orgId: request.user.orgId },
      })
      created++
    }

    await writeAuditLog(request, { action: 'employee.import', resource: 'Employee', meta: { count: created } })
    return reply.send({ success: true, data: { created, errors } })
  })

  // GET /employees/export — CSV download
  app.get('/employees/export', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: 'Unauthorized' })
    const employees = await prisma.employee.findMany({
      where: { orgId: request.user.orgId, deletedAt: null },
      include: { dept: true },
      orderBy: { name: 'asc' },
    })

    const csv = stringify(
      employees.map((e) => ({ name: e.name, email: e.email, department: e.dept.name, role: e.role ?? '' })),
      { header: true },
    )

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="employees.csv"')
      .send(csv)
  })
}
