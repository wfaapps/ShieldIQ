'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui'
import { clsx } from 'clsx'
import { ArrowLeft, Check, X, FileText, HelpCircle, Lightbulb, PlayCircle, ChevronRight, ChevronLeft, ShieldAlert, Lock, Eye, AlertTriangle } from 'lucide-react'

// ─── Slide definitions per training category ─────────────────────────────────
const TRAINING_SLIDES: Record<string, { icon: string; title: string; points: string[]; bg: string }[]> = {
  phishing: [
    { icon: '🎣', title: 'What is Phishing?', bg: 'from-red-950 to-slate-950', points: ['Phishing is the #1 attack vector used by cybercriminals worldwide', 'Attackers impersonate trusted entities via email, SMS, or calls', 'Goal: steal credentials, install malware, or trick you into wire transfers', 'Over 3.4 billion phishing emails are sent every single day'] },
    { icon: '🔍', title: 'Spot the Red Flags', bg: 'from-orange-950 to-slate-950', points: ['Sender domain mismatch — hover before you click (e.g. micros0ft.com)', 'Artificial urgency: "Your account expires in 24 hours!"', 'Generic greetings: "Dear Customer" instead of your name', 'Suspicious attachments: .zip, .exe, .docm, or unexpected PDFs'] },
    { icon: '🔗', title: 'Dangerous Links', bg: 'from-yellow-950 to-slate-950', points: ['Always hover over links to preview the real URL before clicking', 'Look for lookalike domains: paypa1.com vs paypal.com', 'Bit.ly or shortened URLs in business emails are a red flag', 'Check for HTTPS — but remember: HTTPS alone does NOT mean safe'] },
    { icon: '🛡️', title: 'How to Respond', bg: 'from-green-950 to-slate-950', points: ['Do NOT click any links or open attachments if suspicious', 'Report it using the Phish Alert Button in Outlook/Gmail', 'Forward to your security team: security@idfy.com', 'If you clicked — disconnect from network and call IT immediately'] },
    { icon: '✅', title: 'You Are the Last Line of Defence', bg: 'from-blue-950 to-slate-950', points: ['No technical control can catch 100% of phishing attacks', 'Your awareness is the most powerful security tool we have', 'Complete this training annually and after any simulated phishing failure', 'Quiz unlocked — test your knowledge below!'] },
  ],
  'secure-code': [
    { icon: '💻', title: 'Secure Coding Fundamentals', bg: 'from-purple-950 to-slate-950', points: ['Security must be built in — not bolted on after development', 'OWASP Top 10 covers the most critical web application risks', 'Every developer is responsible for the security of their code', 'Shift Left: catch vulnerabilities at design time, not in production'] },
    { icon: '💉', title: 'Injection Attacks (OWASP A03)', bg: 'from-red-950 to-slate-950', points: ['SQL Injection: never concatenate user input directly into queries', 'Always use parameterised queries or prepared statements', 'Command injection: avoid exec() with user input; use execFile()', 'Validate and sanitise ALL input — never trust client-supplied data'] },
    { icon: '🔐', title: 'Cryptographic Failures (OWASP A02)', bg: 'from-yellow-950 to-slate-950', points: ['Never hash passwords with MD5 or SHA1 — use bcrypt or argon2', 'Never hardcode secrets in source code — use environment variables', 'All data in transit must use TLS 1.2 or higher', 'Use strong, randomly generated keys (openssl rand -base64 32)'] },
    { icon: '🔓', title: 'Access Control (OWASP A01)', bg: 'from-orange-950 to-slate-950', points: ['Always verify ownership before allowing access to a resource (IDOR)', 'Hiding a route in the UI is NOT access control — check server-side', 'Apply least privilege: give users only what they absolutely need', 'Log all access control failures for security monitoring'] },
    { icon: '✅', title: 'Secure SDLC Checklist', bg: 'from-green-950 to-slate-950', points: ['Run SAST tools (ESLint, Snyk) in your CI/CD pipeline on every PR', 'Conduct threat modelling at design phase using STRIDE', 'Perform peer code reviews with a security lens', 'Quiz unlocked — test your knowledge below!'] },
  ],
  ransomware: [
    { icon: '🔒', title: 'What is Ransomware?', bg: 'from-red-950 to-slate-950', points: ['Ransomware encrypts your files and demands payment for the key', 'Average ransom demand in 2024: $2.73 million USD', 'Payment does NOT guarantee recovery — 40% never get files back', 'Recovery without backups can take weeks or months'] },
    { icon: '📧', title: 'How Ransomware Spreads', bg: 'from-orange-950 to-slate-950', points: ['Phishing emails with malicious attachments or links (most common)', 'Exploiting unpatched software vulnerabilities (e.g. EternalBlue)', 'RDP brute-force attacks on exposed remote desktop ports', 'Supply chain attacks through compromised software vendors'] },
    { icon: '🛡️', title: 'Prevention Controls', bg: 'from-yellow-950 to-slate-950', points: ['Patch and update all systems within 48 hours of critical patches', 'Enable MFA on all accounts — especially email and VPN', 'Follow the 3-2-1 backup rule: 3 copies, 2 media types, 1 offsite', 'Restrict admin privileges — no one should run as administrator daily'] },
    { icon: '🚨', title: 'Incident Response', bg: 'from-purple-950 to-slate-950', points: ['ISOLATE: immediately disconnect affected systems from the network', 'DO NOT PAY: paying funds criminal activity and rarely works', 'REPORT: notify your security team and legal/compliance immediately', 'RESTORE: recover from clean, tested, offline backups'] },
    { icon: '✅', title: 'Key Takeaways', bg: 'from-green-950 to-slate-950', points: ['Report ANY suspicious file encryption or unusual system behaviour', 'Never open unexpected email attachments, even from known senders', 'Test your backups regularly — untested backups are not real backups', 'Quiz unlocked — test your knowledge below!'] },
  ],
  'social-eng': [
    { icon: '🎭', title: 'What is Social Engineering?', bg: 'from-purple-950 to-slate-950', points: ['Social engineering exploits human psychology, not technical systems', 'Attackers manipulate trust, urgency, authority, or fear', 'No firewall or antivirus can stop a well-crafted social engineering attack', 'You are both the target AND the most powerful defence'] },
    { icon: '📞', title: 'Vishing (Voice Phishing)', bg: 'from-red-950 to-slate-950', points: ['Callers impersonate IT support, Microsoft, banks, or executives', 'Microsoft, Apple, and Google NEVER make unsolicited support calls', 'Hang up and call back using a number from the official website', 'Never give passwords or grant remote access over an unsolicited call'] },
    { icon: '💾', title: 'Baiting & USB Drops', bg: 'from-orange-950 to-slate-950', points: ['Attackers leave infected USB drives in car parks, lobbies, or desks', 'Curiosity is the attacker\'s weapon — "Salary_2024_Confidential.xlsx"', 'NEVER plug in a USB drive you did not personally purchase', 'Report found USB devices to IT security immediately'] },
    { icon: '🚪', title: 'Tailgating & Pretexting', bg: 'from-yellow-950 to-slate-950', points: ['Tailgating: following authorised staff through secure doors', 'Always challenge unknown visitors — it is not rude, it is required', 'Pretexting: fabricating a scenario to gain trust and extract info', 'IT staff will NEVER ask for your password — that is a red flag'] },
    { icon: '✅', title: 'Your Defence Checklist', bg: 'from-green-950 to-slate-950', points: ['Verify identity through official channels before trusting anyone', 'Report suspicious calls, visits, or requests to security@idfy.com', 'Always challenge unknown people in secure areas — no exceptions', 'Quiz unlocked — test your knowledge below!'] },
  ],
}

