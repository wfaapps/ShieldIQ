import { Queue } from 'bullmq'
import { redis } from '../lib/redis'

const connection = redis

export const activityEmailsQueue = new Queue('activity-emails', { connection })
export const campaignEmailsQueue = new Queue('campaign-emails', { connection })
export const reminderEmailsQueue = new Queue('reminder-emails', { connection })
export const reportGenerationQueue = new Queue('report-generation', { connection })
