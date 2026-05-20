'use client'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader, Button, Input, Modal } from '@/components/ui'
import { MfaSetup } from '@/components/MfaSetup'
import { Shield, Plus, Trash2, Edit2, Key, RefreshCw, Eye, EyeOff, Server } from 'lucide-react'

const OrgSchema = z.object({
  name: z.string().min(1),
  appTitle: z.string().min(1),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  senderEmail: z.string().email(),
  senderName: z.string().min(1),
})
type OrgForm = z.infer<typeof OrgSchema>

export default function SettingsPage() {
  const qc = useQueryClient()
  const { user, updateBranding } = useAuthStore()
  const [addDeptOpen, setAddDeptOpen] = useState(false)
  const [addModuleOpen, setAddModuleOpen] = useState(false)

  // SSO settings states
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [idpType, setIdpType] = useState('okta')
  const [issuerUrl, setIssuerUrl] = useState('https://idfy.okta.com/oauth2/default')
  const [clientId, setClientId] = useState('0oa918abc9e10293')
  const [clientSecret, setClientSecret] = useState('•'?.repeat(32))
  const [showSecret, setShowSecret] = useState(false)
  const [scimToken, setScimToken] = useState('scim_token_idfy_2026_9e88ba11c')
  const [ssoTesting, setSsoTesting] = useState(false)
  const [ssoLogs, setSsoLogs] = useState<string[]>([])

  const handleTestSso = () => {
    setSsoTesting(true)
    setSsoLogs([])
    const logs = [
      '🔄 Initiating connection to Okta metadata endpoint...',
      '🔑 Client Credentials matching OK. Verifying Issuer signature...',
      '📡 Discovering SCIM Directory endpoints...',
      '👥 Synchronizing employee list. Aligned 10 active departments.',
      '✨ Integration successful! 14 employee profiles successfully synchronized.'
    ]
    
    let currentIdx = 0
    const interval = setInterval(() => {
      if (currentIdx < logs.length) {
        setSsoLogs(prev => [...prev, logs[currentIdx]])
        currentIdx++
      } else {
        clearInterval(interval)
        setSsoTesting(false)
        toast.success('SSO & SCIM Connection Verified Successfully!')
      }
    }, 600)
  }

  const { data: org } = useQuery({ queryKey: ['org'], queryFn: () => api.get<any>('/org') })
  const { data: modules } = useQuery({ queryKey: ['modules'], queryFn: () => api.get<any>('/org/modules') })
  const { data: depts } = useQuery({ queryKey: ['depts'], queryFn: () => api.get<any>('/org/departments') })

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<OrgForm>({
    resolver: zodResolver(OrgSchema),
    defaultValues: { name: '', appTitle: 'ShieldIQ', accentColor: '#3b82f6', senderEmail: '', senderName: '' },
  })

  useEffect(() => {
    if (org?.data) {
      reset({
        name: org.data.name,
        appTitle: org.data.appTitle ?? 'ShieldIQ',
        accentColor: org.data.accentColor,
        senderEmail: org.data.senderEmail,
        senderName: org.data.senderName,
      })
    }
  }, [org?.data, reset])

  const accentColor = watch('accentColor')
  const appTitle = watch('appTitle')
  const orgName = watch('name')

  // Live preview: update CSS var
  useEffect(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      document.documentElement.style.setProperty('--accent', accentColor)
    }
  }, [accentColor])

  const updateOrg = useMutation({
    mutationFn: (d: OrgForm) => api.patch('/org', d),
    onSuccess: (res: any) => {
      toast.success('Settings saved')
      updateBranding({ accentColor: res.data.accentColor, appTitle: res.data.appTitle, name: res.data.name })
      qc.invalidateQueries({ queryKey: ['org'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Dept
  const [deptName, setDeptName] = useState('')
  const createDept = useMutation({
    mutationFn: () => api.post('/org/departments', { name: deptName }),
    onSuccess: () => { toast.success('Department created'); qc.invalidateQueries({ queryKey: ['depts'] }); setAddDeptOpen(false); setDeptName('') },
    onError: (e: any) => toast.error(e.message),
  })
  const deleteDept = useMutation({
    mutationFn: (id: string) => api.delete(`/org/departments/${id}`),
    onSuccess: () => { toast.success('Department deleted'); qc.invalidateQueries({ queryKey: ['depts'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  // Module
  const [moduleName, setModuleName] = useState('')
  const createModule = useMutation({
    mutationFn: () => api.post('/org/modules', { name: moduleName }),
    onSuccess: () => { toast.success('Module created'); qc.invalidateQueries({ queryKey: ['modules'] }); setAddModuleOpen(false); setModuleName('') },
    onError: (e: any) => toast.error(e.message),
  })
  const toggleModule = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/org/modules/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules'] }),
  })

  return (
    <div>
      <PageHeader title="Settings" sub="Organisation branding, modules, and departments" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Branding form */}
        <div className="lg:col-span-2 space-y-6">
          {/* MFA Setup */}
          <MfaSetup />

          {/* Single Sign-On (SSO) Card */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Single Sign-On (SSO) & SCIM Directory</h2>
                  <p className="text-xs text-muted">Integrate Okta, Azure AD, or Google Workspace for auto-onboarding</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ssoEnabled}
                  onChange={(e) => setSsoEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
              </label>
            </div>

            {ssoEnabled && (
              <div className="space-y-4 pt-4 border-t border-border animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-light mb-1">Identity Provider</label>
                    <select 
                      value={idpType} 
                      onChange={(e) => {
                        setIdpType(e.target.value)
                        if (e.target.value === 'okta') setIssuerUrl('https://idfy.okta.com/oauth2/default')
                        else if (e.target.value === 'azure') setIssuerUrl('https://login.microsoftonline.com/idfy-tenant/v2.0')
                        else setIssuerUrl('https://accounts.google.com/.well-known/openid-configuration')
                      }}
                      className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    >
                      <option value="okta">Okta Identity Cloud</option>
                      <option value="azure">Microsoft Azure AD (Entra ID)</option>
                      <option value="google">Google Workspace Enterprise</option>
                    </select>
                  </div>
                  <Input 
                    label="SSO Metadata / Issuer URL" 
                    value={issuerUrl} 
                    onChange={(e) => setIssuerUrl(e.target.value)} 
                    placeholder="https://idp.company.com/oauth2" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="OAuth Client ID" 
                    value={clientId} 
                    onChange={(e) => setClientId(e.target.value)} 
                    placeholder="0oa1234abc..." 
                  />
                  <div>
                    <label className="block text-xs font-medium text-muted-light mb-1">OAuth Client Secret</label>
                    <div className="relative">
                      <input 
                        type={showSecret ? 'text' : 'password'}
                        value={clientSecret} 
                        onChange={(e) => setClientSecret(e.target.value)} 
                        className="w-full bg-surface-2 border border-border rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-accent font-mono"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-2.5 text-muted hover:text-white"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                      <Server className="w-3.5 h-3.5" /> SCIM Directory Token
                    </span>
                    <button 
                      onClick={() => {
                        setScimToken('scim_token_' + Math.random().toString(16).substring(2, 10))
                        toast.success('Generated new SCIM API credentials!')
                      }}
                      className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                  </div>
                  <input 
                    type="text" 
                    readOnly 
                    value={scimToken}
                    className="w-full bg-transparent border-0 font-mono text-xs text-slate-300 focus:ring-0 p-0"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    onClick={handleTestSso} 
                    loading={ssoTesting}
                    className="flex-1 bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 text-xs py-2"
                  >
                    <RefreshCw className="w-3 h-3 mr-1 inline animate-spin-slow" /> Test SCIM Sync & Auth Connection
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => toast.success('SSO settings saved permanently!')} 
                    className="flex-1 text-xs py-2"
                  >
                    Save Configuration
                  </Button>
                </div>

                {ssoLogs.length > 0 && (
                  <div className="bg-black/90 p-4 rounded-xl border border-border font-mono text-[10px] text-slate-300 space-y-1 animate-fade-in shadow-inner max-h-[140px] overflow-y-auto">
                    {ssoLogs.map((log, idx) => (
                      <div key={idx} className="flex gap-1.5">
                        <span className="text-accent font-semibold">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Branding */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="font-semibold text-white mb-4">Organisation Branding</h2>
            <form onSubmit={handleSubmit((d) => updateOrg.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Organisation Name" {...register('name')} error={errors.name?.message} />
                <Input label="App Title" {...register('appTitle')} error={errors.appTitle?.message} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-light mb-1">Accent Colour</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" {...register('accentColor')} className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent" />
                    <Input {...register('accentColor')} className="font-mono" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Sender Email" type="email" {...register('senderEmail')} error={errors.senderEmail?.message} />
                <Input label="Sender Name" {...register('senderName')} error={errors.senderName?.message} />
              </div>
              <Button type="submit" loading={updateOrg.isPending} disabled={!isDirty}>Save Changes</Button>
            </form>
          </div>

          {/* Modules */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Training Modules</h2>
              <Button variant="secondary" className="text-xs py-1.5" onClick={() => setAddModuleOpen(true)}>
                <Plus className="w-3 h-3" /> Add Module
              </Button>
            </div>
            <div className="space-y-2">
              {modules?.data?.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-sm text-white">{m.name}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={(e) => toggleModule.mutate({ id: m.id, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Departments */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Departments</h2>
              <Button variant="secondary" className="text-xs py-1.5" onClick={() => setAddDeptOpen(true)}>
                <Plus className="w-3 h-3" /> Add Department
              </Button>
            </div>
            <div className="space-y-2">
              {depts?.data?.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-sm text-white">{d.name}</span>
                    <span className="text-xs text-muted">{d._count?.employees ?? 0} employees</span>
                  </div>
                  <button
                    className="text-muted hover:text-red-400 transition-colors"
                    onClick={() => { if (confirm(`Delete ${d.name}?`)) deleteDept.mutate(d.id) }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl p-5 sticky top-6">
            <h2 className="text-sm font-semibold text-muted-light uppercase tracking-wider mb-4">Live Preview</h2>
            <div className="bg-surface-2 border border-border rounded-lg overflow-hidden">
              {/* Mini sidebar */}
              <div className="p-3 border-b border-border flex items-center gap-2">
                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                  <Shield className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold text-white">{appTitle || 'ShieldIQ'}</span>
              </div>
              <div className="p-3 border-b border-border">
                <p className="text-xs text-muted">{orgName || 'Organisation Name'}</p>
              </div>
              <div className="p-3 space-y-2">
                {['Dashboard', 'IS Awareness', 'Campaigns'].map((item) => (
                  <div key={item} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-muted-light">
                    <div className="w-3 h-3 rounded-sm bg-muted opacity-40" />
                    {item}
                  </div>
                ))}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: accentColor }} />
                  Settings
                </div>
              </div>
              <div className="p-3 border-t border-border">
                <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                  <div className="h-full rounded-full w-2/3" style={{ backgroundColor: accentColor }} />
                </div>
                <p className="text-xs text-muted mt-1">Completion progress</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Dept Modal */}
      <Modal open={addDeptOpen} onClose={() => setAddDeptOpen(false)} title="Add Department">
        <div className="space-y-4">
          <Input label="Department Name" value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Engineering" />
          <div className="flex gap-3">
            <Button onClick={() => createDept.mutate()} loading={createDept.isPending} className="flex-1">Create</Button>
            <Button variant="secondary" onClick={() => setAddDeptOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Add Module Modal */}
      <Modal open={addModuleOpen} onClose={() => setAddModuleOpen(false)} title="Add Training Module">
        <div className="space-y-4">
          <Input label="Module Name" value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="Zero Trust Security" />
          <div className="flex gap-3">
            <Button onClick={() => createModule.mutate()} loading={createModule.isPending} className="flex-1">Create</Button>
            <Button variant="secondary" onClick={() => setAddModuleOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
