'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { MetricCard, DeptProgressBar, StatusBadge, PageHeader, Button } from '@/components/ui'
import { AlertTriangle, Activity, Shield, Users, CheckCircle, Clock, Sparkles, ExternalLink } from 'lucide-react'
const securityTrends = [
  {
    id: 'trend-1',
    title: 'Generative AI Voice & Deepfake Vishing',
    category: 'Awareness Trend',
    severity: 'Critical',
    description: 'Attackers use cloned voices of executives to request emergency wire transfers or secure credentials over phone calls.',
    recommendation: 'Train employees to verify offline or use a pre-agreed verbal authentication code for out-of-band requests.',
    actionLabel: 'Explore Awareness Scenarios',
    actionUrl: '/scenarios',
  },
  {
    id: 'trend-2',
    title: 'QR Code Phishing (Quishing)',
    category: 'Phishing Trick',
    severity: 'High',
    description: 'Malicious QR codes embedded inside PDF attachments or email bodies designed to bypass corporate secure email gateways (SEGs).',
    recommendation: 'Upgrade template filters and train staff to never scan work-related QR codes on personal mobile devices.',
    actionLabel: 'Configure Phishing Templates',
    actionUrl: '/templates',
  },
  {
    id: 'trend-3',
    title: 'CISA "Secure by Design" Pledge',
    category: 'Secure Coding',
    severity: 'Info',
    description: 'The shift from patching vulnerabilities post-release to establishing systemic product security through input validation and memory safety.',
    recommendation: 'Incorporate Threat Modelling (STRIDE) during requirements phase and automate dependency checking (SCA).',
    actionLabel: 'Assign Secure Code Courses',
    actionUrl: '/secure-code',
  }
]

export default function DashboardPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<{ success: boolean; data: any }>('/dashboard'),
    refetchInterval: 30_000,
  })

  const generateDemo = useMutation({
    mutationFn: () => api.post<any>('/demo/generate'),
    onSuccess: (res) => {
      toast.success(`Generated ${res.data.completions} completions for ${res.data.employees} employees`)
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const d = data?.data

  const riskColor =
    !d ? 'text-white' :
    d.riskScore >= 70 ? 'text-red-400' :
    d.riskScore >= 40 ? 'text-yellow-400' : 'text-green-400'

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-2 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-surface rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Security Dashboard"
        sub="Real-time overview of your organisation's security awareness posture"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.open('/portal', '_blank')}>
              <ExternalLink className="w-4 h-4" /> Employee Portal
            </Button>
            <Button onClick={() => generateDemo.mutate()} loading={generateDemo.isPending}>
              <Sparkles className="w-4 h-4" /> Generate Demo Data
            </Button>
          </div>
        }
      />

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total Employees" value={d?.totalEmployees ?? 0} sub="Active accounts" />
        <MetricCard label="Training Completed" value={d?.completedCount ?? 0} sub={`of ${d?.totalEmployees ?? 0} employees`} color="text-green-400" />
        <MetricCard label="Pending Training" value={d?.pendingCount ?? 0} sub="Not yet completed" color="text-yellow-400" />
        <MetricCard label="Click Rate" value={`${d?.clickRate ?? 0}%`} sub="Phishing simulations" color={d?.clickRate > 20 ? 'text-red-400' : 'text-green-400'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Risk Score */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-white">Risk Score</h2>
          </div>
          <div className="text-center py-4">
            <div className={`text-6xl font-black ${riskColor}`}>{d?.riskScore ?? '--'}</div>
            <p className="text-muted text-sm mt-2">
              {!d ? '' : d.riskScore >= 70 ? 'High Risk' : d.riskScore >= 40 ? 'Medium Risk' : 'Low Risk'}
            </p>
          </div>
          <div className="w-full bg-surface-2 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${d?.riskScore >= 70 ? 'bg-red-500' : d?.riskScore >= 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${d?.riskScore ?? 0}%` }}
            />
          </div>
        </div>

        {/* Dept completion */}
        <div className="bg-surface border border-border rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-white">Completion by Department</h2>
          </div>
          {d?.deptStats?.length ? (
            d.deptStats.map((dept: any) => (
              <DeptProgressBar key={dept.id} name={dept.name} pct={dept.pct} color={dept.color} total={dept.total} completed={dept.completed} />
            ))
          ) : (
            <p className="text-muted text-sm">No departments found</p>
          )}
        </div>
      </div>

      {/* Cyber Threat & Security Trends Feed */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent animate-pulse" />
            <div>
              <h2 className="font-semibold text-white text-base">Cyber Threat & Security Trends Feed</h2>
              <p className="text-xs text-muted">Latest trending phishing tricks, security incidents, and Secure by Design advisories</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
            Live Feed (2026)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {securityTrends.map((trend) => (
            <div key={trend.id} className="flex flex-col justify-between p-4 bg-surface-2 border border-border rounded-lg hover:border-accent/40 transition-colors">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    trend.category === 'Secure Coding' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                    trend.category === 'Phishing Trick' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 
                    'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {trend.category}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.25 rounded ${
                    trend.severity === 'Critical' ? 'bg-red-500/20 text-red-400' :
                    trend.severity === 'High' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {trend.severity}
                  </span>
                </div>
                <h3 className="font-semibold text-white text-sm mb-2">{trend.title}</h3>
                <p className="text-xs text-muted mb-3 line-clamp-3">{trend.description}</p>
                <div className="p-2.5 bg-surface rounded text-[11px] text-muted-light border border-border/40 mb-4">
                  <strong className="text-white block mb-0.5">Recommendation:</strong>
                  {trend.recommendation}
                </div>
              </div>
              <Button size="sm" className="w-full justify-center text-xs" onClick={() => window.location.href = trend.actionUrl}>
                {trend.actionLabel} →
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Campaigns */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">Active Campaigns</h2>
          {d?.activeCampaigns?.length ? (
            <div className="space-y-3">
              {d.activeCampaigns.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    <p className="text-xs text-muted">{c.clickCount} clicks tracked</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">No active campaigns</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">Recent Activity</h2>
          {d?.recentActivity?.length ? (
            <div className="space-y-2">
              {d.recentActivity.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-medium">{a.user}</span>{' '}
                      <span className="text-muted">{a.action.replace('.', ' ')}</span>
                    </p>
                    <p className="text-xs text-muted">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  )
}
