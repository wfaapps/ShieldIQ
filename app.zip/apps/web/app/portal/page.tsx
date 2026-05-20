'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Shield, CheckCircle2, Circle, BookOpen, PlayCircle, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

export default function PortalPage() {
  const [employeeEmail, setEmployeeEmail] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  
  // Video compliance campaign states
  const [videoOpen, setVideoOpen] = useState(false)
  const [activeVideoModule, setActiveVideoModule] = useState<{ activityId: string, moduleId: string, name: string } | null>(null)
  const [videoCompleted, setVideoCompleted] = useState(false)
  const furthestTime = useRef(0)

  // Policy Acknowledgment States
  const [policySigned, setPolicySigned] = useState(false)
  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [legalSignature, setLegalSignature] = useState('')

  const { data: portal, isLoading, refetch } = useQuery({
    queryKey: ['portal', submittedEmail],
    queryFn: () => api.get<any>(`/portal/me?email=${encodeURIComponent(submittedEmail)}`),
    enabled: !!submittedEmail,
  })

  const completeMutation = useMutation({
    mutationFn: ({ activityId, moduleId }: { activityId: string; moduleId: string }) =>
      api.post('/portal/complete', { activityId, moduleId, email: submittedEmail }),
    onSuccess: () => { toast.success('Module marked complete'); refetch() },
    onError: (e: any) => toast.error(e.message),
  })

  if (!submittedEmail) {
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
            <h1 className="text-xl font-semibold text-white mb-2">Welcome to your training</h1>
            <p className="text-muted-light text-sm mb-6">Enter your work email to access your assigned modules.</p>
            <form onSubmit={(e) => { e.preventDefault(); setSubmittedEmail(employeeEmail.toLowerCase()) }} className="space-y-4">
              <input
                type="email"
                required
                value={employeeEmail}
                onChange={(e) => setEmployeeEmail(e.target.value)}
                placeholder="alice@idfy.com"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white placeholder-muted focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                Continue
              </button>
            </form>
            <p className="text-xs text-muted mt-4 text-center">
              Demo emails: alice@idfy.com, bob@idfy.com, carol@idfy.com…
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-muted">Loading…</div>
  }

  if (!portal?.data) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-white mb-2">Employee not found</h1>
          <p className="text-muted-light text-sm mb-4">No record matches {submittedEmail}.</p>
          <button onClick={() => setSubmittedEmail('')} className="text-accent text-sm hover:underline">← Try a different email</button>
        </div>
      </div>
    )
  }

  const d = portal.data
  const totalAssigned = d.activities.reduce((acc: number, a: any) => acc + a.modules.length, 0)
  const totalDone = d.activities.reduce((acc: number, a: any) => acc + a.modules.filter((m: any) => m.completed).length, 0)
  const pct = totalAssigned > 0 ? Math.round((totalDone / totalAssigned) * 100) : 0

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 100 40" className="h-8 w-auto shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="18" fill="#e31e24" />
              <text x="20" y="22" dominantBaseline="middle" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="900" fontFamily="sans-serif" letterSpacing="-0.5">ID</text>
              <text x="43" y="27" fill="#5C5C5C" fontSize="23" fontWeight="600" fontFamily="sans-serif" letterSpacing="-0.5">fy</text>
            </svg>
          </div>
          <div className="text-right">
            <p className="text-sm text-white">{d.employee.name}</p>
            <p className="text-xs text-muted">{d.employee.email}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Welcome, {d.employee.name.split(' ')[0]} 👋</h1>
          <p className="text-muted-light">You have {totalAssigned - totalDone} module(s) remaining out of {totalAssigned} assigned.</p>
        </div>

        {/* Progress bar */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-light">Overall progress</span>
            <span className="text-2xl font-bold text-accent">{pct}%</span>
          </div>
          <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted mt-2">{totalDone} of {totalAssigned} modules completed</p>
        </div>

        {/* Activities */}
        {d.activities.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-white mb-1">You're all caught up!</h2>
            <p className="text-muted-light">No training is currently assigned to you.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {d.activities.map((act: any) => (
              <div key={act.id} className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-lg font-semibold text-white">{act.name}</h2>
                  <span className="text-xs text-muted">Deadline: {new Date(act.deadline).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted-light mb-4">{act.emailBody}</p>

                <div className="space-y-2">
                  {act.modules.map((m: any) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-surface-2 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {m.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted shrink-0" />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${m.completed ? 'text-muted line-through' : 'text-white'}`}>
                            {m.name}
                          </p>
                          {m.completed && m.completedAt && (
                            <p className="text-xs text-muted">Completed {new Date(m.completedAt).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                      {!m.completed && (
                        <button
                          onClick={() => {
                            setActiveVideoModule({ activityId: act.id, moduleId: m.id, name: m.name })
                            furthestTime.current = 0
                            setVideoCompleted(false)
                            setVideoOpen(true)
                          }}
                          disabled={completeMutation.isPending}
                          className="bg-accent hover:bg-accent-hover text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <PlayCircle className="w-3 h-3 inline mr-1" /> Start & Complete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Required Corporate Policies Section */}
            <div className="mt-8 bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Required Corporate Policies</h2>
                  <p className="text-xs text-muted">Acknowledge and digitally sign mandatory company policies</p>
                </div>
                <span className={clsx(
                  "text-xs font-semibold px-2 py-0.5 rounded-full font-mono",
                  policySigned ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
                )}>
                  {policySigned ? "✓ All Signed" : "⚠ 1 Pending Sign-off"}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-surface-2 border border-border rounded-xl">
                <div className="flex items-center gap-3">
                  {policySigned ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted shrink-0" />
                  )}
                  <div>
                    <p className={clsx("text-sm font-semibold", policySigned ? "text-muted line-through" : "text-white")}>
                      IDfy Acceptable Use Policy (AUP) v2.6
                    </p>
                    <p className="text-xs text-muted-light mt-0.5">Covers remote boundaries, prompt injections, and clean desk policies</p>
                  </div>
                </div>
                {!policySigned && (
                  <button
                    onClick={() => {
                      setPolicyModalOpen(true)
                      setScrolledToBottom(false)
                      setLegalSignature('')
                    }}
                    className="bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-accent/10"
                  >
                    Read & Sign Policy
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <button onClick={() => setSubmittedEmail('')} className="text-muted text-sm hover:text-white">← Sign out / switch employee</button>
        </div>
      </main>

      {/* Corporate Policy Signing Modal */}
      {policyModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-border rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="bg-surface-2 px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent animate-pulse" />
                <span className="text-sm font-semibold text-white font-mono">IDfy Digital Policy Hub</span>
              </div>
              <button 
                onClick={() => setPolicyModalOpen(false)}
                className="text-muted hover:text-white transition-colors text-xs"
              >
                ✕ Close
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">IDfy Acceptable Use Policy (AUP) v2.6</h2>
              <p className="text-xs text-muted-light">
                🔒 Please read the full document below. Scroll to the bottom to unlock the digital signature form.
              </p>
              
              <div 
                onScroll={(e) => {
                  const target = e.currentTarget
                  const isBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10
                  if (isBottom) setScrolledToBottom(true)
                }}
                className="bg-slate-950 p-4 rounded-lg border border-border max-h-[220px] overflow-y-auto font-sans text-xs text-slate-300 space-y-3 leading-relaxed"
              >
                <p className="font-bold text-white text-xs uppercase tracking-wider">1. Remote Work & Device Safety</p>
                <p>Employees must never leave corporate devices unattended in public areas. Home WiFi networks must be secured using robust WPA3 passwords, and public VPN interfaces are strictly required for remote database operations.</p>
                
                <p className="font-bold text-white text-xs uppercase tracking-wider">2. Generative AI & Sandbox Practices</p>
                <p>Entering proprietary corporate credentials, private API keys, or customer PII datasets into unauthorized public Large Language Models (like ChatGPT or Claude) is strictly prohibited. For active experimentation, employees must solely utilize the sandboxed systems provided under IDfy's oversight.</p>
                
                <p className="font-bold text-white text-xs uppercase tracking-wider">3. Clean Desk & Physical Barriers</p>
                <p>Passcodes must never be written on physical sticky notes or left visible on desks. High-risk data terminals must automatically lock when inactive for longer than three minutes. Physical visitor logs are audited on a bi-monthly schedule by operations security.</p>
                <p className="text-slate-500 italic text-[10px] pt-2">--- End of Acceptable Use Policy Document (v2.6) ---</p>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-light mb-1">
                    {!scrolledToBottom ? "🔒 Please scroll to the bottom to sign..." : "✍️ Type full legal name to digitally sign:"}
                  </label>
                  <input
                    type="text"
                    disabled={!scrolledToBottom}
                    value={legalSignature}
                    onChange={(e) => setLegalSignature(e.target.value)}
                    placeholder="e.g. Alice Smith"
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => {
                      if (!legalSignature.trim()) {
                        toast.error('Signature Required: Please type your legal name to submit.')
                        return
                      }
                      setPolicySigned(true)
                      setPolicyModalOpen(false)
                      toast.success('Acceptable Use Policy Digitally Signed & Recorded!')
                    }}
                    disabled={!scrolledToBottom || !legalSignature.trim()}
                    className={clsx(
                      'flex-grow font-semibold py-2.5 rounded-lg transition-all text-sm',
                      scrolledToBottom && legalSignature.trim()
                        ? 'bg-accent hover:bg-accent-hover text-white cursor-pointer shadow-lg shadow-accent/20' 
                        : 'bg-surface-2 border border-border text-muted cursor-not-allowed opacity-50'
                    )}
                  >
                    Submit Digital Sign-off
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Secure Video Player Modal */}
      {videoOpen && activeVideoModule && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-border rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="bg-surface-2 px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-sm font-semibold text-white font-mono">IDfy Secure Compliance Player</span>
              </div>
              <button 
                onClick={() => {
                  if (!videoCompleted) {
                    toast.warning('Compliance Warning: You must watch the entire training video to receive credit!')
                  }
                  setVideoOpen(false)
                }}
                className="text-muted hover:text-white transition-colors text-xs"
              >
                ✕ Close
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">Assigned Module: {activeVideoModule.name}</h2>
              <p className="text-xs text-muted-light">
                🔒 Fast-forwarding and timeline-seeking are disabled for this compliance campaign.
              </p>
              
              <div className="aspect-video w-full rounded-lg bg-black border border-border relative overflow-hidden">
                <video
                  src={
                    activeVideoModule.name.toLowerCase().includes('phish')
                      ? "/videos/phishing_awareness_101.mp4"
                      : "/videos/secure_code_basics.mp4"
                  }
                  controls
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  onTimeUpdate={(e) => {
                    const video = e.currentTarget
                    // Prevent seeking forward
                    if (video.currentTime > furthestTime.current + 1.5) {
                      video.currentTime = furthestTime.current
                      toast.error('Compliance Policy: Fast-forwarding is disabled.')
                    } else {
                      furthestTime.current = Math.max(furthestTime.current, video.currentTime)
                    }
                  }}
                  onEnded={() => {
                    setVideoCompleted(true)
                    toast.success('Training complete! You can now submit your completion.')
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    completeMutation.mutate({ 
                      activityId: activeVideoModule.activityId, 
                      moduleId: activeVideoModule.moduleId 
                    })
                    setVideoOpen(false)
                  }}
                  disabled={!videoCompleted || completeMutation.isPending}
                  className={clsx(
                    'flex-grow font-semibold py-2.5 rounded-lg transition-all text-sm',
                    videoCompleted 
                      ? 'bg-accent hover:bg-accent-hover text-white cursor-pointer shadow-lg shadow-accent/20' 
                      : 'bg-surface-2 border border-border text-muted cursor-not-allowed opacity-50'
                  )}
                >
                  {videoCompleted ? '✓ Submit Training Completion' : 'Please watch the full video to complete...'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
