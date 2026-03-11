import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Badge,
  Button,
  Modal,
  Input,
  Select,
  toast,
} from '../../../components/ui'
import {
  useRequisitions,
  useCreateRequisition,
  useUpdateRequisition,
  usePublishRequisition,
  useCloseRequisition,
  type JobRequisition,
  type CreateRequisitionPayload,
} from '@/api/hr_ats'

// ─── Status Badge ─────────────────────────────────────────────────────────────

function ReqStatusBadge({ status }: { status: JobRequisition['status'] }) {
  const map: Record<JobRequisition['status'], { variant: 'success' | 'default' | 'warning' | 'info' | 'danger'; label: string }> = {
    open:      { variant: 'success', label: 'Open' },
    draft:     { variant: 'default', label: 'Draft' },
    on_hold:   { variant: 'warning', label: 'On Hold' },
    filled:    { variant: 'info',    label: 'Filled' },
    cancelled: { variant: 'danger',  label: 'Cancelled' },
  }
  const { variant, label } = map[status] ?? { variant: 'default' as const, label: status }
  return <Badge variant={variant}>{label}</Badge>
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

// ─── Create / Edit Dialog ─────────────────────────────────────────────────────

const EMPTY_FORM: CreateRequisitionPayload = {
  title: '',
  department_id: '',
  job_type: 'full_time',
  location: '',
  remote_policy: 'onsite',
  salary_min: null,
  salary_max: null,
  headcount: 1,
  description: '',
  requirements: '',
  skills_required: [],
}

interface ReqFormDialogProps {
  open: boolean
  onClose: () => void
  initial?: JobRequisition | null
}

function ReqFormDialog({ open, onClose, initial }: ReqFormDialogProps) {
  const [form, setForm] = useState<CreateRequisitionPayload>(
    initial
      ? {
          title: initial.title,
          department_id: initial.department_id ?? '',
          job_type: initial.job_type,
          location: initial.location ?? '',
          remote_policy: initial.remote_policy,
          salary_min: initial.salary_min,
          salary_max: initial.salary_max,
          headcount: initial.headcount,
          description: initial.description ?? '',
          requirements: initial.requirements ?? '',
          skills_required: initial.skills_required ?? [],
        }
      : { ...EMPTY_FORM }
  )
  const [skillInput, setSkillInput] = useState('')

  const createMut = useCreateRequisition()
  const updateMut = useUpdateRequisition()
  const isLoading = createMut.isPending || updateMut.isPending

  function set<K extends keyof CreateRequisitionPayload>(key: K, value: CreateRequisitionPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addSkill() {
    const s = skillInput.trim()
    if (!s) return
    set('skills_required', [...(form.skills_required ?? []), s])
    setSkillInput('')
  }

  function removeSkill(i: number) {
    set('skills_required', (form.skills_required ?? []).filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (initial) {
        await updateMut.mutateAsync({ id: initial.id, ...form })
        toast('success', 'Requisition updated')
      } else {
        await createMut.mutateAsync(form)
        toast('success', 'Requisition created')
      }
      onClose()
    } catch {
      toast('error', 'Failed to save requisition')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Requisition' : 'New Requisition'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Job Title"
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Senior Software Engineer"
            />
          </div>
          <Input
            label="Department ID"
            value={form.department_id ?? ''}
            onChange={(e) => set('department_id', e.target.value || null)}
            placeholder="dept-uuid"
          />
          <Select
            label="Job Type"
            value={form.job_type}
            onChange={(e) => set('job_type', e.target.value as JobRequisition['job_type'])}
          >
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </Select>
          <Input
            label="Location"
            value={form.location ?? ''}
            onChange={(e) => set('location', e.target.value || null)}
            placeholder="e.g. Nairobi, Kenya"
          />
          <Select
            label="Remote Policy"
            value={form.remote_policy ?? 'onsite'}
            onChange={(e) => set('remote_policy', e.target.value as JobRequisition['remote_policy'])}
          >
            <option value="onsite">On-site</option>
            <option value="hybrid">Hybrid</option>
            <option value="remote">Remote</option>
          </Select>
          <Input
            label="Salary Min"
            type="number"
            value={form.salary_min ?? ''}
            onChange={(e) => set('salary_min', e.target.value ? Number(e.target.value) : null)}
            placeholder="0"
          />
          <Input
            label="Salary Max"
            type="number"
            value={form.salary_max ?? ''}
            onChange={(e) => set('salary_max', e.target.value ? Number(e.target.value) : null)}
            placeholder="0"
          />
          <Input
            label="Headcount"
            type="number"
            min={1}
            value={form.headcount ?? 1}
            onChange={(e) => set('headcount', Number(e.target.value))}
          />
        </div>

        {/* Skills */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Required Skills</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
              placeholder="Add skill and press Enter"
            />
            <Button type="button" variant="outline" size="sm" onClick={addSkill}>Add</Button>
          </div>
          {(form.skills_required ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(form.skills_required ?? []).map((skill, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-[#51459d]/10 text-[#51459d] rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {skill}
                  <button type="button" onClick={() => removeSkill(i)} className="hover:text-[#ff3a6e] ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] resize-none"
            rows={3}
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value || null)}
            placeholder="Role description..."
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Requirements</label>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] resize-none"
            rows={3}
            value={form.requirements ?? ''}
            onChange={(e) => set('requirements', e.target.value || null)}
            placeholder="Required qualifications..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isLoading}>{initial ? 'Save Changes' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RequisitionsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobRequisition['status'] | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<JobRequisition | null>(null)

  const { data, isLoading, isError } = useRequisitions({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })

  const publishMut = usePublishRequisition()
  const closeMut = useCloseRequisition()

  const totalPages = data ? Math.ceil(data.total / 20) : 1

  function fmtSalary(req: JobRequisition) {
    if (!req.salary_min && !req.salary_max) return '—'
    const fmt = (n: number) => n.toLocaleString()
    if (req.salary_min && req.salary_max) return `${fmt(req.salary_min)} – ${fmt(req.salary_max)} ${req.currency}`
    if (req.salary_min) return `From ${fmt(req.salary_min)} ${req.currency}`
    return `Up to ${fmt(req.salary_max!)} ${req.currency}`
  }

  async function handlePublish(id: string) {
    try {
      await publishMut.mutateAsync(id)
      toast('success', 'Requisition published')
    } catch {
      toast('error', 'Failed to publish')
    }
  }

  async function handleClose(id: string) {
    try {
      await closeMut.mutateAsync(id)
      toast('success', 'Requisition closed')
    } catch {
      toast('error', 'Failed to close')
    }
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Job Requisitions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage open positions and hiring pipelines</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Requisition</Button>
      </div>

      {/* Filters */}
      <Card padding={false} className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <input
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              placeholder="Search requisitions..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="on_hold">On Hold</option>
            <option value="filled">Filled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Title', 'Department', 'Type', 'Location', 'Remote', 'Headcount', 'Salary Range', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              {isError && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#ff3a6e]">
                    Failed to load requisitions. Please try again.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && data?.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    No requisitions found.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && data?.items.map((req) => (
                <tr key={req.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate">
                    {req.title}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {req.department_id ? <span className="font-mono text-xs">{req.department_id.slice(0, 8)}…</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 capitalize whitespace-nowrap">
                    {req.job_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[120px] truncate">
                    {req.location ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 capitalize">
                    {req.remote_policy}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-center">
                    {req.headcount}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">
                    {fmtSalary(req)}
                  </td>
                  <td className="px-4 py-3">
                    <ReqStatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/hr/ats/requisitions/${req.id}`)}
                        className="text-xs text-[#51459d] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#51459d]/10 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => setEditTarget(req)}
                        className="text-xs text-gray-600 dark:text-gray-400 hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Edit
                      </button>
                      {req.status === 'draft' && (
                        <button
                          onClick={() => handlePublish(req.id)}
                          disabled={publishMut.isPending}
                          className="text-xs text-[#6fd943] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#6fd943]/10 transition-colors disabled:opacity-50"
                        >
                          Publish
                        </button>
                      )}
                      {req.status === 'open' && (
                        <button
                          onClick={() => handleClose(req.id)}
                          disabled={closeMut.isPending}
                          className="text-xs text-[#ffa21d] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#ffa21d]/10 transition-colors disabled:opacity-50"
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 font-medium">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dialogs */}
      <ReqFormDialog open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && (
        <ReqFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} initial={editTarget} />
      )}
    </div>
  )
}
