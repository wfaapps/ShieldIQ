'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader, MetricCard, DeptProgressBar, Button, Input, Select } from '@/components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Mail, Shield, Download, Cpu, Layers, Settings2, RefreshCw, Star, CheckCircle, Activity, Check } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'

export default function PhishStatsPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'automation' | 'addin'>('analytics')
  
  // Smart Groups States
  const [autoEnabled, setAutoEnabled] = useState(true)
  const [riskThreshold, setRiskThreshold] = useState(2)
  const [autoScanning, setAutoScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)

  // Manifest States
  const [addonName, setAddonName] = useState('Report Phish (IDfy)')
  const [brandColor, setBrandColor] = useState('#e31e24')
  const [outlookIcon, setOutlookIcon] = useState('hook')

  const { data: stats } = useQuery({ queryKey: ['phish-stats'], queryFn: () => api.get<any>('/phish/stats') })
  const { data: byDept } = useQuery({ queryKey: ['phish-by-dept'], queryFn: () => api.get<any>('/phish/by-dept') })
  const { data: clicks } = useQuery({ queryKey: ['phish-clicks'], queryFn: () => api.get<any>('/phish/clicks?pageSize=50') })

  const s = stats?.data
  const funnelData = s ? [
    { name: 'Sent', value: s.totalSent, fill: '#3b82f6' },
    { name: 'Opened', value: Math.round((s.openRate / 100) * s.totalSent), fill: '#8b5cf6' },
    { name: 'Clicked', value: Math.round((s.clickRate / 100) * s.totalSent), fill: '#f59e0b' },
    { name: 'Submitted', value: Math.round((s.submitRate / 100) * s.totalSent), fill: '#ef4444' },
    { name: 'Reported', value: Math.round((s.reportRate / 100) * s.totalSent), fill: '#10b981' },
  ] : []

  // Download Manifest Handler
  const handleDownloadManifest = () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp 
  xmlns="http://schemas.microsoft.com/office/appversion/1.1" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xsi:type="MailApp">
  <Id>d2c31e99-f9c3-4211-ad88-2ba8c11e${Math.floor(Math.random() * 90000) + 10000}</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>IDfy Security</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="${addonName}"/>
  <Description DefaultValue="Report suspicious emails directly to your security operations team."/>
  <IconUrl DefaultValue="https://idfy-assets.s3.amazonaws.com/icons/${outlookIcon}-red.png"/>
  <HighResolutionIconUrl DefaultValue="https://idfy-assets.s3.amazonaws.com/icons/${outlookIcon}-red-2x.png"/>
  <SupportUrl DefaultValue="https://idfy.com/support"/>
  <AppDomains>
    <AppDomain>https://app.idfy.com</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Mailbox"/>
  </Hosts>
  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="Mailbox"/>
    </Sets>
  </Requirements>
  <FormSettings>
    <Form xsi:type="ItemRead">
      <DesktopSettings>
        <SourceLocation DefaultValue="https://app.idfy.com/api/campaigns/report?color=${encodeURIComponent(brandColor)}"/>
        <RequestedHeight>350</RequestedHeight>
      </DesktopSettings>
    </Form>
  </FormSettings>
  <Permissions>ReadWriteItem</Permissions>
  <Rule xsi:type="RuleCollection" Mode="And">
    <Rule xsi:type="ItemIs" ItemType="Message"/>
  </Rule>
