'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui'
import { clsx } from 'clsx'
import { ArrowLeft, Check, X, Code2, Lock, Trophy, Lightbulb } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'

const langColors: Record<string, { bg: string; text: string; label: string }> = {
  javascript: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'JavaScript' },
  python: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Python' },
  java: { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'Java' },
  sql: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'SQL' },
  html: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'HTML' },
  csharp: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'C#' },
}

function ChallengeCard({
  courseId,
  challenge,
  index,
  correctAnswer,
  explanation,
  onAnswer,
}: {
  courseId: string
  challenge: any
  index: number
  correctAnswer: string
  explanation: string
  onAnswer: (isCorrect: boolean) => void
}) {
  const [selected, setSelected] = useState<string | null>(challenge.userAttempt?.answer ?? null)
  const [submitted, setSubmitted] = useState(!!challenge.userAttempt)
  const [showExplanation, setShowExplanation] = useState(false)
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const submitMutation = useMutation({
    mutationFn: (answer: string) =>
      api.post<any>('/secure-code/attempt', {
        challengeId: challenge.id,
        employeeId: user?.id,
        answer,
      }),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error || 'Failed to submit attempt')
        return
      }
      setSubmitted(true)
      onAnswer(res.data.isCorrect)
      qc.invalidateQueries({ queryKey: ['secure-code-course', courseId] })
      qc.invalidateQueries({ queryKey: ['secure-code-course'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const lang = langColors[challenge.language] ?? { bg: 'bg-gray-500/15', text: 'text-gray-400', label: challenge.language }
  const options = (challenge.options as any[]) ?? []

  const isCorrect = submitted && selected === correctAnswer
  const pointsEarned = isCorrect ? challenge.points : 0

  const handleSubmit = () => {
    if (!selected) return
    submitMutation.mutate(selected)
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent text-sm font-bold">
            {index + 1}
          </div>
          <div>
            <h3 className="font-semibold text-white">{challenge.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', lang.bg, lang.text)}>
                {lang.label}
              </span>
              <span className="text-xs text-muted capitalize">{challenge.type.replace(/_/g, ' ')}</span>
              <span className="text-xs text-muted">· {challenge.points} pts</span>
            </div>
          </div>
        </div>
        {submitted && (
          <div className={clsx(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
            isCorrect ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
          )}>
            {isCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {isCorrect ? `+${pointsEarned} pts` : 'Incorrect'}
          </div>
        )}
      </div>

      <div className="p-6 space-y-4">
        {challenge.description && (
          <p className="text-sm text-muted-light">{challenge.description}</p>
        )}

        {challenge.codeSnippet && (
          <div className="relative">
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-xs bg-surface-2 text-muted">
              {lang.label}
            </div>
            <pre className="bg-[#0d1117] border border-border rounded-lg p-4 overflow-x-auto">
              <code className="text-sm text-green-300 font-mono whitespace-pre">{challenge.codeSnippet}</code>
            </pre>
          </div>
        )}

        {/* Options — before submission */}
        {options.length > 0 && !submitted && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-light">Select the correct answer:</p>
            {options.map((opt: any) => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={clsx(
                  'w-full text-left px-4 py-3 rounded-lg border transition-all text-sm',
                  selected === opt.id
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-border bg-surface-2 text-muted-light hover:border-accent/30 hover:text-white',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={clsx(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                    selected === opt.id ? 'border-accent bg-accent' : 'border-border',
                  )}>
                    {selected === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <span>{opt.label}</span>
                    {opt.code && (
                      <pre className="mt-2 bg-[#0d1117] rounded p-2 overflow-x-auto">
                        <code className="text-xs text-green-300 font-mono">{opt.code}</code>
                      </pre>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Options — after submission (show correct/wrong) */}
        {submitted && options.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-2">
              {options.map((opt: any) => {
                const isCorrectOpt = opt.id === correctAnswer
                const wasSelected = opt.id === selected
                return (
                  <div
                    key={opt.id}
                    className={clsx(
                      'px-4 py-3 rounded-lg border text-sm',
                      isCorrectOpt ? 'border-green-500/50 bg-green-500/10' :
                      wasSelected && !isCorrect ? 'border-red-500/50 bg-red-500/10' :
                      'border-border bg-surface-2 opacity-50',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isCorrectOpt ? <Check className="w-5 h-5 text-green-400" /> :
                         wasSelected ? <X className="w-5 h-5 text-red-400" /> :
                         <div className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <span className={isCorrectOpt ? 'text-green-300' : wasSelected ? 'text-red-300' : 'text-muted'}>
                          {opt.label}
                        </span>
                        {opt.code && (
                          <pre className="mt-2 bg-[#0d1117] rounded p-2 overflow-x-auto">
                            <code className="text-xs text-green-300 font-mono">{opt.code}</code>
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
              {showExplanation ? 'Hide' : 'Show'} Explanation
            </button>

            {showExplanation && explanation && (
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                <p className="text-sm text-muted-light leading-relaxed">{explanation}</p>
              </div>
            )}
          </div>
        )}

        {!submitted && selected && (
          <Button onClick={handleSubmit} loading={submitMutation.isPending} className="w-full">
            Submit Answer
          </Button>
        )}
      </div>
    </div>
  )
}

export default function SecureCodeCoursePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const { data: courseData, isLoading } = useQuery({
    queryKey: ['secure-code-course', courseId],
    queryFn: () => api.get<any>(`/secure-code/courses/${courseId}`),
  })

  // Fetch the full course with correct answers for client-side checking
  const course = courseData?.data
  const challenges = course?.challenges ?? []

  // Track which challenges have been answered
  const [answeredMap, setAnsweredMap] = useState<Record<string, boolean>>({})

  const solvedCount = challenges.filter((ch: any) => 
    ch.userAttempt?.isCorrect || answeredMap[ch.id]
  ).length

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-2 rounded w-64" />
        <div className="h-48 bg-surface rounded-xl" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="text-center py-16 text-muted">
        <p>Course not found.</p>
        <Button variant="secondary" onClick={() => router.push('/secure-code')} className="mt-4">
          ← Back to Courses
        </Button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => router.push('/secure-code')}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Courses
      </button>

      {/* Course Header */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${course.color}20`, color: course.color }}
          >
            {course.icon}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{course.title}</h1>
            <p className="text-muted-light mt-1">{course.description}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent">
                {course.category === 'owasp' ? 'OWASP Top 10' : course.category === 'sdlc' ? 'SDLC Security' : course.category}
              </span>
              <span className="text-sm text-muted">
                {challenges.length} Challenges
              </span>
              <span className="text-sm text-muted">·</span>
              <span className="text-sm text-muted">{course.difficulty}</span>
            </div>
          </div>
        </div>

        {solvedCount > 0 && (
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-medium">{solvedCount} Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-400 font-medium">{solvedCount}/{challenges.length} Complete</span>
            </div>
          </div>
        )}
      </div>

      {/* Lesson */}
      {course.content && (
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-accent" /> Lesson
          </h2>
          <div className="prose prose-invert prose-sm max-w-none text-muted-light leading-relaxed whitespace-pre-line">
            {course.content}
          </div>
        </div>
      )}

      {/* Challenges */}
      <h2 className="font-semibold text-white mb-4 flex items-center gap-2 text-lg">
        <Lock className="w-5 h-5 text-accent" /> Challenges
      </h2>
      <div className="space-y-4">
        {challenges.map((ch: any, i: number) => (
          <ChallengeCard
            key={ch.id}
            courseId={courseId}
            challenge={ch}
            index={i}
            correctAnswer={ch.correctAnswer ?? ''}
            explanation={ch.explanation ?? ''}
            onAnswer={(isCorrect) => setAnsweredMap(prev => ({ ...prev, [ch.id]: isCorrect }))}
          />
        ))}
      </div>

      {!challenges.length && (
        <div className="text-center py-12 text-muted">
          <p>No challenges available for this course yet.</p>
        </div>
      )}
    </div>
  )
}
