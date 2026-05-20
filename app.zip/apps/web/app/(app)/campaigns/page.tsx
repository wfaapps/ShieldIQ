'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/lib/api'
import { PageHeader, Button, Input, Select, StatusBadge, Modal, MetricCard } from '@/components/ui'
import { Plus, Send, Mail } from 'lucide-react'

const CreateSchema = z.object({
  name: z.string().min(1),
  templateId: z.string().min(1),
  targetScope: z.string().min(1),
  landingPage: z.enum(['awareness', 'blank', 'custom']).default('awareness'),
  scheduledAt: z.string().optional(),
})
type CreateForm = z.infer<typeof CreateSchema>

export default function CampaignsPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: campaigns } = useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<any>('/campaigns') })
  const { data: stats } = useQuery({ queryKey: ['campaign-stats'], queryFn: () => api.get<any>('/campaigns/stats') })
  const { data: templates } = useQuery({ queryKey: ['phish-templates'], queryFn: () => api.get<any>('/templates?category=phishing') })
  const { data: depts } = useQuery({ queryKey: ['depts'], queryFn: () => api.get<any>('/org/departments') })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { targetScope: 'all', landingPage: 'awareness' },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => api.post('/campaigns', data),
    onSuccess: () => { toast.success('Campaign created'); qc.invalidateQueries({ queryKey: ['campaigns'] }); setCreateOpen(false); reset() },
    onError: (e: any) => toast.error(e.message),
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/send`),
    onSuccess: () => { toast.success('Campaign sending…'); qc.invalidateQueries({ queryKey: ['campaigns'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  const s = stats?.data

  return (
    <div>
      <PageHeader
        title="Phishing Campaigns"
        sub="Run simulated phishing campaigns to measure and improve employee awareness"
        action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Campaign</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Emails Sent" value={s?.sent ?? 0} />
        <MetricCard label="Open Rate" value={`${s?.openRate ?? 0}%`} color="text-blue-400" />
        <MetricCard label="Click Rate" value={`${s?.clickRate ?? 0}%`} color={s?.clickRate > 20 ? 'text-red-400' : 'text-green-400'} />
        <MetricCard label="Report Rate" value={`${s?.reportRate ?? 0}%`} color="text-green-400" sub="Employees who reported" />
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-muted font-medium">Campaign</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Template</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
              <th className="text-right px-4 py-3 text-muted font-medium">Sent</th>
              <th className="text-right px-4 py-3 text-muted font-medium">Clicked</th>
              <th className="text-right px-4 py-3 text-muted font-medium">Click %</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {campaigns?.data?.map((c: any) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                <td className="px-4 py-3 text-muted-light">{c.templateIcon} {c.templateName}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-right text-muted-light">{c.sent}</td>
                <td className="px-4 py-3 text-right text-muted-light">{c.clicked}</td>
                <td className={`px-4 py-3 text-right font-medium ${c.clickRate > 20 ? 'text-red-400' : 'text-green-400'}`}>{c.clickRate}%</td>
                <td className="px-4 py-3 text-right">
                  {['draft', 'scheduled'].includes(c.status) && (
                    <Button variant="secondary" className="text-xs py-1 px-2" onClick={() => sendMutation.mutate(c.id)}>
                      <Send className="w-3 h-3" /> Send
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!campaigns?.data?.length && (
              <tr><td colSpan={7} className="text-center py-12 text-muted">
                <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No campaigns yet</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Phishing Campaign">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Input label="Campaign Name" {...register('name')} error={errors.name?.message} placeholder="Q3 Phishing Simulation" />

          <Select label="Phishing Template" {...register('templateId')} error={errors.templateId?.message}>
            <option value="">Select a template…</option>
            {templates?.data?.map((t: any) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
          </Select>

          <Select label="Target Audience" {...register('targetScope')} error={errors.targetScope?.message}>
            <option value="all">All Employees</option>
            {depts?.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name} department</option>)}
          </Select>

          <Select label="Landing Page" {...register('landingPage')}>
            <option value="awareness">Awareness Training Page</option>
            <option value="blank">Blank Page</option>
            <option value="teachable">Teachable Moment (Interactive Redirection)</option>
          </Select>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMutation.isPending} className="flex-1">Create Campaign</Button>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
