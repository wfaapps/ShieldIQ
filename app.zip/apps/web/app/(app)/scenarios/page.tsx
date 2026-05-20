'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { PageHeader, Button, Input, Select, Modal } from '@/components/ui'
import { Plus, Lock, Clock, Zap, Tag, Play } from 'lucide-react'
import { clsx } from 'clsx'

const StartExerciseSchema = z.object({
  scenarioId: z.string().min(1),
  title: z.string().min(1),
  participants: z.string().min(1),
  difficulty: z.enum(['Basic', 'Intermediate', 'Advanced']),
})
type StartExerciseForm = z.infer<typeof StartExerciseSchema>

const CreateSchema = z.object({
  title: z.string().min(1),
  phases: z.coerce.number().int().min(1).max(10).default(4),
  injectCount: z.coerce.number().int().min(1).max(20).default(5),
  durationMin: z.coerce.number().int().min(15).max(480).default(90),
  difficulty: z.enum(['Basic', 'Intermediate', 'Advanced']).default('Intermediate'),
  color: z.string().default('#3b82f6'),
  openingInject: z.string().optional(),
  tags: z.array(z.string()).default([]),
})
type CreateForm = z.infer<typeof CreateSchema>

const difficultyColor: Record<string, string> = {
  Basic: 'bg-green-500/15 text-green-400',
  Intermediate: 'bg-yellow-500/15 text-yellow-400',
  Advanced: 'bg-red-500/15 text-red-400',
}

export default function ScenariosPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [startScenario, setStartScenario] = useState<any>(null)

  const { data: scenarios } = useQuery({ queryKey: ['scenarios'], queryFn: () => api.get<any>('/scenarios') })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
  })

  const startForm = useForm<StartExerciseForm>({
    resolver: zodResolver(StartExerciseSchema),
  })

  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => api.post('/scenarios', d),
    onSuccess: () => { toast.success('Scenario created'); qc.invalidateQueries({ queryKey: ['scenarios'] }); setCreateOpen(false); reset() },
    onError: (e: any) => toast.error(e.message),
  })

  const startMutation = useMutation({
    mutationFn: (d: StartExerciseForm) => api.post('/exercises', d),
    onSuccess: () => { toast.success('Exercise started'); router.push('/tabletop') },
    onError: (e: any) => toast.error(e.message),
  })

  const openStartModal = (scenario: any) => {
    setStartScenario(scenario)
    startForm.reset({
      scenarioId: scenario.id,
      title: `${scenario.title} Exercise`,
      participants: 'IT Team, Security',
      difficulty: scenario.difficulty,
    })
  }

  return (
    <div>
      <PageHeader
        title="Scenario Library"
        sub="Built-in and custom tabletop exercise scenarios"
        action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Add Custom Scenario</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios?.data?.map((s: any) => (
          <div
            key={s.id}
            className="bg-surface border border-border rounded-xl p-5 hover:border-accent/40 transition-colors cursor-pointer group relative"
            onClick={() => openStartModal(s)}
          >
            <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="primary" className="h-7 text-xs px-2 py-0 shadow-md">
                <Play className="w-3 h-3 mr-1" /> Start
              </Button>
            </div>
            <div className="flex items-start justify-between mb-3 pr-16">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}20` }}>
                <Zap className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div className="flex items-center gap-2">
                {s.isSystem && <Lock className="w-3 h-3 text-muted" />}
                <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', difficultyColor[s.difficulty] ?? 'bg-gray-500/15 text-gray-400')}>
                  {s.difficulty}
                </span>
              </div>
            </div>
            <h3 className="font-semibold text-white mb-1">{s.title}</h3>
            {s.openingInject && (
              <p className="text-xs text-muted mb-3 line-clamp-2">{s.openingInject}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.durationMin}min</span>
              <span>{s.phases} phases</span>
              <span>{s.injectCount} injects</span>
            </div>
            {s.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {s.tags.map((tag: string) => (
                  <span key={tag} className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" />{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {!scenarios?.data?.length && (
          <div className="col-span-3 text-center py-12 text-muted">No scenarios found</div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Custom Scenario" wide>
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Input label="Scenario Title" {...register('title')} error={errors.title?.message} placeholder="Supply Chain Compromise" />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Phases" type="number" {...register('phases')} min={1} max={10} />
            <Input label="Injects" type="number" {...register('injectCount')} min={1} max={20} />
            <Input label="Duration (min)" type="number" {...register('durationMin')} min={15} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Difficulty" {...register('difficulty')}>
              <option value="Basic">Basic</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </Select>
            <Input label="Colour" type="color" {...register('color')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-light mb-1">Opening Inject</label>
            <textarea {...register('openingInject')} rows={3} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" placeholder="It is Monday morning. Your SOC reports unusual network activity…" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMutation.isPending} className="flex-1">Create Scenario</Button>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!startScenario} onClose={() => setStartScenario(null)} title="Start Tabletop Exercise">
        {startScenario && (
          <form onSubmit={startForm.handleSubmit((d) => startMutation.mutate(d))} className="space-y-4">
            <div className="bg-surface-2 p-3 rounded-lg mb-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${startScenario.color}20` }}>
                <Zap className="w-4 h-4" style={{ color: startScenario.color }} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{startScenario.title}</p>
                <p className="text-xs text-muted">{startScenario.durationMin}min · {startScenario.phases} phases</p>
              </div>
            </div>
            <input type="hidden" {...startForm.register('scenarioId')} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-muted-light">Exercise Title</label>
              <input {...startForm.register('title')} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
              {startForm.formState.errors.title && <p className="text-red-400 text-xs">{startForm.formState.errors.title.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-muted-light">Participants</label>
              <input {...startForm.register('participants')} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
              {startForm.formState.errors.participants && <p className="text-red-400 text-xs">{startForm.formState.errors.participants.message}</p>}
            </div>
            <Select label="Difficulty Override" {...startForm.register('difficulty')}>
              <option value="Basic">Basic</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </Select>
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={startMutation.isPending} className="flex-1">Start Exercise</Button>
              <Button type="button" variant="secondary" onClick={() => setStartScenario(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
