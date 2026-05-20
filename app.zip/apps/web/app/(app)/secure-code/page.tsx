'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader, MetricCard, StatusBadge } from '@/components/ui'
import { Code2, Shield, Layers, Trophy, ChevronRight, Bug, Zap, Lock } from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'

const categoryMeta: Record<string, { label: string; icon: React.ElementType; desc: string }> = {
  owasp: { label: 'OWASP Top 10', icon: Shield, desc: 'Web application security vulnerabilities' },
  sdlc: { label: 'SDLC Security', icon: Layers, desc: 'Secure Software Development Lifecycle' },
  language: { label: 'Secure Coding', icon: Code2, desc: 'Language-specific secure patterns' },
}

const difficultyColor: Record<string, string> = {
  Beginner: 'bg-green-500/15 text-green-400',
  Intermediate: 'bg-yellow-500/15 text-yellow-400',
  Advanced: 'bg-red-500/15 text-red-400',
}

export default function SecureCodePage() {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const { data: courses, isLoading } = useQuery({
    queryKey: ['secure-code-courses'],
    queryFn: () => api.get<any>('/secure-code/courses'),
  })

  const { data: stats } = useQuery({
    queryKey: ['secure-code-stats'],
    queryFn: () => api.get<any>('/secure-code/stats'),
  })

  const { data: leaderboard } = useQuery({
    queryKey: ['secure-code-leaderboard'],
    queryFn: () => api.get<any>('/secure-code/leaderboard'),
  })

  const s = stats?.data
  const allCourses = courses?.data ?? []
  const categories = Array.from(new Set(allCourses.map((c: any) => String(c.category)))) as string[]
  const filtered = activeCategory === 'all' ? allCourses : allCourses.filter((c: any) => c.category === activeCategory)

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-2 rounded w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-surface rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Secure Code Training"
        sub="OWASP Top 10, SDLC Security & interactive code challenges for developers"
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard label="Courses" value={s?.totalCourses ?? 0} sub="Training modules" />
        <MetricCard label="Challenges" value={s?.totalChallenges ?? 0} sub="Interactive exercises" color="text-blue-400" />
        <MetricCard label="Total Attempts" value={s?.totalAttempts ?? 0} sub="Across all employees" color="text-purple-400" />
        <MetricCard label="Correct" value={s?.correctAttempts ?? 0} sub="Passed challenges" color="text-green-400" />
        <MetricCard label="Accuracy" value={`${s?.accuracy ?? 0}%`} sub="Overall success rate" color={s?.accuracy >= 70 ? 'text-green-400' : 'text-yellow-400'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content — 2 cols */}
        <div className="lg:col-span-2">
          {/* Category Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setActiveCategory('all')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeCategory === 'all' ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-white',
              )}
            >
              All ({allCourses.length})
            </button>
            {categories.map((cat: string) => {
              const meta = categoryMeta[cat] ?? { label: cat, icon: Code2 }
              const count = allCourses.filter((c: any) => c.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                    activeCategory === cat ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-white',
                  )}
                >
                  <meta.icon className="w-4 h-4" />
                  {meta.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Course Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((course: any) => (
              <Link
                key={course.id}
                href={`/secure-code/${course.id}`}
                className="group bg-surface border border-border rounded-xl p-5 hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${course.color}20`, color: course.color }}
                  >
                    {course.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white group-hover:text-accent transition-colors truncate">
                      {course.title}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">{course.subcategory}</p>
                  </div>
                </div>

                <p className="text-sm text-muted-light mb-4 line-clamp-2">{course.description}</p>

                <div className="flex items-center justify-between mb-3">
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', difficultyColor[course.difficulty] ?? 'bg-gray-500/15 text-gray-400')}>
                    {course.difficulty}
                  </span>
                  <span className="text-xs text-muted">
                    {course.totalChallenges} challenge{course.totalChallenges !== 1 ? 's' : ''} · {course.totalPoints} pts
                  </span>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">{course.completedChallenges}/{course.totalChallenges} completed</span>
                    <span className="text-white font-medium">{course.completionPct}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${course.completionPct}%`, backgroundColor: course.color }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  Start Learning <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>

          {!filtered.length && (
            <div className="text-center py-16 text-muted">
              <Code2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No courses found in this category.</p>
            </div>
          )}
        </div>

        {/* Right Sidebar — Leaderboard */}
        <div>
          <div className="bg-surface border border-border rounded-xl p-5 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h2 className="font-semibold text-white">Leaderboard</h2>
            </div>

            {leaderboard?.data?.length ? (
              <div className="space-y-3">
                {leaderboard.data.slice(0, 10).map((entry: any, i: number) => (
                  <div key={entry.id} className="flex items-center gap-3">
                    <div className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      i === 1 ? 'bg-gray-400/20 text-gray-300' :
                      i === 2 ? 'bg-amber-600/20 text-amber-500' :
                      'bg-surface-2 text-muted',
                    )}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{entry.name}</p>
                      <p className="text-xs text-muted">{entry.dept} · {entry.solved} solved</p>
                    </div>
                    <span className="text-sm font-bold text-accent">{entry.points}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No attempts yet. Be the first!</p>
            )}
          </div>

          {/* Quick Info */}
          <div className="bg-surface border border-border rounded-xl p-5 mt-4">
            <h3 className="font-semibold text-white mb-3">What You'll Learn</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Bug className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-muted-light">Identify common vulnerabilities like SQL injection, XSS, and broken access control</p>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <p className="text-sm text-muted-light">Write secure code patterns across JavaScript, Python, Java, and SQL</p>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-sm text-muted-light">Embed security into every SDLC phase from design to deployment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
