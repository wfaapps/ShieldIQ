export type UserRole = 'superadmin' | 'admin' | 'facilitator' | 'viewer'
export type ActivityStatus = 'draft' | 'active' | 'closed'
export type CampaignStatus = 'draft' | 'scheduled' | 'sent' | 'active'
export type PhishAction = 'opened' | 'clicked' | 'submitted' | 'reported'
export type TemplateCategory = 'phishing' | 'awareness' | 'social' | 'custom'
export type ActivityScope = 'all' | 'dept' | 'custom' | 'joiners'
export type ExerciseStatus = 'active' | 'ended'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
