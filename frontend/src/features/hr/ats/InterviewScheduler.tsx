import { useState } from 'react'
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
  useInterviews,
  useCreateInterview,
  useSubmitInterviewFeedback,
  useCancelInterview,
  useApplications,
  type Interview,
  type CreateInterviewPayload,
  type SubmitInterviewFeedbackPayload,
} from '@/api/hr_ats'

// ─── Type icon/label ──────────────────────────────────────────────────────────

const TYPE_META: Record<Interview['interview_type'], { icon: string; label: string }> = {
  video:      { icon: '📹', label: 'Video' },
  phone:      { icon: '📞', label: 'Phone' },
  in_person:  { icon: '🏢', label: 'In Person' },
  technical:  { icon: '💻', label: 'Technical' },
  panel:      { icon: '👥', label: 'Panel' },
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Interview['status'] }) {
  const map: Record<Interview['status'], { variant: 'warning' | 'success' | 'danger' | 'default'; label: string }> = {
    scheduled:  { variant: 'warning', label: 'Scheduled' },
    completed:  { variant: 'success', label: 'Completed' },
    cancelled:  { variant: 'danger',  label: 'Cancelled' },
    no_show:    { variant: 'default', label: 'No Show' },
  }
  const { variant, label } = map[status] ?? { variant: 'default' as const, label: status }
  return <Badge variant={variant}>{label}</Badge>
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

// ─── Schedule Interview Dialog ────────────────────────────────────────────────

const EMPTY_SCHEDULE: Omit<CreateInterviewPayload, 'application_id'> = {
  interview_type: 'video',
  scheduled_at: '',
  duration_minutes: 60,
  interviewer_ids: [],
  meeting_url: '',
}

function ScheduleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [applicationSearch, setApplicationSearch] = useState('')
  const [selectedAppId, setSelectedAppId] = useState('')
  const [form, setForm] = useState({ ...EMPTY_SCHEDULE })
  const [interviewersText, setInterviewersText] = useState('')

  const { data: apps } = useApplications({ limit: 50 })
  const createMut = useCreateInterview()

  function set<K extends keyof typeof EMPTY_SCHEDULE>(key: K, value: (typeof EMPTY_SCHEDULE)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const filteredApps = apps?.items.filter((a) => {
    if (!applicationSearch) return true
    const name = a.candidate
      ? `${a.candidate.first_name} ${a.candidate.last_name} ${a.candidate.email}`
      : a.candidate_id
    return name.toLowerCase().includes(applicationSearch.toLowerCase())
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAppId) { toast('error', 'Select an application first'); return }
    if (!form.scheduled_at) { toast('error', 'Set a date and time'); return }

    const interviewers = interviewersText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      await createMut.mutateAsync({
        application_id: selectedAppId,
        ...form,
        meeting_url: form.meeting_url || null,
        interviewer_ids: interviewers.length > 0 ? interviewers : null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
      })
      toast('success', 'Interview scheduled')
      setSelectedAppId('')
      setForm({ ...EMPTY_SCHEDULE })
      setInterviewersText('')
      onClose()
    } catch {
      toast('error', 'Failed to schedule interview')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule Interview" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Application select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Application</label>
          <input
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 mb-1.5"
            placeholder="Search candidate..."
            value={applicationSearch}
            onChange={(e) => setApplicationSearch(e.target.value)}
          />
          <div className="max-h-32 overflow-y-auto rounded-[10px] border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
            {filteredApps?.map((a) => {
              const label = a.candidate
                ? `${a.candidate.first_name} ${a.candidate.last_name}`
                : a.candidate_id.slice(0, 8)
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAppId(a.id)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    selectedAppId === a.id
                      ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {label}
                  {a.candidate && <span className="text-gray-400 ml-1">· {a.candidate.email}</span>}
                </button>
              )
            })}
            {filteredApps?.length === 0 && (
              <p className="px-3 py-3 text-center text-xs text-gray-400">No applications found</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Interview Type"
            value={form.interview_type}
            onChange={(e) => set('interview_type', e.target.value as Interview['interview_type'])}
          >
            {(Object.keys(TYPE_META) as Interview['interview_type'][]).map((t) => (
              <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
            ))}
          </Select>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date &amp; Time</label>
            <input
              type="datetime-local"
              required
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              value={form.scheduled_at}
              onChange={(e) => set('scheduled_at', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duration (minutes)</label>
            <input
              type="number"
              min={15}
              step={15}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              value={form.duration_minutes}
              onChange={(e) => set('duration_minutes', Number(e.target.value))}
            />
          </div>
          <Input
            label="Meeting URL"
            type="url"
            value={form.meeting_url ?? ''}
            onChange={(e) => set('meeting_url', e.target.value)}
            placeholder="https://..."
          />
        </div>

        <Input
          label="Interviewers (comma-separated names)"
          value={interviewersText}
          onChange={(e) => setInterviewersText(e.target.value)}
          placeholder="Alice, Bob, Carol"
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createMut.isPending}>Schedule</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Feedback Dialog ──────────────────────────────────────────────────────────

function FeedbackDialog({
  interview,
  onClose,
}: {
  interview: Interview | null
  onClose: () => void
}) {
  const [rating, setRating] = useState(0)
  const [recommendation, setRecommendation] = useState<SubmitInterviewFeedbackPayload['recommendation']>('hold')
  const [feedback, setFeedback] = useState('')
  const submitMut = useSubmitInterviewFeedback()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!interview) return
    if (rating === 0) { toast('error', 'Please select a rating'); return }
    try {
      await submitMut.mutateAsync({
        id: interview.id,
        feedback,
        rating,
        recommendation,
        status: 'completed',
      })
      toast('success', 'Feedback submitted')
      onClose()
    } catch {
      toast('error', 'Failed to submit feedback')
    }
  }

  return (
    <Modal open={!!interview} onClose={onClose} title="Submit Interview Feedback" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Star rating */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rating</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-2xl transition-transform hover:scale-110 ${star <= rating ? 'text-[#ffa21d]' : 'text-gray-300 dark:text-gray-600'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Recommendation</label>
          <div className="flex gap-3">
            {(['advance', 'hold', 'reject'] as const).map((rec) => (
              <label key={rec} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="recommendation"
                  value={rec}
                  checked={recommendation === rec}
                  onChange={() => setRecommendation(rec)}
                  className="accent-[#51459d]"
                />
                <span className={`text-sm font-medium capitalize ${
                  rec === 'advance' ? 'text-[#6fd943]'
                  : rec === 'reject' ? 'text-[#ff3a6e]'
                  : 'text-[#ffa21d]'
                }`}>
                  {rec === 'advance' ? 'Advance' : rec === 'reject' ? 'Reject' : 'Hold'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Feedback text */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Feedback Notes</label>
          <textarea
            required
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 resize-none"
            rows={4}
            placeholder="Describe candidate's performance, strengths, concerns..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitMut.isPending}>Submit Feedback</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InterviewScheduler() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<Interview['status'] | 'all'>('all')
  const [showSchedule, setShowSchedule] = useState(false)
  const [feedbackTarget, setFeedbackTarget] = useState<Interview | null>(null)

  const { data, isLoading, isError } = useInterviews({
    page,
    limit: 20,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })

  const cancelMut = useCancelInterview()
  const totalPages = data ? Math.ceil(data.total / 20) : 1

  async function handleCancel(id: string) {
    if (!confirm('Cancel this interview?')) return
    try {
      await cancelMut.mutateAsync(id)
      toast('success', 'Interview cancelled')
    } catch {
      toast('error', 'Failed to cancel interview')
    }
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Interview Scheduler</h1>
          <p className="text-sm text-gray-500 mt-0.5">Upcoming and past interviews</p>
        </div>
        <Button onClick={() => setShowSchedule(true)}>+ Schedule Interview</Button>
      </div>

      {/* Filters */}
      <Card padding={false} className="p-4">
        <div className="flex gap-3">
          <select
            className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Type', 'Application ID', 'Date & Time', 'Duration', 'Interviewers', 'Status', 'Actions'].map((h) => (
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
                  <td colSpan={7} className="px-4 py-12 text-center text-[#ff3a6e]">
                    Failed to load interviews.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No interviews found.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && data?.items.map((iv) => {
                const meta = TYPE_META[iv.interview_type]
                const scheduledDate = new Date(iv.scheduled_at)
                return (
                  <tr key={iv.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span>{meta.icon}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{meta.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{iv.application_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      <div>
                        <p className="font-medium">
                          {scheduledDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{iv.duration_minutes} min</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-[150px]">
                      {iv.interviewer_ids && iv.interviewer_ids.length > 0
                        ? iv.interviewer_ids.join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={iv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {iv.meeting_url && iv.status === 'scheduled' && (
                          <a
                            href={iv.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#51459d] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#51459d]/10 transition-colors"
                          >
                            Join
                          </a>
                        )}
                        {(iv.status === 'scheduled' || (iv.status === 'completed' && !iv.feedback)) && (
                          <button
                            onClick={() => setFeedbackTarget(iv)}
                            className="text-xs text-[#3ec9d6] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#3ec9d6]/10 transition-colors"
                          >
                            Feedback
                          </button>
                        )}
                        {iv.status === 'scheduled' && (
                          <button
                            onClick={() => handleCancel(iv.id)}
                            disabled={cancelMut.isPending}
                            className="text-xs text-[#ff3a6e] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#ff3a6e]/10 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                        {iv.status === 'completed' && iv.rating && (
                          <span className="text-xs text-[#ffa21d] font-medium">
                            {'★'.repeat(iv.rating)}{'☆'.repeat(5 - iv.rating)}
                          </span>
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

      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} />
      <FeedbackDialog interview={feedbackTarget} onClose={() => setFeedbackTarget(null)} />
    </div>
  )
}
