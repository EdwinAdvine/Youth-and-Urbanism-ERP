import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useReviewCycles,
  useCreateReviewCycle,
  useUpdateReviewCycle,
  useLaunchReviewCycle,
  useAdvanceReviewCycle,
  useReviewCycleAssignments,
  useMyReviewAssignments,
  useSubmitReviewAssignment,
  type ReviewCycle,
  type ReviewCycleCreatePayload,
  type ReviewAssignment,
  type ReviewSubmitPayload,
} from '../../api/hr_phase1'

const textareaClass =
  'w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

const statusVariant: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  draft: 'default',
  active: 'info',
  peer_review: 'warning',
  manager_review: 'warning',
  completed: 'success',
}

const cycleTypeVariant: Record<string, 'info' | 'warning' | 'primary'> = {
  annual: 'info',
  semi_annual: 'info',
  quarterly: 'warning',
  '360': 'primary',
}

const defaultForm: ReviewCycleCreatePayload = {
  name: '',
  cycle_type: 'annual',
  start_date: '',
  end_date: '',
  self_review_deadline: '',
  peer_review_deadline: '',
  manager_review_deadline: '',
  department_ids: [],
}

const defaultReviewForm: ReviewSubmitPayload = {
  rating: 3,
  comments: '',
  strengths: '',
  improvements: '',
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`text-xl transition-colors ${star <= value ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'} ${onChange ? 'cursor-pointer hover:text-yellow-300' : 'cursor-default'}`}
          onClick={() => onChange?.(star)}
          disabled={!onChange}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function ReviewCyclesPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const { data: cycles, isLoading } = useReviewCycles({
    status: statusFilter || undefined,
    cycle_type: typeFilter || undefined,
  })

  const createCycle = useCreateReviewCycle()
  const updateCycle = useUpdateReviewCycle()
  const launchCycle = useLaunchReviewCycle()
  const advanceCycle = useAdvanceReviewCycle()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ReviewCycle | null>(null)
  const [form, setForm] = useState<ReviewCycleCreatePayload>(defaultForm)

  // Detail view
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const { data: assignments, isLoading: assignmentsLoading } = useReviewCycleAssignments(selectedCycleId ?? '')

  // My reviews
  const { data: myAssignments } = useMyReviewAssignments()

  // Submit review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewAssignmentId, setReviewAssignmentId] = useState<string | null>(null)
  const [reviewForm, setReviewForm] = useState<ReviewSubmitPayload>(defaultReviewForm)
  const submitReview = useSubmitReviewAssignment()

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(cycle: ReviewCycle) {
    setEditing(cycle)
    setForm({
      name: cycle.name,
      cycle_type: cycle.cycle_type,
      start_date: cycle.start_date,
      end_date: cycle.end_date,
      self_review_deadline: cycle.self_review_deadline ?? '',
      peer_review_deadline: cycle.peer_review_deadline ?? '',
      manager_review_deadline: cycle.manager_review_deadline ?? '',
      department_ids: cycle.department_ids ?? [],
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      department_ids: form.department_ids && form.department_ids.length > 0 ? form.department_ids : undefined,
      self_review_deadline: form.self_review_deadline || undefined,
      peer_review_deadline: form.peer_review_deadline || undefined,
      manager_review_deadline: form.manager_review_deadline || undefined,
    }
    if (editing) {
      updateCycle.mutate(
        { cycleId: editing.id, data: payload },
        {
          onSuccess: () => { toast('success', 'Review cycle updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update review cycle'),
        }
      )
    } else {
      createCycle.mutate(payload, {
        onSuccess: () => { toast('success', 'Review cycle created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create review cycle'),
      })
    }
  }

  function handleLaunch(cycleId: string) {
    launchCycle.mutate(cycleId, {
      onSuccess: () => toast('success', 'Review cycle launched'),
      onError: () => toast('error', 'Failed to launch review cycle'),
    })
  }

  function handleAdvance(cycleId: string) {
    advanceCycle.mutate(cycleId, {
      onSuccess: () => toast('success', 'Review cycle advanced to next phase'),
      onError: () => toast('error', 'Failed to advance review cycle'),
    })
  }

  function openSubmitReview(assignmentId: string) {
    setReviewAssignmentId(assignmentId)
    setReviewForm(defaultReviewForm)
    setReviewModalOpen(true)
  }

  function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewAssignmentId) return
    submitReview.mutate(
      { assignmentId: reviewAssignmentId, data: reviewForm },
      {
        onSuccess: () => { toast('success', 'Review submitted'); setReviewModalOpen(false) },
        onError: () => toast('error', 'Failed to submit review'),
      }
    )
  }

  const cycleColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (r: ReviewCycle) => (
        <button
          className="text-primary hover:underline font-medium text-left"
          onClick={() => setSelectedCycleId(r.id)}
        >
          {r.name}
        </button>
      ),
    },
    {
      key: 'cycle_type',
      label: 'Type',
      render: (r: ReviewCycle) => (
        <Badge variant={cycleTypeVariant[r.cycle_type] ?? 'info'}>{r.cycle_type.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'start_date',
      label: 'Start Date',
      render: (r: ReviewCycle) => new Date(r.start_date).toLocaleDateString(),
    },
    {
      key: 'end_date',
      label: 'End Date',
      render: (r: ReviewCycle) => new Date(r.end_date).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: ReviewCycle) => (
        <Badge variant={statusVariant[r.status] ?? 'default'}>{r.status.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'self_review_deadline',
      label: 'Self Deadline',
      render: (r: ReviewCycle) => r.self_review_deadline ? new Date(r.self_review_deadline).toLocaleDateString() : '-',
    },
    {
      key: 'peer_review_deadline',
      label: 'Peer Deadline',
      render: (r: ReviewCycle) => r.peer_review_deadline ? new Date(r.peer_review_deadline).toLocaleDateString() : '-',
    },
    {
      key: 'manager_review_deadline',
      label: 'Manager Deadline',
      render: (r: ReviewCycle) => r.manager_review_deadline ? new Date(r.manager_review_deadline).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (r: ReviewCycle) => (
        <div className="flex items-center justify-end gap-2">
          {r.status === 'draft' && (
            <Button variant="outline" size="sm" onClick={() => handleLaunch(r.id)} loading={launchCycle.isPending}>
              Launch
            </Button>
          )}
          {r.status !== 'draft' && r.status !== 'completed' && (
            <Button variant="outline" size="sm" onClick={() => handleAdvance(r.id)} loading={advanceCycle.isPending}>
              Advance
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
        </div>
      ),
    },
  ]

  const assignmentColumns = [
    {
      key: 'reviewee_id',
      label: 'Reviewee',
      render: (r: ReviewAssignment) => (
        <span className="text-gray-900 dark:text-gray-100 font-medium">{r.reviewee_id}</span>
      ),
    },
    {
      key: 'reviewer_id',
      label: 'Reviewer',
      render: (r: ReviewAssignment) => (
        <span className="text-gray-700 dark:text-gray-300">{r.reviewer_id}</span>
      ),
    },
    {
      key: 'review_type',
      label: 'Type',
      render: (r: ReviewAssignment) => (
        <Badge variant="info">{r.review_type}</Badge>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (r: ReviewAssignment) => r.rating != null ? <StarRating value={r.rating} /> : <span className="text-gray-400">-</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: ReviewAssignment) => {
        const v: Record<string, 'default' | 'warning' | 'success'> = { pending: 'default', in_progress: 'warning', submitted: 'success' }
        return <Badge variant={v[r.status] ?? 'default'}>{r.status.replace('_', ' ')}</Badge>
      },
    },
  ]

  const myPending = (myAssignments as ReviewAssignment[] | undefined)?.filter((a) => a.status !== 'submitted') ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">360° Review Cycles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage performance review cycles and assignments</p>
        </div>
        <Button onClick={openCreate}>Create Cycle</Button>
      </div>

      {/* My Pending Reviews */}
      {myPending.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">My Pending Reviews</h2>
          <div className="space-y-3">
            {myPending.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Review for: {a.reviewee_id}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Type: {a.review_type} | Status: {a.status.replace('_', ' ')}
                  </p>
                </div>
                <Button size="sm" onClick={() => openSubmitReview(a.id)}>Submit Review</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'peer_review', label: 'Peer Review' },
            { value: 'manager_review', label: 'Manager Review' },
            { value: 'completed', label: 'Completed' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        />
        <Select
          options={[
            { value: '', label: 'All Types' },
            { value: 'annual', label: 'Annual' },
            { value: 'semi_annual', label: 'Semi-Annual' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: '360', label: '360' },
          ]}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Cycles Table */}
      <Card padding={false}>
        <Table
          columns={cycleColumns}
          data={(cycles as ReviewCycle[]) ?? []}
          keyExtractor={(r) => r.id}
          emptyText="No review cycles found."
        />
      </Card>

      {/* Cycle Detail / Assignments */}
      {selectedCycleId && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cycle Assignments</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCycleId(null)}>Close</Button>
          </div>
          {assignmentsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <Table
              columns={assignmentColumns}
              data={(assignments as ReviewAssignment[]) ?? []}
              keyExtractor={(r) => r.id}
              emptyText="No assignments found for this cycle."
            />
          )}
        </Card>
      )}

      {/* Create/Edit Cycle Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Review Cycle' : 'Create Review Cycle'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            placeholder="Q1 2026 Performance Review"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Select
            label="Cycle Type"
            required
            options={[
              { value: 'annual', label: 'Annual' },
              { value: 'semi_annual', label: 'Semi-Annual' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: '360', label: '360° Review' },
            ]}
            value={form.cycle_type}
            onChange={(e) => setForm((p) => ({ ...p, cycle_type: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              required
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Self Review Deadline"
              type="date"
              value={form.self_review_deadline ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, self_review_deadline: e.target.value }))}
            />
            <Input
              label="Peer Review Deadline"
              type="date"
              value={form.peer_review_deadline ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, peer_review_deadline: e.target.value }))}
            />
            <Input
              label="Manager Review Deadline"
              type="date"
              value={form.manager_review_deadline ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, manager_review_deadline: e.target.value }))}
            />
          </div>
          <Input
            label="Department IDs (comma-separated)"
            placeholder="dept-1, dept-2"
            value={(form.department_ids ?? []).join(', ')}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                department_ids: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createCycle.isPending || updateCycle.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Submit Review Modal */}
      <Modal open={reviewModalOpen} onClose={() => setReviewModalOpen(false)} title="Submit Review" size="lg">
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rating</label>
            <StarRating value={reviewForm.rating} onChange={(v) => setReviewForm((p) => ({ ...p, rating: v }))} />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comments</label>
            <textarea
              className={textareaClass}
              rows={3}
              value={reviewForm.comments ?? ''}
              onChange={(e) => setReviewForm((p) => ({ ...p, comments: e.target.value }))}
              placeholder="Overall comments on performance..."
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Strengths</label>
            <textarea
              className={textareaClass}
              rows={3}
              value={reviewForm.strengths ?? ''}
              onChange={(e) => setReviewForm((p) => ({ ...p, strengths: e.target.value }))}
              placeholder="Key strengths observed..."
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Areas for Improvement</label>
            <textarea
              className={textareaClass}
              rows={3}
              value={reviewForm.improvements ?? ''}
              onChange={(e) => setReviewForm((p) => ({ ...p, improvements: e.target.value }))}
              placeholder="Areas that need improvement..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submitReview.isPending}>Submit Review</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
