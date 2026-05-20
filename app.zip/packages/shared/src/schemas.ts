import { z } from 'zod'

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(8).max(128),
})

export const MfaVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Must be a 6-digit code'),
})

// ─── Organisation ──────────────────────────────────────────────────────────────
export const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  senderEmail: z.string().email().max(254).optional(),
  senderName: z.string().min(1).max(100).optional(),
  appTitle: z.string().min(1).max(100).optional(),
})

// ─── Department ───────────────────────────────────────────────────────────────
export const CreateDeptSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3b82f6'),
})

// ─── Module ───────────────────────────────────────────────────────────────────
export const CreateModuleSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3b82f6'),
  sortOrder: z.number().int().min(0).optional(),
})

export const UpdateModuleSchema = CreateModuleSchema.partial().extend({
  enabled: z.boolean().optional(),
})

// ─── Employee ─────────────────────────────────────────────────────────────────
export const CreateEmployeeSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254).toLowerCase(),
  deptId: z.string().min(1),
  role: z.string().max(100).optional(),
})

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial()

// ─── Activity ─────────────────────────────────────────────────────────────────
export const CreateActivitySchema = z.object({
  name: z.string().min(1).max(200),
  scope: z.enum(['all', 'dept', 'custom', 'joiners']),
  deptIds: z.array(z.string().min(1)).default([]),
  moduleIds: z.array(z.string().min(1)).min(1),
  deadline: z.coerce.date(),
  channel: z.string().default('email'),
  emailSubject: z.string().min(1).max(300),
  emailBody: z.string().min(1).max(10000),
  launch: z.boolean().default(false),
})

export const UpdateActivitySchema = CreateActivitySchema.partial()

// ─── Campaign ─────────────────────────────────────────────────────────────────
export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.string().min(1),
  targetScope: z.string().min(1).max(100),
  landingPage: z.enum(['awareness', 'blank', 'custom']).default('awareness'),
  scheduledAt: z.coerce.date().optional(),
})

export const UpdateCampaignSchema = CreateCampaignSchema.partial()

// ─── Template ─────────────────────────────────────────────────────────────────
export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['phishing', 'awareness', 'social', 'custom']),
  description: z.string().max(1000).default(''),
  icon: z.string().max(10).default('📧'),
  subject: z.string().max(300).optional(),
  body: z.string().max(50000).optional(),
})

export const UpdateTemplateSchema = CreateTemplateSchema.partial()

// ─── Scenario ─────────────────────────────────────────────────────────────────
export const CreateScenarioSchema = z.object({
  title: z.string().min(1).max(200),
  phases: z.number().int().min(1).max(10).default(4),
  injectCount: z.number().int().min(1).max(20).default(5),
  durationMin: z.number().int().min(15).max(480).default(90),
  difficulty: z.enum(['Basic', 'Intermediate', 'Advanced']).default('Intermediate'),
  tags: z.array(z.string().max(50)).max(10).default([]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3b82f6'),
  openingInject: z.string().max(2000).optional(),
})

// ─── Exercise ─────────────────────────────────────────────────────────────────
export const CreateExerciseSchema = z.object({
  scenarioId: z.string().min(1),
  title: z.string().min(1).max(200),
  participants: z.string().min(1).max(500),
  difficulty: z.enum(['Basic', 'Intermediate', 'Advanced']),
})

export const UpdateExerciseSchema = z.object({
  currentPhase: z.number().int().min(0).max(10).optional(),
  notes: z.record(z.string(), z.unknown()).optional(),
  scorecard: z.record(z.string(), z.unknown()).optional(),
})

// ─── User management ──────────────────────────────────────────────────────────
export const CreateUserSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  name: z.string().min(1).max(200),
  role: z.enum(['admin', 'facilitator', 'viewer']),
  deptId: z.string().min(1).optional(),
  password: z.string().min(12).max(128),
})
