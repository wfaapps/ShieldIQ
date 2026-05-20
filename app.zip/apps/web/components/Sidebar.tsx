'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Mail, FileText, BarChart2,
  Swords, Library, Users, Settings, LogOut, Shield, ChevronRight, Code2, FolderOpen, Brain,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/awareness', label: 'IS Awareness', icon: BookOpen },
  { href: '/ai-awareness', label: 'AI Awareness', icon: Brain },
  { href: '/content-library', label: 'Content Library', icon: FolderOpen },
  { href: '/campaigns', label: 'Phishing Campaigns', icon: Mail },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/phish', label: 'Phish Statistics', icon: BarChart2 },
  { href: '/secure-code', label: 'Secure Code', icon: Code2 },
  { href: '/tabletop', label: 'Tabletop Exercises', icon: Swords },
  { href: '/scenarios', label: 'Scenarios', icon: Library },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, setUser } = useAuthStore()

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
      setUser(null)
      router.replace('/login')
    } catch {
      toast.error('Logout failed')
    }
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-surface border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <svg viewBox="0 0 100 40" className="h-9 w-auto shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="18" fill="#e31e24" />
          <text x="20" y="22" dominantBaseline="middle" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="900" fontFamily="sans-serif" letterSpacing="-0.5">ID</text>
          <text x="43" y="27" fill="#5C5C5C" fontSize="23" fontWeight="600" fontFamily="sans-serif" letterSpacing="-0.5">fy</text>
        </svg>
      </div>

      {/* Org name */}
      {user?.org.name && (
        <div className="px-5 py-2 border-b border-border">
          <p className="text-xs text-muted truncate">{user.org.name}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-accent/15 text-accent font-bold'
                  : 'text-muted-light hover:text-white hover:bg-surface-2',
              )}
              style={active ? { color: '#e31e24', backgroundColor: 'rgba(227, 30, 36, 0.12)' } : {}}
            >
              <Icon className="w-4 h-4 shrink-0" style={active ? { color: '#e31e24' } : {}} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" style={{ color: '#e31e24' }} />}
            </Link>
          )
        })}
      </nav>

      {/* User / Logout */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-muted capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
