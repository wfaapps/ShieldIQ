'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Shield } from 'lucide-react'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
type LoginForm = z.infer<typeof LoginSchema>

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [challengeToken, setChallengeToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const res = await api.post<{ success: boolean; mfaRequired?: boolean; challengeToken?: string; user?: any }>('/auth/login', data)
      if (res.mfaRequired && res.challengeToken) {
        setMfaRequired(true)
        setChallengeToken(res.challengeToken)
      } else if (res.user) {
        const me = await api.get<{ success: boolean; data: any }>('/auth/me')
        setUser(me.data)
        document.documentElement.style.setProperty('--accent', me.data.org.accentColor)
        router.replace('/dashboard')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const onMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/mfa/verify', { code: mfaCode, challengeToken })
      const me = await api.get<{ success: boolean; data: any }>('/auth/me')
      setUser(me.data)
      document.documentElement.style.setProperty('--accent', me.data.org.accentColor)
      router.replace('/dashboard')
    } catch (err: any) {
      toast.error(err.message ?? 'Invalid MFA code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <svg viewBox="0 0 100 40" className="h-12 w-auto shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" fill="#e31e24" />
            <text x="20" y="22" dominantBaseline="middle" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="900" fontFamily="sans-serif" letterSpacing="-0.5">ID</text>
            <text x="43" y="27" fill="#5C5C5C" fontSize="23" fontWeight="600" fontFamily="sans-serif" letterSpacing="-0.5">fy</text>
          </svg>
        </div>

        <div className="bg-surface border border-border rounded-xl p-8">
          {!mfaRequired ? (
            <>
              <h1 className="text-xl font-semibold text-white mb-6">Sign in to your account</h1>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-light mb-1">Email</label>
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white placeholder-muted focus:outline-none focus:border-accent"
                    placeholder="you@company.com"
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-light mb-1">Password</label>
                  <input
                    {...register('password')}
                    type="password"
                    autoComplete="current-password"
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white placeholder-muted focus:outline-none focus:border-accent"
                    placeholder="••••••••"
                  />
                  {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white mb-2">Two-Factor Authentication</h1>
              <p className="text-muted-light text-sm mb-6">Enter the 6-digit code from your authenticator app.</p>
              <form onSubmit={onMfaSubmit} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : 'Verify'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
