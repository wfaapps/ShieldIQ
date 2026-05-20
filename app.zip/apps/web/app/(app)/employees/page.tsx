'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/lib/api'
import { PageHeader, Button, Input, Select, StatusBadge, Modal } from '@/components/ui'
import { Plus, Download, Upload, Search, Users } from 'lucide-react'

const CreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  deptId: z.string().min(1),
  role: z.string().optional(),
})
type CreateForm = z.infer<typeof CreateSchema>

export default function EmployeesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [page, setPage] = useState(1)

  const { data: depts } = useQuery({ queryKey: ['depts'], queryFn: () => api.get<any>('/org/departments') })

  const queryParams = new URLSearchParams({ page: String(page), pageSize: '50' })
  if (search) queryParams.set('search', search)
  if (deptFilter) queryParams.set('dept', deptFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, deptFilter, statusFilter],
    queryFn: () => api.get<any>(`/employees?${queryParams}`),
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
  })

  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => api.post('/employees', d),
    onSuccess: () => { toast.success('Employee added'); qc.invalidateQueries({ queryKey: ['employees'] }); setCreateOpen(false); reset() },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => { toast.success('Employee removed'); qc.invalidateQueries({ queryKey: ['employees'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  const handleExport = () => {
    window.open(`${process.env['NEXT_PUBLIC_API_URL']}/employees/export`, '_blank')
  }

  const handleImport = async () => {
    if (!importFile) return
    // Validate file size client-side (server also enforces 5 MB)
    if (importFile.size > 5 * 1024 * 1024) {
      toast.error('File too large — max 5 MB')
      return
    }
    if (!importFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a .csv file')
      return
    }
    const formData = new FormData()
    formData.append('file', importFile)
    try {
      const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/employees/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Import failed')
      setImportResult(json.data)
      toast.success(`Imported ${json.data.created} employees`)
      qc.invalidateQueries({ queryKey: ['employees'] })
    } catch (err: any) {
      toast.error(err.message ?? 'Import failed')
    }
  }

  const employees = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <PageHeader
        title="Employees"
        sub={`${total} employees across ${depts?.data?.length ?? 0} departments`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4" /> Import CSV</Button>
            <Button variant="secondary" onClick={handleExport}><Download className="w-4 h-4" /> Export CSV</Button>
            <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Add Employee</Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(1) }}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
        >
          <option value="">All Departments</option>
          {depts?.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-muted font-medium">Employee</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Department</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Role</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Training Status</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Progress</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {employees.map((emp: any) => (
              <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{emp.name}</p>
                  <p className="text-xs text-muted">{emp.email}</p>
                </td>
                <td className="px-4 py-3 text-muted-light">{emp.dept?.name}</td>
                <td className="px-4 py-3 text-muted-light">{emp.role || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                <td className="px-4 py-3 text-muted text-xs">{emp.doneModules}/{emp.totalModules}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="text-xs text-muted hover:text-red-400 transition-colors"
                    onClick={() => { if (confirm(`Remove ${emp.name}?`)) deleteMutation.mutate(emp.id) }}
                  >Remove</button>
                </td>
              </tr>
            ))}
            {!isLoading && !employees.length && (
              <tr><td colSpan={6} className="text-center py-12 text-muted">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No employees found</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted">
          <span>Showing {employees.length} of {total}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="py-1 px-3 text-xs">Previous</Button>
            <span className="px-3 py-1 text-muted-light">Page {page} of {data.totalPages}</span>
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages} className="py-1 px-3 text-xs">Next</Button>
          </div>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Employee">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Input label="Full Name" {...register('name')} error={errors.name?.message} placeholder="Jane Smith" />
          <Input label="Email Address" type="email" {...register('email')} error={errors.email?.message} placeholder="jane@company.com" />
          <Select label="Department" {...register('deptId')} error={errors.deptId?.message}>
            <option value="">Select department…</option>
            {depts?.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Input label="Job Role (optional)" {...register('role')} placeholder="Software Engineer" />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMutation.isPending} className="flex-1">Add Employee</Button>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportFile(null); setImportResult(null) }} title="Import Employees from CSV">
        <div className="space-y-4">
          <div className="bg-surface-2 border border-border rounded-lg p-4">
            <p className="text-sm font-medium text-white mb-2">CSV format</p>
            <p className="text-xs text-muted mb-2">Required columns: <code className="text-accent">name</code>, <code className="text-accent">email</code>, <code className="text-accent">department</code>. Optional: <code className="text-accent">role</code>.</p>
            <code className="block text-xs text-muted-light bg-surface rounded p-2 font-mono">
              name,email,department,role<br />
              Jane Doe,jane@idfy.com,Engineering,Senior Engineer<br />
              John Smith,john@idfy.com,Sales,Account Executive
            </code>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-light mb-1">CSV file (max 5 MB)</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null) }}
              className="block w-full text-sm text-muted-light file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer file:font-medium hover:file:bg-accent-hover"
            />
          </div>

          {importResult && (
            <div className="bg-surface-2 border border-border rounded-lg p-3">
              <p className="text-sm text-green-400 font-medium">✓ Imported {importResult.created} employees</p>
              {importResult.errors?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-yellow-400 cursor-pointer">
                    {importResult.errors.length} row(s) skipped — click to view
                  </summary>
                  <ul className="text-xs text-muted-light mt-1 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => <li key={i}>• {err}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={!importFile} className="flex-1">
              <Upload className="w-4 h-4" /> Upload & Import
            </Button>
            <Button variant="secondary" onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null) }}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
