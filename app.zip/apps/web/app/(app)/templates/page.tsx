'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/lib/api'
import { PageHeader, Button, Input, Select, Modal } from '@/components/ui'
import { Plus, Trash2, Lock, Edit3, Eye, X, Mail, FileText } from 'lucide-react'
import { clsx } from 'clsx'

const TABS = [
  { key: 'phishing', label: 'Phishing' },
  { key: 'awareness', label: 'IS Awareness' },
  { key: 'social', label: 'Social Engineering' },
  { key: 'custom', label: 'Custom' },
]

const CreateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['phishing', 'awareness', 'social', 'custom']),
  description: z.string().default(''),
  icon: z.string().default('📧'),
  subject: z.string().optional(),
  body: z.string().optional(),
})
type CreateForm = z.infer<typeof CreateSchema>

function TemplateCard({
  template, selected, onSelect, onDelete, onEdit, onPreview,
}: {
  template: any; selected: boolean; onSelect: () => void; onDelete?: () => void; onEdit?: () => void; onPreview: () => void
}) {
  return (
    <div
      className={clsx(
        'bg-surface-2 border rounded-xl p-4 cursor-pointer transition-all group',
        selected ? 'border-accent shadow-lg shadow-accent/10' : 'border-border hover:border-muted',
      )}
      onClick={onPreview}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{template.icon}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {template.isSystem && <Lock className="w-3 h-3 text-muted" />}
          {!template.isSystem && onEdit && (
            <button
              className="text-muted hover:text-accent transition-colors p-1"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              title="Edit template"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
          {!template.isSystem && onDelete && (
            <button
              className="text-muted hover:text-red-400 transition-colors p-1"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              title="Delete template"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <h3 className="font-semibold text-white text-sm mb-1">{template.name}</h3>
      <p className="text-xs text-muted line-clamp-2">{template.description}</p>
      {template.subject && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted">
          <Mail className="w-3 h-3" />
          <span className="truncate">{template.subject}</span>
        </div>
      )}
    </div>
  )
}

function PreviewPanel({ template, onClose, onEdit }: { template: any; onClose: () => void; onEdit?: () => void }) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-white">Template Preview</h3>
        </div>
        <div className="flex items-center gap-2">
          {!template.isSystem && onEdit && (
            <Button variant="secondary" className="text-xs py-1 px-2" onClick={onEdit}>
              <Edit3 className="w-3 h-3" /> Edit
            </Button>
          )}
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{template.icon}</span>
          <div>
            <h2 className="text-lg font-bold text-white">{template.name}</h2>
            <span className="text-xs text-muted capitalize px-2 py-0.5 bg-accent/15 text-accent rounded-full">{template.category}</span>
          </div>
        </div>

        {template.description && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1 font-medium">Description</p>
            <p className="text-sm text-muted-light">{template.description}</p>
          </div>
        )}

        {template.subject && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1 font-medium flex items-center gap-1">
              <Mail className="w-3 h-3" /> Email Subject
            </p>
            <p className="text-sm text-white font-medium bg-surface-2 px-3 py-2 rounded-lg">{template.subject}</p>
          </div>
        )}

        {template.body && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1 font-medium flex items-center gap-1">
              <FileText className="w-3 h-3" /> Email Body
            </p>
            <div className="bg-white rounded-lg p-4 max-h-60 overflow-y-auto">
              <div className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: template.body }} />
            </div>
          </div>
        )}

        {!template.body && !template.subject && (
          <div className="text-center py-6 text-muted">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No email content configured for this template.</p>
          </div>
        )}

        {template.isSystem && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">This is a system template and cannot be edited.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('phishing')
  const [previewTemplate, setPreviewTemplate] = useState<any>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)

  const { data: templates } = useQuery({
    queryKey: ['templates', activeTab],
    queryFn: () => api.get<any>(`/templates?category=${activeTab}`),
  })

  // Create form
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { category: 'custom', icon: '📧' },
  })

  // Edit form
  const editForm = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
  })

  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => api.post('/templates', d),
    onSuccess: () => { toast.success('Template created'); qc.invalidateQueries({ queryKey: ['templates'] }); setCreateOpen(false); reset() },
    onError: (e: any) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: (d: CreateForm) => api.patch(`/templates/${editingTemplate?.id}`, d),
    onSuccess: () => {
      toast.success('Template updated')
      qc.invalidateQueries({ queryKey: ['templates'] })
      setEditOpen(false)
      setEditingTemplate(null)
      setPreviewTemplate(null)
    },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => {
      toast.success('Template deleted')
      qc.invalidateQueries({ queryKey: ['templates'] })
      setPreviewTemplate(null)
    },
    onError: (e: any) => toast.error(e.message),
  })

  const openEdit = (template: any) => {
    setEditingTemplate(template)
    editForm.reset({
      name: template.name,
      category: template.category,
      description: template.description ?? '',
      icon: template.icon ?? '📧',
      subject: template.subject ?? '',
      body: template.body ?? '',
    })
    setEditOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Template Library"
        sub="Phishing simulation, IS awareness, and social engineering templates"
        action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Add Custom Template</Button>}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-2 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setPreviewTemplate(null) }}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === t.key ? 'bg-accent text-white' : 'text-muted-light hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates Grid */}
        <div className={previewTemplate ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className={clsx(
            'grid gap-4',
            previewTemplate ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
          )}>
            {templates?.data?.map((t: any) => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={previewTemplate?.id === t.id}
                onSelect={() => setPreviewTemplate(previewTemplate?.id === t.id ? null : t)}
                onPreview={() => setPreviewTemplate(previewTemplate?.id === t.id ? null : t)}
                onEdit={!t.isSystem ? () => openEdit(t) : undefined}
                onDelete={!t.isSystem ? () => deleteMutation.mutate(t.id) : undefined}
              />
            ))}
            {!templates?.data?.length && (
              <div className="col-span-4 text-center py-12 text-muted">No templates in this category</div>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        {previewTemplate && (
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <PreviewPanel
                template={previewTemplate}
                onClose={() => setPreviewTemplate(null)}
                onEdit={!previewTemplate.isSystem ? () => openEdit(previewTemplate) : undefined}
              />
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Custom Template" wide>
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Template Name" {...register('name')} error={errors.name?.message} placeholder="My Custom Template" />
            <Input label="Icon (emoji)" {...register('icon')} placeholder="📧" />
          </div>
          <Select label="Category" {...register('category')}>
            <option value="phishing">Phishing</option>
            <option value="awareness">IS Awareness</option>
            <option value="social">Social Engineering</option>
            <option value="custom">Custom</option>
          </Select>
          <div>
            <label className="block text-sm font-medium text-muted-light mb-1">Description</label>
            <textarea {...register('description')} rows={2} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" />
          </div>
          <Input label="Email Subject" {...register('subject')} placeholder="Important: Action Required" />
          <div>
            <label className="block text-sm font-medium text-muted-light mb-1">Email Body (HTML)</label>
            <textarea {...register('body')} rows={6} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-accent resize-none" placeholder="<p>Dear {{name}},</p>..." />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMutation.isPending} className="flex-1">Create Template</Button>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditingTemplate(null) }} title="Edit Template" wide>
        <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Template Name" {...editForm.register('name')} error={editForm.formState.errors.name?.message} />
            <Input label="Icon (emoji)" {...editForm.register('icon')} />
          </div>
          <Select label="Category" {...editForm.register('category')}>
            <option value="phishing">Phishing</option>
            <option value="awareness">IS Awareness</option>
            <option value="social">Social Engineering</option>
            <option value="custom">Custom</option>
          </Select>
          <div>
            <label className="block text-sm font-medium text-muted-light mb-1">Description</label>
            <textarea {...editForm.register('description')} rows={2} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none" />
          </div>
          <Input label="Email Subject" {...editForm.register('subject')} />
          <div>
            <label className="block text-sm font-medium text-muted-light mb-1">Email Body (HTML)</label>
            <textarea {...editForm.register('body')} rows={6} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-accent resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={editMutation.isPending} className="flex-1">Save Changes</Button>
            <Button type="button" variant="secondary" onClick={() => { setEditOpen(false); setEditingTemplate(null) }}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
