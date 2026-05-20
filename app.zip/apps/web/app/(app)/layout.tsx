'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Sidebar } from '@/components/Sidebar'
import { Loader2 } from 'lucide-react'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, setUser } = useAuthStore()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ success: boolean; data: any }>('/auth/me'),
    retry: false,
    enabled: !user,
  })

  useEffect(() => {
    if (data?.data) {
      setUser(data.data)
      document.documentElement.style.setProperty('--accent', data.data.org.accentColor ?? '#3b82f6')
      const hover = data.data.org.accentColor
        ? data.data.org.accentColor.replace(/^#/, '')
        : '2563eb'
      document.documentElement.style.setProperty('--accent-hover', `#${hover}`)
    }
  }, [data, setUser])

  useEffect(() => {
    if (isError) router.replace('/login')
  }, [isError, router])

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
