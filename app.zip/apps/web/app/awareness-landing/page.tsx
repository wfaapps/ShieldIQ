'use client'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { Shield, AlertTriangle, AlertCircle, HelpCircle, CheckCircle2, ChevronRight, Mail, Compass, Star } from 'lucide-react'
import clsx from 'clsx'

type Hotspot = {
  id: number
  title: string
  description: string
  top: string
  left: string
}

export default function AwarenessLandingPage() {
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null)
  const [reported, setReported] = useState(false)
  const [reportSubmitting, setReportSubmitting] = useState(false)

  const hotspots: Hotspot[] = [
    {
      id: 1,
      title: "🎣 Mismatched / Spoofed Sender Email",
      description: "Always examine the full email address, not just the display name. Here, it says 'IDfy Security Hub' but the actual domain is 'security-alert@idfy-rewards-portal.org' — a classic typo-squatted look-alike domain designed specifically to spoof IDfy!",
      top: "top-[15%]",
      left: "left-[75%]"
    },
    {
      id: 2,
      title: "⏰ Extreme Urgency & Threat Indicators",
      description: "Phishing emails use high-pressure tactics like 'IMMEDIATE Action Required in 2 Hours' to create artificial panic. Attackers want you to act quickly on fear before logically checking the warning signs.",
      top: "top-[32%]",
      left: "left-[92%]"
    },
    {
      id: 3,
      title: "🔗 Mismatched Hyperlink Address",
      description: "When you hover your mouse over the link, you can see that the destination address (e.g., 'http://secure-login-portal-idfy.net') does not match the official IDfy corporate URL. Never click before checking!",
      top: "top-[58%]",
      left: "left-[50%]"
    },
    {
      id: 4,
      title: "📜 Outdated Copyright / Footer Info",
      description: "Look at the footer copyrights and addresses. They often copy outdated email templates from previous years (here displaying '2025' instead of '2026') or feature spelling errors that legitimate companies would never release.",
      top: "top-[82%]",
      left: "left-[78%]"
    }
  ]

  const handleReport = () => {
    setReportSubmitting(true)
    setTimeout(() => {
      setReportSubmitting(false)
      setReported(true)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-12 px-4 selection:bg-rose-500 selection:text-white">
      {/* Immersive Header */}
      <div className="max-w-4xl w-full text-center space-y-4 mb-10">
        <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-2 animate-pulse">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          Oops! You clicked a <span className="text-rose-500">Simulated Phishing Link</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
          Don't worry — this was a scheduled compliance exercise designed by <span className="text-white font-semibold">IDfy</span> to improve corporate security resilience. Let's explore the warning signs so you can protect yourself and the company next time!
        </p>
      </div>

      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left/Middle: Interactive Email Explorer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
            
            {/* Header / Email Client Header Bar */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-semibold text-slate-500 ml-2 font-mono">IDfy Teachable-Moments Interactive</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Click on any pulsing red point to learn</span>
            </div>

            {/* Email Body Wrap */}
            <div className="p-6 md:p-8 space-y-6 relative select-none">
              
              {/* Hotspots */}
              {hotspots.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setActiveHotspot(h.id)}
                  className={clsx(
                    "absolute w-8 h-8 rounded-full flex items-center justify-center transition-all z-20 cursor-pointer shadow-lg",
                    h.top, h.left,
                    activeHotspot === h.id 
                      ? "bg-rose-500 text-white scale-125 border-2 border-white" 
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:scale-110"
                  )}
                >
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-25"></span>
                  <HelpCircle className="w-4 h-4" />
                </button>
              ))}

              {/* Email Content Visuals */}
              <div className="space-y-4 font-sans text-slate-300">
                <div className="border-b border-slate-800 pb-4 space-y-2 text-sm">
                  <div>
                    <span className="text-slate-500 font-medium inline-block w-16">From:</span>
                    <span className="text-white font-medium">IDfy Security Hub</span>{" "}
                    <span className="text-rose-400 font-mono bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 text-xs">
                      &lt;security-alert@idfy-rewards-portal.org&gt;
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium inline-block w-16">Subject:</span>
                    <span className="text-white font-semibold">
                      🚨 ACTION REQUIRED: Security Credentials Expiry in 2 Hours!
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium inline-block w-16">Date:</span>
                    <span className="text-slate-400">May 19, 2026 — 09:47 AM</span>
                  </div>
                </div>

                <div className="pt-2 space-y-4 leading-relaxed text-sm">
                  <p>Dear Valued Employee,</p>
                  <p>
                    Our corporate identity monitoring tools have detected multiple failed login attempts on your work account. Due to compliance requirements, <strong className="text-white">your access token will expire within exactly 2 hours</strong>.
                  </p>
                  
                  {/* Mock Button Link */}
                  <div className="py-4">
                    <span className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded font-semibold text-xs border border-blue-500 cursor-not-allowed shadow-md">
                      Reset Credentials Instantly
                    </span>
                    <div className="mt-2 text-xs text-rose-400 font-mono bg-rose-500/5 p-2 rounded border border-rose-500/10 inline-block">
                      🔗 Destination link: http://secure-login-portal-idfy.net/verify-employee-auth
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    If you do not complete this step, you will be locked out of the company Slack, Email, and VPN portals permanently. Thank you for your cooperation in maintaining our corporate boundaries.
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-4 text-xs text-slate-500 space-y-1">
                  <p>© IDfy Corporate Information Group 2025. All rights reserved.</p>
                  <p>Corporate Office: 1 IDfy Gate, Suite 400, Bengaluru, KA 560001.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Interactive Tooltip details / Phish Alert trainer */}
        <div className="space-y-6">
          {/* Hotspot details card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl min-h-[220px] flex flex-col justify-between">
            {activeHotspot === null ? (
              <div className="flex flex-col items-center justify-center text-center space-y-3 my-auto py-6">
                <Compass className="w-10 h-10 text-rose-500 animate-bounce" />
                <h3 className="font-semibold text-white">Interactive Email Analyzer</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Click any of the pulsing red warning markers on the email mockups to reveal the exact phishing identifiers and attack signatures!
                </p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 text-rose-500 font-semibold border-b border-slate-800 pb-2">
                  <span>Hotspot #{activeHotspot}</span>
                </div>
                <h4 className="font-bold text-white text-base">
                  {hotspots.find(h => h.id === activeHotspot)?.title}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800 font-sans">
                  {hotspots.find(h => h.id === activeHotspot)?.description}
                </p>
                <button 
                  onClick={() => setActiveHotspot(null)}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  ← Back to analyzer
                </button>
              </div>
            )}
          </div>

          {/* 3rd Miss: Interactive Phish Alert Button Trainer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm md:text-base">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Tooling: The Phish Alert Button
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              In a real scenario, never click links inside unexpected emails. Practice reporting simulated threats right now inside our tool!
            </p>

            {/* Mock Toolbar */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Simulated Mail Toolbar</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReport}
                  disabled={reported || reportSubmitting}
                  className={clsx(
                    "w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg border transition-all",
                    reported 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default" 
                      : "bg-rose-600 hover:bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-900/10"
                  )}
                >
                  {reportSubmitting ? (
                    "Analyzing and Reporting..."
                  ) : reported ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Reported Successfully!
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" /> Click to Report Phish
                    </>
                  )}
                </button>
              </div>
            </div>

            {reported && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center animate-fade-in">
                <h4 className="text-xs font-bold text-emerald-400 mb-1">🎯 100% Correct Behavior!</h4>
                <p className="text-[10px] text-slate-400">
                  You successfully reported the drill! This logs a "Report" status in your employee portal dashboard instead of a "Click", boosting your company security champion index!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 text-slate-500 text-xs text-center space-y-1">
        <p>This is a safe, sandboxed corporate compliance module designed for employee training.</p>
        <p>© 2026 IDfy Human Risk Management Suite. All rights reserved.</p>
      </div>
    </div>
  )
}
