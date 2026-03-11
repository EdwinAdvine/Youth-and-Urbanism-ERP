import { useState } from 'react'
import {
  useActivities,
  useCreateActivity,
  useDeleteActivity,
  type SalesActivity,
  type ActivityCreatePayload,
} from '@/api/crm_v2'
import { Button, Badge, Card, Modal, Input, Select, Table, toast } from '@/components/ui'

const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'task', 'note', 'demo', 'follow_up']

const TYPE_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  call: 'info',
  email: 'primary',
  meeting: 'success',
  task: 'warning',
  note: 'default',
  demo: 'info',
  follow_up: 'warning',
}

const EMPTY_FORM: ActivityCreatePayload = {
  activity_type: 'call',
  subject: '',
  description: '',
  contact_id: null,
  due_date: null,
  duration_minutes: null,
  outcome: null,
}

export default function ActivitiesPage() {
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const { data, isLoading } = useActivities({ activity_type: typeFilter, page })
  const createActivity = useCreateActivity()
  const deleteActivity = useDeleteActivity()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ActivityCreatePayload>(EMPTY_FORM)

  const activities: SalesActivity[] = data?.items ?? data ?? []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createActivity.mutateAsync(form)
      toast('success', 'Activity created')
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } catch {
      toast('error', 'Failed to create activity')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this activity?')) return
    try {
      await deleteActivity.mutateAsync(id)
      toast('success', 'Activity deleted')
    } catch {
      toast('error', 'Failed to delete activity')
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Activities
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track all sales activities across your team
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Log Activity</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select
          label="Activity Type"
          value={typeFilter ?? ''}
          onChange={(e) => { setTypeFilter(e.target.value || undefined); setPage(1) }}
          options={[
            { value: '', label: 'All Types' },
            ...ACTIVITY_TYPES.map((t) => ({
              value: t,
              label: t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            })),
          ]}
        />
      </div>

      {/* Activities Table */}
      <Card padding={false}>
        <Table<SalesActivity>
          loading={isLoading}
          data={activities}
          keyExtractor={(a) => a.id}
          emptyText="No activities recorded."
          columns={[
            { key: 'activity_type', label: 'Type', render: (a) => (
              <Badge variant={TYPE_COLORS[a.activity_type] ?? 'default'}>
                {a.activity_type.replace(/_/g, ' ')}
              </Badge>
            )},
            { key: 'subject', label: 'Subject', render: (a) => (
              <span className="font-medium text-gray-900 dark:text-gray-100">{a.subject}</span>
            )},
            { key: 'contact_id', label: 'Contact', render: (a) => (
              a.contact_id ? (
                <span className="text-sm text-primary truncate">{a.contact_id}</span>
              ) : (
                <span className="text-xs text-gray-400">-</span>
              )
            )},
            { key: 'due_date', label: 'Date', render: (a) => (
              <span className="text-sm text-gray-500">
                {a.due_date ? new Date(a.due_date).toLocaleDateString() : a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}
              </span>
            )},
            { key: 'duration_minutes', label: 'Duration', render: (a) => (
              a.duration_minutes ? (
                <span className="text-sm text-gray-500">{a.duration_minutes}m</span>
              ) : (
                <span className="text-xs text-gray-400">-</span>
              )
            )},
            { key: 'outcome', label: 'Outcome', render: (a) => (
              a.outcome ? (
                <Badge variant={a.outcome === 'positive' ? 'success' : a.outcome === 'negative' ? 'danger' : 'default'}>
                  {a.outcome}
                </Badge>
              ) : (
                <span className="text-xs text-gray-400">-</span>
              )
            )},
            { key: 'completed_at', label: 'Status', render: (a) => (
              a.completed_at ? (
                <Badge variant="success">Done</Badge>
              ) : (
                <Badge variant="warning">Open</Badge>
              )
            )},
            { key: 'actions', label: '', render: (a) => (
              <Button size="sm" variant="danger" onClick={() => handleDelete(a.id)}>
                Delete
              </Button>
            )},
          ]}
        />
      </Card>

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Activity">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Activity Type"
              required
              value={form.activity_type}
              onChange={(e) => setForm((f) => ({ ...f, activity_type: e.target.value }))}
              options={ACTIVITY_TYPES.map((t) => ({
                value: t,
                label: t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              }))}
            />
            <Input
              label="Subject"
              required
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Discovery call with Acme"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact ID"
              value={form.contact_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value || null }))}
              placeholder="Optional"
            />
            <Input
              label="Due Date"
              type="date"
              value={form.due_date ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value || null }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (minutes)"
              type="number"
              min={0}
              value={form.duration_minutes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value ? parseInt(e.target.value) : null }))}
            />
            <Select
              label="Outcome"
              value={form.outcome ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value || null }))}
              options={[
                { value: '', label: 'None' },
                { value: 'positive', label: 'Positive' },
                { value: 'neutral', label: 'Neutral' },
                { value: 'negative', label: 'Negative' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createActivity.isPending}>
              Log Activity
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