const DEFAULT_SLIDES = TRAINING_SLIDES['phishing']

// ─── Animated Training Player Component ──────────────────────────────────────
function TrainingVideoPlayer({ category, title }: { category: string; title: string }) {
  const slides = TRAINING_SLIDES[category] ?? DEFAULT_SLIDES
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const SLIDE_DURATION = 8000 // 8 seconds per slide

  useEffect(() => {
    if (playing) {
      let elapsed = progress * SLIDE_DURATION / 100
      intervalRef.current = setInterval(() => {
        elapsed += 100
        const pct = Math.min((elapsed / SLIDE_DURATION) * 100, 100)
        setProgress(pct)
        if (pct >= 100) {
          if (current < slides.length - 1) {
            setCurrent((c) => c + 1)
            setProgress(0)
            elapsed = 0
          } else {
            setCompleted(true)
            setPlaying(false)
            if (intervalRef.current) clearInterval(intervalRef.current)
          }
        }
      }, 100)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, current, slides.length])

  const slide = slides[current]

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-2xl mb-2">
      {/* Progress bar row */}
      <div className="flex gap-1 p-2 bg-black">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden cursor-pointer" onClick={() => { setCurrent(i); setProgress(0); }}>
            <div
              className="h-full bg-accent transition-all duration-100"
              style={{ width: i < current ? '100%' : i === current ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Slide Content */}
      <div className={clsx('relative bg-gradient-to-br p-8 min-h-[360px] flex flex-col justify-between', slide.bg)}>
        {/* Chapter badge */}
        <div className="flex items-center justify-between mb-4">
          <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/70 font-medium">
            {title} · Chapter {current + 1} of {slides.length}
          </span>
          {completed && (
            <span className="px-3 py-1 bg-green-500/20 border border-green-500/40 rounded-full text-xs text-green-400 font-medium">✅ Completed</span>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1">
          <div className="text-5xl mb-4">{slide.icon}</div>
          <h3 className="text-2xl font-bold text-white mb-5">{slide.title}</h3>
          <ul className="space-y-2.5">
            {slide.points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2.5 text-white/85 text-sm">
                <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-accent shrink-0 mt-0.5 text-xs font-bold">{i + 1}</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => { setCurrent((c) => Math.max(0, c - 1)); setProgress(0) }}
            disabled={current === 0}
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>

          <button
            onClick={() => setPlaying((p) => !p)}
            className="w-12 h-12 rounded-full bg-accent hover:bg-accent/80 flex items-center justify-center text-white transition-all shadow-lg shadow-accent/30"
          >
            {playing
              ? <span className="text-lg">⏸</span>
              : <span className="text-lg">▶</span>
            }
          </button>

          <button
            onClick={() => {
              if (current < slides.length - 1) { setCurrent((c) => c + 1); setProgress(0) }
              else setCompleted(true)
            }}
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
          >
            {current === slides.length - 1 ? 'Finish' : 'Next'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-white/40">IDfy Security Awareness Training</span>
        <span className="text-xs text-white/40">{current + 1}/{slides.length} · {Math.round((current / slides.length) * 100)}% complete</span>
      </div>
    </div>
  )
}

export default function ContentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const contentId = params.id as string

  const { data: itemData, isLoading } = useQuery({
    queryKey: ['content-item', contentId],
    queryFn: () => api.get<any>(`/content/${contentId}`),
  })

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [showExplanations, setShowExplanations] = useState(false)

  const item = itemData?.data

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-2 rounded w-64" />
        <div className="h-48 bg-surface rounded-xl" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-16 text-muted">
        <p>Content not found.</p>
        <Button variant="secondary" onClick={() => router.push('/content-library')} className="mt-4">
          ← Back to Library
        </Button>
      </div>
    )
  }

  const questions = item.questions ?? []
  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length

  // Client-side scoring
  const getResults = () => {
    let correct = 0
    const results = questions.map((q: any) => {
      const userAnswer = answers[q.id]
      const isCorrect = userAnswer === q.correctAnswer
      if (isCorrect) correct++
      return { questionId: q.id, userAnswer, correctAnswer: q.correctAnswer, isCorrect, explanation: q.explanation }
    })
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0
    return { score, correct, total: questions.length, results }
  }

  const handleSubmitQuiz = () => {
    setSubmitted(true)
  }

  const quizResult = submitted ? getResults() : null

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => router.push('/content-library')}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Content Library
      </button>

      {/* Header */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${item.color}20` }}
          >
            {item.icon}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{item.title}</h1>
            <p className="text-muted-light mt-1">{item.description}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent capitalize">
                {item.type}
              </span>
              <span className="text-sm text-muted">{item.duration} min</span>
              <span className="text-sm text-muted">·</span>
              <span className="text-sm text-muted">{item.difficulty}</span>
              {questions.length > 0 && (
                <>
                  <span className="text-sm text-muted">·</span>
                  <span className="text-sm text-muted">{questions.length} questions</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Body */}
      {item.content && (
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2 text-lg">
            {item.type === 'video' ? (
              <>
                <PlayCircle className="w-5 h-5 text-accent" /> Training Video Player
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 text-accent" /> Content
              </>
            )}
          </h2>
          
          {item.type === 'video' ? (
            <div>
              {item.content && item.content.startsWith('https://www.youtube.com/embed/') ? (
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-border shadow-2xl mb-2">
                  <iframe
                    src={`${item.content}?rel=0&modestbranding=1`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    title={item.title}
                  />
                </div>
              ) : (
                <TrainingVideoPlayer category={item.category} title={item.title} />
              )}
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-muted-light leading-relaxed whitespace-pre-line">
              {item.content}
            </div>
          )}
        </div>
      )}

      {/* Quiz Result Banner */}
      {quizResult && (
        <div className={clsx(
          'rounded-xl p-6 mb-6 border',
          quizResult.score >= 70 ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30',
        )}>
          <div className="flex items-center gap-4">
            <div className={clsx(
              'w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold',
              quizResult.score >= 70 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400',
            )}>
              {quizResult.score}%
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {quizResult.score >= 70 ? '🎉 Great job!' : '📚 Keep learning!'}
              </h3>
              <p className="text-sm text-muted-light">
                You answered {quizResult.correct} out of {quizResult.total} questions correctly.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowExplanations(!showExplanations)}
            className="mt-3 flex items-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            {showExplanations ? 'Hide' : 'Show'} Explanations
          </button>
        </div>
      )}

      {/* Quiz Questions */}
      {questions.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2 text-lg">
            <HelpCircle className="w-5 h-5 text-accent" /> Quiz
          </h2>

          <div className="space-y-4">
            {questions.map((q: any, i: number) => {
              const options = (q.options as any[]) ?? []
              const resultForQ = quizResult?.results?.find((r: any) => r.questionId === q.id)

              return (
                <div key={q.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent text-sm font-bold">
                        {i + 1}
                      </div>
                      <h3 className="font-medium text-white">{q.question}</h3>
                      {resultForQ && (
                        <div className={clsx(
                          'ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium',
                          resultForQ.isCorrect ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
                        )}>
                          {resultForQ.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-2">
                    {options.map((opt: any) => {
                      const isSelected = answers[q.id] === opt.id
                      const isCorrectOpt = resultForQ && opt.id === resultForQ.correctAnswer
                      const wasWrong = resultForQ && isSelected && !resultForQ.isCorrect

                      return (
                        <button
                          key={opt.id}
                          onClick={() => !submitted && setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                          disabled={submitted}
                          className={clsx(
                            'w-full text-left px-4 py-3 rounded-lg border transition-all text-sm',
                            submitted
                              ? isCorrectOpt
                                ? 'border-green-500/50 bg-green-500/10'
                                : wasWrong
                                  ? 'border-red-500/50 bg-red-500/10'
                                  : 'border-border bg-surface-2 opacity-50'
                              : isSelected
                                ? 'border-accent bg-accent/10 text-white'
                                : 'border-border bg-surface-2 text-muted-light hover:border-accent/30 hover:text-white',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={clsx(
                              'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                              submitted
                                ? isCorrectOpt ? 'border-green-400 bg-green-500' : wasWrong ? 'border-red-400 bg-red-500' : 'border-border'
                                : isSelected ? 'border-accent bg-accent' : 'border-border',
                            )}>
                              {(isSelected || isCorrectOpt) && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span>{opt.text}</span>
                            {submitted && isCorrectOpt && <Check className="w-4 h-4 text-green-400 ml-auto" />}
                            {submitted && wasWrong && <X className="w-4 h-4 text-red-400 ml-auto" />}
                          </div>
                        </button>
                      )
                    })}

                    {/* Explanation */}
                    {showExplanations && resultForQ && q.explanation && (
                      <div className="mt-3 bg-accent/5 border border-accent/20 rounded-lg p-4">
                        <p className="text-sm text-muted-light leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Submit Button */}
          {!submitted && (
            <div className="mt-6">
              <Button onClick={handleSubmitQuiz} disabled={!allAnswered} className="w-full">
                Submit Quiz ({Object.keys(answers).length}/{questions.length} answered)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
