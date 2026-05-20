'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/lib/api'
import { PageHeader, Button, Input, Select, StatusBadge, Modal } from '@/components/ui'
import { Plus, CheckSquare, Calendar, Send } from 'lucide-react'

const CreateSchema = z.object({
  name: z.string().min(1),
  scope: z.enum(['all', 'dept', 'custom', 'joiners']),
  deptIds: z.array(z.string()).default([]),
  moduleIds: z.array(z.string()).min(1, 'Select at least one module'),
  deadline: z.string().min(1),
  emailSubject: z.string().min(1),
  emailBody: z.string().min(1),
  launch: z.boolean().default(false),
})
type CreateForm = z.infer<typeof CreateSchema>

export default function AwarenessPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: activities } = useQuery({ queryKey: ['activities'], queryFn: () => api.get<any>('/activities') })
  const { data: modules } = useQuery({ queryKey: ['modules'], queryFn: () => api.get<any>('/org/modules') })
  const { data: depts } = useQuery({ queryKey: ['depts'], queryFn: () => api.get<any>('/org/departments') })

  const { register, handleSubmit, control, formState: { errors }, reset, watch } = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { scope: 'all', moduleIds: [], deptIds: [], launch: false },
  })

  const scope = watch('scope')

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => {
      // Convert datetime-local format to ISO 8601 for the API
      const payload = {
        ...data,
        deadline: new Date(data.deadline).toISOString(),
      }
      return api.post('/activities', payload)
    },
    onSuccess: () => {
      toast.success('Activity created')
      qc.invalidateQueries({ queryKey: ['activities'] })
      setCreateOpen(false)
      reset()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const launchMutation = useMutation({
    mutationFn: (id: string) => api.post(`/activities/${id}/launch`),
    onSuccess: () => { toast.success('Activity launched — emails queued'); qc.invalidateQueries({ queryKey: ['activities'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div>
      <PageHeader
        title="IS Awareness"
        sub="Create and manage security awareness training activities"
        action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Activity</Button>}
      />

      <div className="space-y-3">
        {activities?.data?.map((act: any) => (
          <div key={act.id} className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-semibold text-white">{act.name}</h3>
                <StatusBadge status={act.status} />
              </div>
              <p className="text-sm text-muted">
                {act.moduleIds?.length} module(s) · Deadline: {new Date(act.deadline).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {act.status === 'draft' && (
                <Button variant="secondary" onClick={() => launchMutation.mutate(act.id)} loading={launchMutation.isPending}>
                  <Send className="w-4 h-4" /> Launch
                </Button>
              )}
            </div>
          </div>
        ))}
        {!activities?.data?.length && (
          <div className="text-center py-16 text-muted">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No awareness activities yet. Create one to get started.</p>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Awareness Activity" wide>
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Input label="Activity Name" {...register('name')} error={errors.name?.message} placeholder="Q3 Phishing Awareness" />

          <Select label="Scope" {...register('scope')} error={errors.scope?.message}>
            <option value="all">All Employees</option>
            <option value="dept">By Department</option>
            <option value="joiners">New Joiners</option>
            <option value="custom">Custom Selection</option>
          </Select>

          {(scope === 'dept' || scope === 'custom') && (
            <div>
              <label className="block text-sm font-medium text-muted-light mb-1">Departments</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {depts?.data?.map((d: any) => (
                  <Controller key={d.id} control={control} name="deptIds" render={({ field }) => (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={d.id}
                        checked={field.value.includes(d.id)}
                        onChange={(e) => {
                          const next = e.target.checked ? [...field.value, d.id] : field.value.filter((v: string) => v !== d.id)
                          field.onChange(next)
                        }}
                        className="accent-accent"
                      />
                      <span className="text-sm text-muted-light">{d.name}</span>
                    </label>
                  )} />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted-light mb-1">Training Modules</label>
            {errors.moduleIds && <p className="text-red-400 text-xs mb-1">{errors.moduleIds.message}</p>}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {modules?.data?.filter((m: any) => m.enabled).map((m: any) => (
                <Controller key={m.id} control={control} name="moduleIds" render={({ field }) => (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      value={m.id}
                      checked={field.value.includes(m.id)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...field.value, m.id] : field.value.filter((v: string) => v !== m.id)
                        field.onChange(next)
                      }}
                      className="accent-accent"
                    />
                    <span className="text-sm text-muted-light">{m.name}</span>
                  </label>
                )} />
              ))}
            </div>
          </div>

          <Input label="Deadline" type="datetime-local" {...register('deadline')} error={errors.deadline?.message} />
          <Input label="Email Subject" {...register('emailSubject')} error={errors.emailSubject?.message} placeholder="Your security training is now available" />

          <div>
            <label className="block text-sm font-medium text-muted-light mb-1">Email Body</label>
            <textarea
              {...register('emailBody')}
              rows={4}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none"
              placeholder="Please complete your assigned security awareness modules..."
            />
            {errors.emailBody && <p className="text-red-400 text-xs">{errors.emailBody.message}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="launch" {...register('launch')} className="accent-accent" />
            <label htmlFor="launch" className="text-sm text-muted-light cursor-pointer">Launch immediately (send emails now)</label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMutation.isPending} className="flex-1">Create Activity</Button>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
