'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/lib/api'
import { PageHeader, Button, Select, Modal, StatusBadge } from '@/components/ui'
import { clsx } from 'clsx'
import { ChevronRight, Flag, MessageSquare, Plus } from 'lucide-react'

const CreateSchema = z.object({
  scenarioId: z.string().min(1),
  title: z.string().min(1),
  participants: z.string().min(1),
  difficulty: z.enum(['Basic', 'Intermediate', 'Advanced']),
})
type CreateForm = z.infer<typeof CreateSchema>

function PhaseBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'flex-1 h-2 rounded-full',
            i < current ? 'bg-green-500' :
            i === current ? 'bg-accent' : 'bg-surface-2',
          )}
        />
      ))}
    </div>
  )
}

function ExerciseCard({ exercise, onRefresh }: { exercise: any; onRefresh: () => void }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')

  const phaseMutation = useMutation({
    mutationFn: () => api.patch(`/exercises/${exercise.id}`, { currentPhase: exercise.currentPhase + 1 }),
    onSuccess: () => { toast.success('Phase advanced'); onRefresh() },
    onError: (e: any) => toast.error(e.message),
  })

  const endMutation = useMutation({
    mutationFn: () => api.post(`/exercises/${exercise.id}/end`),
    onSuccess: () => { toast.success('Exercise ended'); onRefresh() },
    onError: (e: any) => toast.error(e.message),
  })

  const saveNote = async () => {
    if (!note.trim()) return
    const existing = exercise.notes ?? {}
    const updated = { ...existing, [Date.now()]: note }
    await api.patch(`/exercises/${exercise.id}`, { notes: updated })
    setNote('')
    onRefresh()
    toast.success('Note saved')
  }

  const phaseNames = ['Identification', 'Containment', 'Eradication', 'Recovery']
  const isEnded = exercise.status === 'ended'

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-lg">{exercise.title}</h3>
          <p className="text-muted text-sm">{exercise.scenario?.title} · {exercise.participants}</p>
        </div>
        <StatusBadge status={exercise.status} />
      </div>

      <div className="p-6 space-y-6">
        {/* Phase bar */}
        <div>
          <div className="flex justify-between text-sm text-muted mb-2">
            <span>Phase {exercise.currentPhase + 1}/{exercise.scenario?.phases ?? 4}: {phaseNames[exercise.currentPhase] ?? 'Phase'}</span>
            <span>{Math.round((exercise.currentPhase / (exercise.scenario?.phases ?? 4)) * 100)}% complete</span>
          </div>
          <PhaseBar current={exercise.currentPhase} total={exercise.scenario?.phases ?? 4} />
        </div>

        {/* Opening inject */}
        {exercise.scenario?.openingInject && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">INJECT</p>
            <p className="text-amber-200 text-sm">{exercise.scenario.openingInject}</p>
          </div>
        )}

        {/* Notes */}
        <div>
          <h4 className="text-sm font-semibold text-muted-light mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" /> Facilitator Notes
          </h4>
          <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
            {Object.entries(exercise.notes ?? {}).map(([ts, text]) => (
              <div key={ts} className="bg-surface-2 rounded p-2">
                <p className="text-xs text-muted mb-0.5">{new Date(Number(ts)).toLocaleTimeString()}</p>
                <p className="text-sm text-white">{text as string}</p>
              </div>
            ))}
          </div>
          {!isEnded && (
            <div className="flex gap-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveNote()}
                placeholder="Add a note… (Enter to save)"
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              />
              <Button variant="secondary" onClick={saveNote}>Save</Button>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isEnded && (
          <div className="flex gap-3">
            {exercise.currentPhase < (exercise.scenario?.phases ?? 4) - 1 && (
              <Button onClick={() => phaseMutation.mutate()} loading={phaseMutation.isPending}>
                <ChevronRight className="w-4 h-4" /> Next Phase
              </Button>
            )}
            <Button variant="danger" onClick={() => endMutation.mutate()} loading={endMutation.isPending}>
              <Flag className="w-4 h-4" /> End Exercise
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TabletopPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: exercises, refetch } = useQuery({ queryKey: ['exercises'], queryFn: () => api.get<any>('/exercises') })
  const { data: scenarios } = useQuery({ queryKey: ['scenarios'], queryFn: () => api.get<any>('/scenarios') })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { difficulty: 'Intermediate' },
  })

  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => api.post('/exercises', d),
    onSuccess: () => { toast.success('Exercise started'); qc.invalidateQueries({ queryKey: ['exercises'] }); setCreateOpen(false); reset() },
    onError: (e: any) => toast.error(e.message),
  })

  const activeExercises = exercises?.data?.filter((e: any) => e.status === 'active') ?? []
  const pastExercises = exercises?.data?.filter((e: any) => e.status === 'ended') ?? []

  return (
    <div>
      <PageHeader
        title="Tabletop Exercises"
        sub="Facilitate cyber incident response exercises"
        action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Exercise</Button>}
      />

      {activeExercises.map((ex: any) => (
        <div key={ex.id} className="mb-4">
          <ExerciseCard exercise={ex} onRefresh={() => refetch()} />
        </div>
      ))}

      {pastExercises.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Past Exercises</h2>
          <div className="space-y-2">
            {pastExercises.map((ex: any) => (
              <div key={ex.id} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{ex.title}</p>
                  <p className="text-xs text-muted">{ex.scenario?.title} · {new Date(ex.startedAt).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={ex.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!exercises?.data?.length && (
        <div className="text-center py-16 text-muted">
          <p>No exercises yet. Start one to practice incident response.</p>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Tabletop Exercise">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Select label="Scenario" {...register('scenarioId')} error={errors.scenarioId?.message}>
            <option value="">Select a scenario…</option>
            {scenarios?.data?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.title} ({s.difficulty} · {s.durationMin}min)</option>
            ))}
          </Select>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-light">Exercise Title</label>
            <input {...register('title')} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="Q3 Ransomware Exercise" />
            {errors.title && <p className="text-red-400 text-xs">{errors.title.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-light">Participants</label>
            <input {...register('participants')} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" placeholder="IT Team, CISO, Legal" />
            {errors.participants && <p className="text-red-400 text-xs">{errors.participants.message}</p>}
          </div>
          <Select label="Difficulty" {...register('difficulty')}>
            <option value="Basic">Basic</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </Select>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMutation.isPending} className="flex-1">Start Exercise</Button>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