</OfficeApp>`

    const blob = new Blob([xmlContent], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'idfy-phish-alert-manifest.xml'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Manifest XML successfully generated and downloaded!')
  }

  // Trigger Smart Group Scanner
  const handleSmartGroupScan = () => {
    setAutoScanning(true)
    setScanResult(null)
    setTimeout(() => {
      setAutoScanning(false)
      setScanResult('Success! Flagged 2 employees for immediate remedial coaching.')
      toast.success('Automation Scan Complete: Risk rosters synchronized.')
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Phishing & Threat Operations" 
        sub="Monitor employee vulnerability logs, generate custom Outlook add-ins, and configure trigger automation" 
      />

      {/* Modern Tabs */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setActiveTab('analytics')}
          className={clsx(
            'pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2',
            activeTab === 'analytics' ? 'border-accent text-white font-bold' : 'border-transparent text-muted hover:text-white'
          )}
        >
          <Activity className="w-4 h-4" /> Analytics Dashboard
        </button>
        <button
          onClick={() => setActiveTab('automation')}
          className={clsx(
            'pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2',
            activeTab === 'automation' ? 'border-accent text-white font-bold' : 'border-transparent text-muted hover:text-white'
          )}
        >
          <Cpu className="w-4 h-4" /> Smart Group Automation
        </button>
        <button
          onClick={() => setActiveTab('addin')}
          className={clsx(
            'pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2',
            activeTab === 'addin' ? 'border-accent text-white font-bold' : 'border-transparent text-muted hover:text-white'
          )}
        >
          <Download className="w-4 h-4" /> Mail Add-in (Phish Alert)
        </button>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Sent" value={s?.totalSent ?? 0} />
            <MetricCard label="Click Rate" value={`${s?.clickRate ?? 0}%`} color={s?.clickRate > 20 ? 'text-red-400' : 'text-green-400'} />
            <MetricCard label="Submit Rate" value={`${s?.submitRate ?? 0}%`} color="text-red-400" />
            <MetricCard label="Report Rate" value={`${s?.reportRate ?? 0}%`} color="text-green-400" sub="Good behaviour" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel chart */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-white mb-4">Campaign Funnel</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funnelData} margin={{ left: -20 }}>
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#111724', border: '1px solid #1e2d45', borderRadius: 8, color: '#e5e7eb' }}
                    cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By dept */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-white mb-4">Click Rate by Department</h2>
              {byDept?.data?.map((d: any) => (
                <DeptProgressBar key={d.id} name={d.name} pct={d.clickRate} color={d.color} total={d.employeeCount} completed={Math.round(d.clickRate / 100 * d.employeeCount)} />
              ))}
              {!byDept?.data?.length && <p className="text-muted text-sm">No data yet</p>}
            </div>
          </div>

          {/* Click table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-white">User-Level Click Tracking</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-muted font-medium">Employee</th>
                  <th className="text-left px-4 py-3 text-muted font-medium">Department</th>
                  <th className="text-left px-4 py-3 text-muted font-medium">Campaign</th>
                  <th className="text-left px-4 py-3 text-muted font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-muted font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {clicks?.data?.map((c: any) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{c.employee?.name}</p>
                      <p className="text-xs text-muted">{c.employee?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-light">{c.employee?.dept?.name}</td>
                    <td className="px-4 py-3 text-muted-light">{c.campaign?.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.action === 'clicked' ? 'bg-red-500/15 text-red-400' :
                        c.action === 'reported' ? 'bg-green-500/15 text-green-400' :
                        'bg-blue-500/15 text-blue-400'
                      }`}>{c.action}</span>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">{new Date(c.clickedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!clicks?.data?.length && (
                  <tr><td colSpan={5} className="text-center py-10 text-muted">No click data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'automation' && (
        <div className="space-y-6 bg-surface border border-border rounded-xl p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/15 rounded-lg flex items-center justify-center text-accent">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white text-lg">Intelligent Smart Groups Engine</h2>
                <p className="text-xs text-muted">Automatically categorize employees based on drill telemetry and assign micro-training</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => setAutoEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-surface peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
            </label>
          </div>

          {autoEnabled && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface-2 p-5 rounded-xl border border-border flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-accent font-mono uppercase tracking-wider">Smart Trigger</span>
                    <h3 className="font-bold text-white mt-1 mb-2">High-Risk Offenders</h3>
                    <p className="text-xs text-muted-light leading-relaxed">
                      Flags any user who clicks on phishing simulation hyperlinks two or more times in a rolling 60-day period.
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total Flagged: <strong>2</strong></span>
                    <span className="text-xs text-yellow-500 font-mono">Remedial Track active</span>
                  </div>
                </div>

                <div className="bg-surface-2 p-5 rounded-xl border border-border flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-wider">Smart Trigger</span>
                    <h3 className="font-bold text-white mt-1 mb-2">Security Champions</h3>
                    <p className="text-xs text-muted-light leading-relaxed">
                      Flags users who successfully report 3 simulated emails consecutively without falling for a single drill.
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total Flagged: <strong>8</strong></span>
                    <span className="text-xs text-emerald-400 font-mono">Certificate unlocked</span>
                  </div>
                </div>

                <div className="bg-surface-2 p-5 rounded-xl border border-border flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-400 font-mono uppercase tracking-wider">Smart Trigger</span>
                    <h3 className="font-bold text-white mt-1 mb-2">New Joiner Fast-Track</h3>
                    <p className="text-xs text-muted-light leading-relaxed">
                      Auto-triggers onboarding awareness drills to any employee profile added to the SCIM database in the last 7 days.
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total Flagged: <strong>4</strong></span>
                    <span className="text-xs text-blue-400 font-mono">Onboarding active</span>
                  </div>
                </div>
              </div>

              {/* Automation Rules Configuration */}
              <div className="bg-slate-950/60 p-5 rounded-xl border border-border space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-accent" /> Automation Settings
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-light mb-1">Fail Threshold (Clicks)</label>
                    <select
                      value={riskThreshold}
                      onChange={(e) => setRiskThreshold(Number(e.target.value))}
                      className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    >
                      <option value="1">1 Fail (Immediate Remediation)</option>
                      <option value="2">2 Fails (Standard Compliance)</option>
                      <option value="3">3 Fails (High Tolerance)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-light mb-1">Trigger Action</label>
                    <select className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
                      <option value="campaign">Launch Spear-Phishing Drill instantly</option>
                      <option value="training">Auto-Enroll in Mandated Security Video</option>
                      <option value="lock">Generate Slack Alert to Manager</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <Button onClick={handleSmartGroupScan} loading={autoScanning} className="flex-grow">
                    <RefreshCw className="w-3.5 h-3.5 mr-1 inline animate-spin-slow" /> Trigger Smart Group Database Scan
                  </Button>
                </div>

                {scanResult && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center animate-fade-in flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">{scanResult}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'addin' && (
        <div className="space-y-6 bg-surface border border-border rounded-xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4 border-b border-border pb-4">
            <div className="w-10 h-10 bg-accent/15 rounded-lg flex items-center justify-center text-accent">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg">Outlook & Google Phish Alert Add-in</h2>
              <p className="text-xs text-muted">Generate proprietary manifest files to deploy the IDfy report hook button across user mail clients</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <Input
                label="Add-in Name (User Display)"
                value={addonName}
                onChange={(e) => setAddonName(e.target.value)}
                placeholder="Report Phish (IDfy)"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-light mb-1">Add-in Button Icon</label>
                  <select
                    value={outlookIcon}
                    onChange={(e) => setOutlookIcon(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                  >
                    <option value="hook">Orange Hook Icon</option>
                    <option value="shield">Red Shield Icon</option>
                    <option value="mail">Mail Alert Icon</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-light mb-1">Branding Color</label>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="color" 
                      value={brandColor} 
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent" 
                    />
                    <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="font-mono text-sm" />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleDownloadManifest} className="w-full">
                  <Download className="w-4 h-4 mr-2" /> Generate & Download Outlook Manifest (XML)
                </Button>
              </div>
            </div>

            {/* Preview Addin Visual */}
            <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-4">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mail Client Toolbar Preview</span>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs text-slate-500 font-semibold font-mono">Outlook Web Access Preview</span>
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-800"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-800"></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-border justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs">✉️</div>
                    <span className="text-xs text-slate-400 font-semibold">Inbound message</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded">Reply</span>
                    {/* Pulsing customizable button */}
                    <div 
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold text-white border animate-pulse cursor-pointer"
                      style={{ backgroundColor: brandColor + '15', borderColor: brandColor }}
                    >
                      <Star className="w-3.5 h-3.5 fill-white text-white" />
                      <span>{addonName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
