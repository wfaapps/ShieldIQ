'use client'
import { clsx } from 'clsx'
import { Loader2, X } from 'lucide-react'
import React from 'react'

// ─── MetricCard ───────────────────────────────────────────────────────────────
export function MetricCard({
  label, value, sub, color = 'text-white',
}: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-xs text-muted uppercase tracking-wider mb-2">{label}</p>
      <p className={clsx('text-3xl font-bold', color)}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  )
}

// ─── DeptProgressBar ──────────────────────────────────────────────────────────
export function DeptProgressBar({
  name, pct, color = '#3b82f6', total, completed,
}: {
  name: string; pct: number; color?: string; total: number; completed: number
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-light">{name}</span>
        <span className="text-white font-medium">{pct}%</span>
      </div>
      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-muted mt-0.5">{completed}/{total} completed</p>
    </div>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400',
  in_progress: 'bg-blue-500/15 text-blue-400',
  not_started: 'bg-gray-500/15 text-gray-400',
  overdue: 'bg-red-500/15 text-red-400',
  active: 'bg-green-500/15 text-green-400',
  draft: 'bg-gray-500/15 text-gray-400',
  scheduled: 'bg-yellow-500/15 text-yellow-400',
  sent: 'bg-blue-500/15 text-blue-400',
  ended: 'bg-gray-500/15 text-gray-400',
}

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', statusColors[status] ?? 'bg-gray-500/15 text-gray-400')}>
      {label}
    </span>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  open, onClose, title, children, wide = false,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={clsx('relative bg-surface border border-border rounded-xl shadow-2xl w-full', wide ? 'max-w-2xl' : 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export function Button({
  variant = 'primary', loading = false, children, className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent hover:bg-accent-hover text-white',
    secondary: 'bg-surface-2 hover:bg-border text-white border border-border',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'text-muted-light hover:text-white hover:bg-surface-2',
  }
  return (
    <button
      {...props}
      disabled={props.disabled ?? loading}
      className={clsx(
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(
  ({ label, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && <label className="block text-sm font-medium text-muted-light">{label}</label>}
        <input
          ref={ref}
          {...props}
          className={clsx(
            'w-full bg-surface-2 border rounded-lg px-3 py-2 text-white placeholder-muted text-sm focus:outline-none focus:border-accent',
            error ? 'border-red-500' : 'border-border',
            props.className,
          )}
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ─── Select ───────────────────────────────────────────────────────────────────
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }>(
  ({ label, error, children, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && <label className="block text-sm font-medium text-muted-light">{label}</label>}
        <select
          ref={ref}
          {...props}
          className={clsx(
            'w-full bg-surface-2 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent',
            error ? 'border-red-500' : 'border-border',
            props.className,
          )}
        >
          {children}
        </select>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'

// ─── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {sub && <p className="text-muted text-sm mt-1">{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
