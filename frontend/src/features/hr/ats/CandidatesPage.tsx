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
  useCandidates,
  useCreateCandidate,
  useBlacklistCandidate,
  useAIScreenCandidate,
  useRequisitions,
  type CreateCandidatePayload,
} from '@/api/hr_ats'

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  linkedin:     'LinkedIn',
  indeed:       'Indeed',
  referral:     'Referral',
  careers_page: 'Careers Page',
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-gray-400 text-xs">—</span>
  return (
    <span className="inline-flex items-center rounded-full bg-[#3ec9d6]/10 text-[#3ec9d6] px-2.5 py-0.5 text-xs font-medium">
      {SOURCE_LABELS[source] ?? source}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

// ─── Create candidate dialog ──────────────────────────────────────────────────

const EMPTY: CreateCandidatePayload = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  linkedin_url: '',
  source: 'careers_page',
  notes: '',
}

function CreateCandidateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<CreateCandidatePayload>({ ...EMPTY })
  const createMut = useCreateCandidate()

  function set<K extends keyof CreateCandidatePayload>(key: K, value: CreateCandidatePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createMut.mutateAsync({
        ...form,
        phone: form.phone || null,
        linkedin_url: form.linkedin_url || null,
        notes: form.notes || null,
      })
      toast('success', 'Candidate added')
      setForm({ ...EMPTY })
      onClose()
    } catch {
      toast('error', 'Failed to add candidate')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Candidate" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First Name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
          <Input label="Last Name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
        </div>
        <Input label="Email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Input label="Phone" type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        <Input label="LinkedIn URL" type="url" value={form.linkedin_url ?? ''} onChange={(e) => set('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/..." />
        <Select
          label="Source"
          value={form.source ?? 'careers_page'}
          onChange={(e) => set('source', e.target.value)}
        >
          <option value="linkedin">LinkedIn</option>
          <option value="indeed">Indeed</option>
          <option value="referral">Referral</option>
          <option value="careers_page">Careers Page</option>
        </Select>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] resize-none"
            rows={3}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Internal notes..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createMut.isPending}>Add Candidate</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── AI Screen dialog ─────────────────────────────────────────────────────────

function AIScreenDialog({
  open,
  onClose,
  candidateId,
}: {
  open: boolean
  onClose: () => void
  candidateId: string | null
}) {
  const [requisitionId, setRequisitionId] = useState('')
  const { data: reqs } = useRequisitions({ status: 'open', limit: 100 })
  const screenMut = useAIScreenCandidate()

  async function handleScreen() {
    if (!candidateId || !requisitionId) return
    try {
      await screenMut.mutateAsync({ candidate_id: candidateId, requisition_id: requisitionId })
      toast('success', 'AI screening queued — results will appear shortly')
      onClose()
    } catch {
      toast('error', 'Failed to start AI screening')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="AI Screen Candidate" size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-[10px] bg-[#3ec9d6]/10 border border-[#3ec9d6]/20 p-3 text-sm text-[#3ec9d6]">
          <span className="text-lg">🤖</span>
          <span>AI will analyse the candidate's profile against the selected job requisition.</span>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Requisition</label>
          <select
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            value={requisitionId}
            onChange={(e) => setRequisitionId(e.target.value)}
          >
            <option value="">— Choose a requisition —</option>
            {reqs?.items.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-400">Screening will run in the background. Match score and notes will be updated automatically.</p>
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleScreen}
            loading={screenMut.isPending}
            disabled={!requisitionId}
            className="bg-[#3ec9d6] hover:bg-[#3ec9d6]/90 text-white"
          >
            Run AI Screen
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CandidatesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [screenTarget, setScreenTarget] = useState<string | null>(null)

  const { data, isLoading, isError } = useCandidates({
    page,
    limit: 20,
    search: search || undefined,
    source: sourceFilter === 'all' ? undefined : sourceFilter,
  })

  const blacklistMut = useBlacklistCandidate()
  const totalPages = data ? Math.ceil(data.total / 20) : 1

  async function handleBlacklist(id: string, name: string) {
    if (!confirm(`Blacklist ${name}? They will no longer be considered for positions.`)) return
    try {
      await blacklistMut.mutateAsync(id)
      toast('success', `${name} blacklisted`)
    } catch {
      toast('error', 'Failed to blacklist candidate')
    }
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Candidates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your talent database</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Add Candidate</Button>
      </div>

      {/* Filters */}
      <Card padding={false} className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <input
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
          >
            <option value="all">All Sources</option>
            <option value="linkedin">LinkedIn</option>
            <option value="indeed">Indeed</option>
            <option value="referral">Referral</option>
            <option value="careers_page">Careers Page</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Full Name', 'Email', 'Phone', 'Source', 'Skills', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#ff3a6e]">
                    Failed to load candidates. Please try again.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No candidates found.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && data?.items.map((c) => {
                const fullName = `${c.first_name} ${c.last_name}`
                const skills = c.skills_extracted ?? []
                return (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/hr/ats/candidates/${c.id}`)}
                        className="font-medium text-[#51459d] hover:underline text-left"
                      >
                        {fullName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.email}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3"><SourceBadge source={c.source} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {skills.slice(0, 3).map((skill) => (
                          <span key={skill} className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 text-xs">
                            {skill}
                          </span>
                        ))}
                        {skills.length > 3 && (
                          <span className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 px-2 py-0.5 text-xs">
                            +{skills.length - 3}
                          </span>
                        )}
                        {skills.length === 0 && <span className="text-gray-400 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.is_blacklisted
                        ? <Badge variant="danger">Blacklisted</Badge>
                        : <Badge variant="success">Active</Badge>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/hr/ats/candidates/${c.id}`)}
                          className="text-xs text-[#51459d] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#51459d]/10 transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setScreenTarget(c.id)}
                          className="text-xs text-[#3ec9d6] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#3ec9d6]/10 transition-colors"
                        >
                          AI Screen
                        </button>
                        {!c.is_blacklisted && (
                          <button
                            onClick={() => handleBlacklist(c.id, fullName)}
                            disabled={blacklistMut.isPending}
                            className="text-xs text-[#ff3a6e] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#ff3a6e]/10 transition-colors disabled:opacity-50"
                          >
                            Blacklist
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
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

      <CreateCandidateDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <AIScreenDialog open={!!screenTarget} onClose={() => setScreenTarget(null)} candidateId={screenTarget} />
    </div>
  )
}
