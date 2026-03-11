import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useTrainings,
  useCreateTraining,
  useUpdateTraining,
  useTrainingAttendees,
  useAddTrainingAttendee,
  useRemoveTrainingAttendee,
  useEmployees,
  type Training,
  type TrainingAttendee,
  type CreateTrainingPayload,
  type TrainingStatus,
} from '../../api/hr'

const defaultForm: CreateTrainingPayload = {
  title: '',
  description: '',
  trainer: '',
  start_date: '',
  end_date: '',
  location: '',
  status: 'planned',
  max_attendees: undefined,
  cost: undefined,
}

const statusVariant: Record<TrainingStatus, 'default' | 'info' | 'success' | 'danger'> = {
  planned: 'default',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
}

export default function TrainingPage() {
  const [statusFilter, setStatusFilter] = useState<TrainingStatus | ''>('')
  const { data: trainings, isLoading } = useTrainings({ status: statusFilter || undefined })
  const { data: empData } = useEmployees({ limit: 500 })
  const createTraining = useCreateTraining()
  const updateTraining = useUpdateTraining()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Training | null>(null)
  const [form, setForm] = useState<CreateTrainingPayload>(defaultForm)

  const [attendeeTrainingId, setAttendeeTrainingId] = useState<string | null>(null)
  const { data: attendees } = useTrainingAttendees(attendeeTrainingId ?? '')
  const addAttendee = useAddTrainingAttendee()
  const removeAttendee = useRemoveTrainingAttendee()
  const [newAttendeeId, setNewAttendeeId] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(t: Training) {
    setEditing(t)
    setForm({
      title: t.title,
      description: t.description ?? '',
      trainer: t.trainer ?? '',
      start_date: t.start_date.slice(0, 10),
      end_date: t.end_date.slice(0, 10),
      location: t.location ?? '',
      status: t.status,
      max_attendees: t.max_attendees ?? undefined,
      cost: t.cost ?? undefined,
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      updateTraining.mutate(
        { id: editing.id, ...form },
        {
          onSuccess: () => { toast('success', 'Training updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update training'),
        }
      )
    } else {
      createTraining.mutate(form, {
        onSuccess: () => { toast('success', 'Training created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create training'),
      })
    }
  }

  function handleAddAttendee() {
    if (!attendeeTrainingId || !newAttendeeId) return
    addAttendee.mutate(
      { trainingId: attendeeTrainingId, employee_id: newAttendeeId },
      {
        onSuccess: () => { toast('success', 'Attendee added'); setNewAttendeeId('') },
        onError: () => toast('error', 'Failed to add attendee'),
      }
    )
  }

  function handleRemoveAttendee(attendee: TrainingAttendee) {
    if (!attendeeTrainingId) return
    removeAttendee.mutate(
      { trainingId: attendeeTrainingId, attendeeId: attendee.id },
      {
        onSuccess: () => toast('success', 'Attendee removed'),
        onError: () => toast('error', 'Failed to remove attendee'),
      }
    )
  }

  const columns = [
    {
      key: 'title',
      label: 'Training',
      render: (t: Training) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{t.title}</p>
          {t.trainer && <p className="text-xs text-gray-400">Trainer: {t.trainer}</p>}
        </div>
      ),
    },
    {
      key: 'dates',
      label: 'Dates',
      render: (t: Training) => (
        <span className="text-sm">
          {new Date(t.start_date).toLocaleDateString()} - {new Date(t.end_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (t: Training) => <Badge variant={statusVariant[t.status]}>{t.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'attendee_count',
      label: 'Attendees',
      render: (t: Training) => (
        <Badge variant="primary">
          {t.attendee_count}{t.max_attendees ? ` / ${t.max_attendees}` : ''}
        </Badge>
      ),
    },
    {
      key: 'cost',
      label: 'Cost',
      render: (t: Training) => t.cost != null ? `$${t.cost.toLocaleString()}` : '-',
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (t: Training) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAttendeeTrainingId(t.id)}>Attendees</Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Edit</Button>
        </div>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Training Programs</h1>
          <p className="text-sm text-gray-500 mt-1">Manage employee training and development</p>
        </div>
        <Button onClick={openCreate}>Create Training</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'planned', label: 'Planned' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TrainingStatus | '')}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={trainings ?? []}
          keyExtractor={(t) => t.id}
          emptyText="No training programs found."
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Training' : 'Create Training'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Trainer" value={form.trainer ?? ''} onChange={(e) => setForm((p) => ({ ...p, trainer: e.target.value }))} />
            <Input label="Location" value={form.location ?? ''} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" required value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            <Input label="End Date" type="date" required value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Status"
              options={[
                { value: 'planned', label: 'Planned' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={form.status ?? 'planned'}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TrainingStatus }))}
            />
            <Input
              label="Max Attendees"
              type="number"
              value={form.max_attendees ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, max_attendees: e.target.value ? Number(e.target.value) : undefined }))}
            />
            <Input
              label="Cost ($)"
              type="number"
              step="0.01"
              value={form.cost ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createTraining.isPending || updateTraining.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Attendees Modal */}
      <Modal open={!!attendeeTrainingId} onClose={() => setAttendeeTrainingId(null)} title="Manage Attendees" size="lg">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Select
              options={[
                { value: '', label: 'Select employee...' },
                ...(empData?.items?.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
              ]}
              value={newAttendeeId}
              onChange={(e) => setNewAttendeeId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddAttendee} disabled={!newAttendeeId} loading={addAttendee.isPending}>
              Add
            </Button>
          </div>
          <div className="border rounded-[10px] divide-y divide-gray-100">
            {attendees && attendees.length > 0 ? (
              attendees.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{a.employee_name ?? 'Unknown'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={a.status === 'attended' ? 'success' : a.status === 'absent' ? 'danger' : 'default'}>
                        {a.status}
                      </Badge>
                      {a.score != null && <span className="text-xs text-gray-500">Score: {a.score}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleRemoveAttendee(a)}>
                    Remove
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-gray-400 text-sm">No attendees yet</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
