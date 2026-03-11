import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  usePerformanceReviews,
  useCreatePerformanceReview,
  useUpdatePerformanceReview,
  useEmployees,
  type PerformanceReview,
  type CreatePerformanceReviewPayload,
} from '../../api/hr'

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`text-xl transition-colors ${star <= value ? 'text-yellow-400' : 'text-gray-300'} ${onChange ? 'cursor-pointer hover:text-yellow-300' : 'cursor-default'}`}
          onClick={() => onChange?.(star)}
          disabled={!onChange}
        >
          ★
        </button>
      ))}
    </div>
  )
}

const defaultForm: CreatePerformanceReviewPayload = {
  employee_id: '',
  review_period: '',
  rating: 3,
  goals: '',
  strengths: '',
  areas_for_improvement: '',
  comments: '',
  status: 'draft',
}

export default function PerformanceReviewsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: reviews, isLoading } = usePerformanceReviews({ status: statusFilter || undefined })
  const { data: empData } = useEmployees({ limit: 500 })
  const createReview = useCreatePerformanceReview()
  const updateReview = useUpdatePerformanceReview()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PerformanceReview | null>(null)
  const [form, setForm] = useState<CreatePerformanceReviewPayload>(defaultForm)

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(review: PerformanceReview) {
    setEditing(review)
    setForm({
      employee_id: review.employee_id,
      review_period: review.review_period,
      rating: review.rating,
      goals: review.goals ?? '',
      strengths: review.strengths ?? '',
      areas_for_improvement: review.areas_for_improvement ?? '',
      comments: review.comments ?? '',
      status: review.status,
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      updateReview.mutate(
        { id: editing.id, ...form },
        {
          onSuccess: () => { toast('success', 'Review updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update review'),
        }
      )
    } else {
      createReview.mutate(form, {
        onSuccess: () => { toast('success', 'Review created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create review'),
      })
    }
  }

  const statusVariant: Record<string, 'default' | 'warning' | 'success'> = {
    draft: 'default',
    submitted: 'warning',
    acknowledged: 'success',
  }

  const columns = [
    {
      key: 'employee_name',
      label: 'Employee',
      render: (r: PerformanceReview) => (
        <div>
          <p className="font-medium text-gray-900">{r.employee_name ?? 'Unknown'}</p>
          <p className="text-xs text-gray-400">{r.review_period}</p>
        </div>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (r: PerformanceReview) => <StarRating value={r.rating} />,
    },
    {
      key: 'reviewer_name',
      label: 'Reviewer',
      render: (r: PerformanceReview) => r.reviewer_name ?? '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: PerformanceReview) => (
        <Badge variant={statusVariant[r.status] ?? 'default'}>{r.status}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (r: PerformanceReview) => new Date(r.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (r: PerformanceReview) => (
        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
      ),
    },
  ]

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
          <h1 className="text-2xl font-bold text-gray-900">Performance Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">Employee performance evaluations and ratings</p>
        </div>
        <Button onClick={openCreate}>Create Review</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'submitted', label: 'Submitted' },
            { value: 'acknowledged', label: 'Acknowledged' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={reviews ?? []}
          keyExtractor={(r) => r.id}
          emptyText="No performance reviews found."
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Review' : 'Create Review'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <Select
              label="Employee"
              required
              options={[
                { value: '', label: 'Select employee...' },
                ...(empData?.items?.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
              ]}
              value={form.employee_id}
              onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
            />
          )}
          <Input
            label="Review Period"
            required
            placeholder="e.g., Q1 2026, H1 2026"
            value={form.review_period}
            onChange={(e) => setForm((p) => ({ ...p, review_period: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Rating</label>
            <StarRating value={form.rating} onChange={(v) => setForm((p) => ({ ...p, rating: v }))} />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Goals</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.goals ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, goals: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Strengths</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.strengths ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, strengths: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Areas for Improvement</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.areas_for_improvement ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, areas_for_improvement: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Comments</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={2}
              value={form.comments ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, comments: e.target.value }))}
            />
          </div>
          <Select
            label="Status"
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'acknowledged', label: 'Acknowledged' },
            ]}
            value={form.status ?? 'draft'}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as 'draft' | 'submitted' | 'acknowledged' }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createReview.isPending || updateReview.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
