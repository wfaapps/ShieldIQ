'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button, Input, Modal } from './ui'
import { ShieldCheck, Smartphone, KeyRound } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

/**
 * MFA setup flow:
 * 1. POST /auth/mfa/setup → returns otpauthUrl + base32 secret
 * 2. User scans QR or types the base32 secret into their authenticator
 * 3. User enters 6-digit code → POST /auth/mfa/confirm
 * 4. mfaEnabled becomes true server-side
 *
 * QR code is rendered client-side by encoding otpauthUrl as a Google Charts URL.
 * This avoids needing a heavy QR library on the client.
 */
export function MfaSetup() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'idle' | 'scan' | 'confirm'>('idle')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')

  const setupMutation = useMutation({
    mutationFn: () => api.post<{ success: boolean; data: { otpauthUrl: string; secret: string } }>('/auth/mfa/setup'),
    onSuccess: (res) => {
      setOtpauthUrl(res.data.otpauthUrl)
      setSecret(res.data.secret)
      setStep('scan')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const confirmMutation = useMutation({
    mutationFn: () => api.post('/auth/mfa/confirm', { code }),
    onSuccess: () => {
      toast.success('MFA enabled successfully — you\'ll need your authenticator on next login')
      setOpen(false)
      setStep('idle')
      setCode('')
      // Refresh auth state to reflect mfaEnabled
      window.location.reload()
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Encode otpauth URL as a QR code via a publicly hosted QR generator.
  // Using qrserver.com which renders the URL as a PNG; no JS execution risk.
  const qrUrl = otpauthUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUrl)}`
    : ''

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-white">Two-Factor Authentication (TOTP)</h2>
          </div>
          <p className="text-sm text-muted-light">
            Add a time-based one-time password as a second factor on every login.
            Compatible with Google Authenticator, Authy, 1Password, etc.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user?.['mfaEnabled' as never] ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
          {user?.['mfaEnabled' as never] ? '✓ Enabled' : 'Not enabled'}
        </span>
        <span className="text-sm text-muted-light">
          {user?.['mfaEnabled' as never] ? 'Your account is protected with MFA.' : 'Setup recommended for admin accounts.'}
        </span>
        {!user?.['mfaEnabled' as never] && (
          <Button onClick={() => { setOpen(true); setupMutation.mutate() }} className="ml-auto">
            Enable MFA
          </Button>
        )}
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setStep('idle'); setCode('') }} title="Set up Two-Factor Authentication">
        {step === 'scan' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-light font-medium mb-1">Step 1 — Scan this QR with your authenticator</p>
                <p className="text-xs text-muted">Open Google Authenticator, Authy, or 1Password and tap the + button.</p>
              </div>
            </div>

            <div className="flex justify-center p-4 bg-white rounded-lg">
              {qrUrl ? (
                <img src={qrUrl} alt="MFA QR code" width={220} height={220} className="rounded" />
              ) : (
                <div className="w-[220px] h-[220px] bg-gray-200 animate-pulse rounded" />
              )}
            </div>

            <div>
              <p className="text-xs text-muted mb-1">Or type this secret manually:</p>
              <code className="block bg-surface-2 border border-border rounded px-3 py-2 text-xs font-mono text-accent break-all">
                {secret}
              </code>
            </div>

            <Button onClick={() => setStep('confirm')} className="w-full">
              <KeyRound className="w-4 h-4" /> Continue
            </Button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-light font-medium mb-1">Step 2 — Enter the 6-digit code</p>
                <p className="text-xs text-muted">Your authenticator app generates a new code every 30 seconds.</p>
              </div>
            </div>
            <Input
              label="6-digit code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono"
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('scan')}>← Back</Button>
              <Button onClick={() => confirmMutation.mutate()} loading={confirmMutation.isPending} disabled={code.length !== 6} className="flex-1">
                Verify & Enable
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
