'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader, MetricCard } from '@/components/ui'
import { FolderOpen, PlayCircle, FileText, ImageIcon, HelpCircle, BookOpen, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'

const typeMeta: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  video: { icon: PlayCircle, label: 'Video', color: 'text-red-400' },
  article: { icon: FileText, label: 'Article', color: 'text-blue-400' },
  infographic: { icon: ImageIcon, label: 'Infographic', color: 'text-purple-400' },
  quiz: { icon: HelpCircle, label: 'Quiz', color: 'text-green-400' },
  comic: { icon: BookOpen, label: 'Comic', color: 'text-yellow-400' },
}

const categoryLabels: Record<string, string> = {
  phishing: 'Phishing Awareness',
  ransomware: 'Ransomware',
  password: 'Password Security',
  'social-eng': 'Social Engineering',
  'data-privacy': 'Data Privacy',
  general: 'General Security',
  incident: 'Incident Response',
}

const difficultyColor: Record<string, string> = {
  Beginner: 'bg-green-500/15 text-green-400',
  Intermediate: 'bg-yellow-500/15 text-yellow-400',
  Advanced: 'bg-red-500/15 text-red-400',
}

export default function ContentLibraryPage() {
  const [activeType, setActiveType] = useState('all')
  const [activeCategory, setActiveCategory] = useState('all')

  const { data: items, isLoading } = useQuery({
    queryKey: ['content-items'],
    queryFn: () => api.get<any>('/content'),
  })

  const { data: stats } = useQuery({
    queryKey: ['content-stats'],
    queryFn: () => api.get<any>('/content/stats'),
  })

  const s = stats?.data
  const allItems = items?.data ?? []
  const types = Array.from(new Set(allItems.map((c: any) => String(c.type)))) as string[]
  const categories = Array.from(new Set(allItems.map((c: any) => String(c.category)))) as string[]

  let filtered = allItems
  if (activeType !== 'all') filtered = filtered.filter((c: any) => c.type === activeType)
  if (activeCategory !== 'all') filtered = filtered.filter((c: any) => c.category === activeCategory)

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
        title="Content Library"
        sub="Videos, articles, quizzes & infographics for security awareness training"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard label="Total Content" value={s?.totalItems ?? 0} sub="Training materials" />
        <MetricCard label="Quizzes" value={s?.totalQuizzes ?? 0} sub="Interactive assessments" color="text-green-400" />
        <MetricCard label="Assigned" value={s?.totalProgress ?? 0} sub="Employee assignments" color="text-blue-400" />
        <MetricCard label="Completed" value={s?.completedProgress ?? 0} sub="Finished training" color="text-purple-400" />
        <MetricCard label="Completion Rate" value={`${s?.completionRate ?? 0}%`} sub="Overall progress" color={s?.completionRate >= 70 ? 'text-green-400' : 'text-yellow-400'} />
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setActiveType('all')}
          className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            activeType === 'all' ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-white')}
        >
          All Types ({allItems.length})
        </button>
        {types.map((type) => {
          const meta = typeMeta[type] ?? { icon: FileText, label: type, color: 'text-gray-400' }
          const count = allItems.filter((c: any) => c.type === type).length
          return (
            <button key={type} onClick={() => setActiveType(type)}
              className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
                activeType === type ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-white')}>
              <meta.icon className="w-3.5 h-3.5" />
              {meta.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveCategory('all')}
          className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            activeCategory === 'all' ? 'bg-surface-2 text-white border border-accent' : 'bg-surface text-muted hover:text-white border border-border')}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeCategory === cat ? 'bg-surface-2 text-white border border-accent' : 'bg-surface text-muted hover:text-white border border-border')}>
            {categoryLabels[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item: any) => {
          const meta = typeMeta[item.type] ?? { icon: FileText, label: item.type, color: 'text-gray-400' }
          const Icon = meta.icon
          return (
            <Link
              key={item.id}
              href={`/content-library/${item.id}`}
              className="group bg-surface border border-border rounded-xl p-5 hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-accent transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Icon className={clsx('w-3.5 h-3.5', meta.color)} />
                      <span className="text-xs text-muted">{meta.label}</span>
                      <span className="text-xs text-muted">·</span>
                      <span className="text-xs text-muted">{item.duration} min</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-light mb-3 line-clamp-2">{item.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', difficultyColor[item.difficulty] ?? 'bg-gray-500/15 text-gray-400')}>
                    {item.difficulty}
                  </span>
                  <span className="text-xs text-muted">
                    {categoryLabels[item.category] ?? item.category}
                  </span>
                </div>
                {item.questionCount > 0 && (
                  <span className="text-xs text-muted">{item.questionCount} questions</span>
                )}
              </div>

              {item.totalAssigned > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">{item.completedCount}/{item.totalAssigned} completed</span>
                    {item.avgScore != null && <span className="text-accent font-medium">Avg: {item.avgScore}%</span>}
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${item.totalAssigned > 0 ? Math.round((item.completedCount / item.totalAssigned) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1 mt-3 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                View Content <ChevronRight className="w-3 h-3" />
              </div>
            </Link>
          )
        })}
      </div>

      {!filtered.length && (
        <div className="text-center py-16 text-muted">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No content found for the selected filters.</p>
        </div>
      )}
    </div>
  )
}
