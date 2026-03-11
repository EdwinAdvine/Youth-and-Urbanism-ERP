import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Badge, Button, Modal, Input, Select, toast } from '../../../components/ui'
import {
  useRequisition,
  useUpdateRequisition,
  usePublishRequisition,
  useCloseRequisition,
  useApplications,
  type JobRequisition,
  type CreateRequisitionPayload,
} from '@/api/hr_ats'
import PipelineBoard from './PipelineBoard'

// ─── Status badge ─────────────────────────────────────────────────────────────

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

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wide sm:w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{value}</span>
    </div>
  )
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditDialog({
  open,
  onClose,
  req,
}: {
  open: boolean
  onClose: () => void
  req: JobRequisition
}) {
  const [form, setForm] = useState<CreateRequisitionPayload>({
    title: req.title,
    department_id: req.department_id ?? '',
    job_type: req.job_type,
    location: req.location ?? '',
    remote_policy: req.remote_policy,
    salary_min: req.salary_min,
    salary_max: req.salary_max,
    headcount: req.headcount,
    description: req.description ?? '',
    requirements: req.requirements ?? '',
    skills_required: req.skills_required ?? [],
    target_hire_date: req.target_hire_date ?? '',
  })
  const [skillInput, setSkillInput] = useState('')
  const updateMut = useUpdateRequisition()

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
      await updateMut.mutateAsync({
        id: req.id,
        ...form,
        department_id: form.department_id || null,
        location: form.location || null,
        description: form.description || null,
        requirements: form.requirements || null,
        target_hire_date: (form.target_hire_date as string) || null,
      })
      toast('success', 'Requisition updated')
      onClose()
    } catch {
      toast('error', 'Failed to update requisition')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Requisition" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Job Title" required value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <Input
            label="Department ID"
            value={(form.department_id as string) ?? ''}
            onChange={(e) => set('department_id', e.target.value)}
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
            value={(form.location as string) ?? ''}
            onChange={(e) => set('location', e.target.value)}
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
          />
          <Input
            label="Salary Max"
            type="number"
            value={form.salary_max ?? ''}
            onChange={(e) => set('salary_max', e.target.value ? Number(e.target.value) : null)}
          />
          <Input
            label="Headcount"
            type="number"
            min={1}
            value={form.headcount ?? 1}
            onChange={(e) => set('headcount', Number(e.target.value))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Hire Date</label>
            <input
              type="date"
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              value={(form.target_hire_date as string) ?? ''}
              onChange={(e) => set('target_hire_date', e.target.value || null)}
            />
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Required Skills</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
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
                  <button type="button" onClick={() => removeSkill(i)} className="hover:text-[#ff3a6e]">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 resize-none"
            rows={3}
            value={(form.description as string) ?? ''}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Requirements</label>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 resize-none"
            rows={3}
            value={(form.requirements as string) ?? ''}
            onChange={(e) => set('requirements', e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={updateMut.isPending}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-40 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700" />
      <div className="h-64 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RequisitionDetail() {
  const { requisitionId } = useParams<{ requisitionId: string }>()
  const navigate = useNavigate()
  const [showEdit, setShowEdit] = useState(false)

  const { data: req, isLoading, isError } = useRequisition(requisitionId ?? '')
  const { data: appsData } = useApplications({ requisition_id: requisitionId, limit: 200 })
  const publishMut = usePublishRequisition()
  const closeMut = useCloseRequisition()

  const totalApps = appsData?.total ?? 0
  const hiredCount = appsData?.items.filter((a) => a.stage === 'hired').length ?? 0

  async function handlePublish() {
    if (!requisitionId) return
    try {
      await publishMut.mutateAsync(requisitionId)
      toast('success', 'Requisition published')
    } catch {
      toast('error', 'Failed to publish')
    }
  }

  async function handleClose() {
    if (!requisitionId) return
    if (!confirm('Close this requisition? It will no longer accept new applications.')) return
    try {
      await closeMut.mutateAsync(requisitionId)
      toast('success', 'Requisition closed')
    } catch {
      toast('error', 'Failed to close')
    }
  }

  if (isLoading) return <Skeleton />

  if (isError || !req) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <p className="text-[#ff3a6e]">Failed to load requisition.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    )
  }

  function fmtSalary() {
    if (!req) return '—'
    if (!req.salary_min && !req.salary_max) return '—'
    const fmt = (n: number) => n.toLocaleString()
    if (req.salary_min && req.salary_max) return `${fmt(req.salary_min)} – ${fmt(req.salary_max)} ${req.currency}`
    if (req.salary_min) return `From ${fmt(req.salary_min)} ${req.currency}`
    return `Up to ${fmt(req.salary_max!)} ${req.currency}`
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#51459d] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Requisitions
      </button>

      {/* Header */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{req.title}</h1>
              <ReqStatusBadge status={req.status} />
            </div>
            <p className="text-sm text-gray-500">
              Created {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {req.published_at && (
                <span className="ml-2">
                  · Published {new Date(req.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>Edit</Button>
            {req.status === 'draft' && (
              <Button
                size="sm"
                onClick={handlePublish}
                loading={publishMut.isPending}
                className="bg-[#6fd943] hover:bg-[#6fd943]/90 text-white"
              >
                Publish
              </Button>
            )}
            {req.status === 'open' && (
              <Button size="sm" variant="danger" onClick={handleClose} loading={closeMut.isPending}>
                Close
              </Button>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
          {[
            { label: 'Total Applications', value: totalApps, color: 'text-[#51459d]' },
            { label: 'Hired', value: hiredCount, color: 'text-[#6fd943]' },
            { label: 'Headcount', value: req.headcount, color: 'text-[#3ec9d6]' },
            {
              label: 'Fill Rate',
              value: req.headcount > 0 ? `${Math.round((hiredCount / req.headcount) * 100)}%` : '—',
              color: 'text-[#ffa21d]',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Details */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Position Details</h2>
        <DetailRow label="Department" value={req.department_id ?? '—'} />
        <DetailRow
          label="Job Type"
          value={req.job_type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        />
        <DetailRow label="Location" value={req.location ?? '—'} />
        <DetailRow
          label="Remote Policy"
          value={
            <span className={`capitalize ${req.remote_policy === 'remote' ? 'text-[#6fd943]' : req.remote_policy === 'hybrid' ? 'text-[#3ec9d6]' : ''}`}>
              {req.remote_policy}
            </span>
          }
        />
        <DetailRow label="Salary Range" value={fmtSalary()} />
        <DetailRow label="Headcount" value={`${req.headcount} position${req.headcount !== 1 ? 's' : ''}`} />
        {req.target_hire_date && (
          <DetailRow
            label="Target Hire Date"
            value={new Date(req.target_hire_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          />
        )}
      </Card>

      {/* Description + Requirements */}
      {(req.description || req.requirements) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {req.description && (
            <Card>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Description</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                {req.description}
              </p>
            </Card>
          )}
          {req.requirements && (
            <Card>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Requirements</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                {req.requirements}
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Required skills */}
      {req.skills_required && req.skills_required.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Required Skills</h2>
          <div className="flex flex-wrap gap-2">
            {req.skills_required.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full bg-[#51459d]/10 text-[#51459d] px-3 py-1 text-xs font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Embedded Pipeline */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Hiring Pipeline</h2>
        {requisitionId && <PipelineBoard requisitionId={requisitionId} />}
      </Card>

      {/* Edit dialog */}
      {showEdit && <EditDialog open={showEdit} onClose={() => setShowEdit(false)} req={req} />}
    </div>
  )
}
