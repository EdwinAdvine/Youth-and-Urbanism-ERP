import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useMaintenanceSchedules,
  useCreateMaintenanceSchedule,
  useUpdateMaintenanceSchedule,
  useDeleteMaintenanceSchedule,
  type MaintenanceSchedule,
  type CreateMaintenanceSchedulePayload,
} from '../../api/manufacturing_ext'

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  overdue: 'danger',
  cancelled: 'default',
}

const emptyForm: CreateMaintenanceSchedulePayload = {
  workstation_id: '',
  title: '',
  description: '',
  maintenance_type: 'preventive',
  frequency: 'monthly',
  scheduled_date: '',
  estimated_duration_hours: undefined,
  cost: undefined,
  notes: '',
}

export default function MaintenancePage() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading, error } = useMaintenanceSchedules({ status: statusFilter || undefined })
  const createMaint = useCreateMaintenanceSchedule()
  const updateMaint = useUpdateMaintenanceSchedule()
  const deleteMaint = useDeleteMaintenanceSchedule()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MaintenanceSchedule | null>(null)
  const [form, setForm] = useState<CreateMaintenanceSchedulePayload>(emptyForm)

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowModal(false) }

  const handleEdit = (m: MaintenanceSchedule) => {
    setEditing(m)
    setForm({
      workstation_id: m.workstation_id,
      title: m.title,
      description: m.description || '',
      maintenance_type: m.maintenance_type,
      frequency: m.frequency,
      scheduled_date: m.scheduled_date.slice(0, 10),
      estimated_duration_hours: m.estimated_duration_hours || undefined,
      cost: m.cost || undefined,
      notes: m.notes || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateMaint.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Schedule updated')
      } else {
        await createMaint.mutateAsync(form)
        toast('success', 'Schedule created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save schedule')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule?')) return
    try {
      await deleteMaint.mutateAsync(id)
      toast('success', 'Schedule deleted')
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  const handleMarkComplete = async (m: MaintenanceSchedule) => {
    try {
      await updateMaint.mutateAsync({
        id: m.id,
        status: 'completed',
        completed_date: new Date().toISOString(),
      })
      toast('success', 'Marked as completed')
    } catch {
      toast('error', 'Failed to update')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load maintenance schedules</div>

  const schedules = data?.schedules ?? []

  // Calendar-like view: group by month
  const byMonth: Record<string, MaintenanceSchedule[]> = {}
  schedules.forEach((s) => {
    const month = s.scheduled_date.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(s)
  })

  const columns = [
    { key: 'title', label: 'Title', render: (r: MaintenanceSchedule) => <span className="font-medium text-gray-900">{r.title}</span> },
    { key: 'workstation', label: 'Workstation', render: (r: MaintenanceSchedule) => <span className="text-sm">{r.workstation_name || r.workstation_id.slice(0, 8)}</span> },
    { key: 'type', label: 'Type', render: (r: MaintenanceSchedule) => <Badge variant="primary">{r.maintenance_type}</Badge> },
    { key: 'frequency', label: 'Frequency', render: (r: MaintenanceSchedule) => <span className="text-sm text-gray-600 capitalize">{r.frequency.replace(/_/g, ' ')}</span> },
    { key: 'scheduled_date', label: 'Scheduled', render: (r: MaintenanceSchedule) => <span className="text-sm">{new Date(r.scheduled_date).toLocaleDateString()}</span> },
    { key: 'status', label: 'Status', render: (r: MaintenanceSchedule) => <Badge variant={statusColors[r.status]}>{r.status.replace(/_/g, ' ')}</Badge> },
    { key: 'assigned', label: 'Assigned To', render: (r: MaintenanceSchedule) => <span className="text-sm text-gray-500">{r.assigned_to_name || '-'}</span> },
    {
      key: 'actions',
      label: '',
      render: (r: MaintenanceSchedule) => (
        <div className="flex gap-1">
          {r.status !== 'completed' && r.status !== 'cancelled' && (
            <Button size="sm" variant="ghost" onClick={() => handleMarkComplete(r)}>Complete</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Schedules</h1>
          <p className="text-sm text-gray-500 mt-1">Plan and track workstation maintenance</p>
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            options={[{ value: '', label: 'All Status' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In Progress' }, { value: 'overdue', label: 'Overdue' }, { value: 'completed', label: 'Completed' }]} />
          <Button onClick={() => { resetForm(); setShowModal(true) }}>Schedule Maintenance</Button>
        </div>
      </div>

      {/* Calendar Summary */}
      {Object.keys(byMonth).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(byMonth).slice(0, 6).map(([month, items]) => (
            <Card key={month} className="text-center">
              <p className="text-sm font-medium text-gray-500">{month}</p>
              <p className="text-2xl font-bold text-primary mt-1">{items.length}</p>
              <div className="flex justify-center gap-1 mt-2">
                {items.slice(0, 4).map((i) => (
                  <div key={i.id} className={`w-2 h-2 rounded-full ${statusColors[i.status] === 'success' ? 'bg-green-500' : statusColors[i.status] === 'danger' ? 'bg-red-500' : statusColors[i.status] === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card padding={false}>
        <Table columns={columns} data={schedules} loading={isLoading} keyExtractor={(r) => r.id} emptyText="No maintenance schedules" />
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Schedule' : 'Schedule Maintenance'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input label="Workstation ID" value={form.workstation_id} onChange={(e) => setForm({ ...form, workstation_id: e.target.value })} required />
          <Input label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-3 gap-4">
            <Select label="Type" value={form.maintenance_type} onChange={(e) => setForm({ ...form, maintenance_type: e.target.value as 'preventive' | 'corrective' | 'predictive' })}
              options={[{ value: 'preventive', label: 'Preventive' }, { value: 'corrective', label: 'Corrective' }, { value: 'predictive', label: 'Predictive' }]} />
            <Select label="Frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as CreateMaintenanceSchedulePayload['frequency'] })}
              options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'yearly', label: 'Yearly' }, { value: 'one_time', label: 'One Time' }]} />
            <Input label="Scheduled Date" type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Est. Duration (hrs)" type="number" step="0.5" min="0" value={form.estimated_duration_hours ?? ''} onChange={(e) => setForm({ ...form, estimated_duration_hours: e.target.value ? parseFloat(e.target.value) : undefined })} />
            <Input label="Est. Cost" type="number" step="0.01" min="0" value={form.cost ?? ''} onChange={(e) => setForm({ ...form, cost: e.target.value ? parseFloat(e.target.value) : undefined })} />
          </div>
          <Input label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createMaint.isPending || updateMaint.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
