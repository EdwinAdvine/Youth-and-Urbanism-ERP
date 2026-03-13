import { useState } from 'react'
import { Button, Card, Badge, Modal, Input, Select, Spinner, toast } from '../../components/ui'
import { useDockSchedules, useCreateDockSchedule, type DockSchedule } from '../../api/supplychain_logistics'

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'info',
  arrived: 'warning',
  loading: 'warning',
  unloading: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

const DIRECTION_OPTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'loading', label: 'Loading' },
  { value: 'unloading', label: 'Unloading' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function formatDateTime(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DockSchedulesPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    dock_door: '',
    direction: 'inbound',
    scheduled_start: '',
    scheduled_end: '',
    carrier_name: '',
    driver_name: '',
    trailer_number: '',
    notes: '',
  })

  const { data: schedules, isLoading } = useDockSchedules(statusFilter ? { status: statusFilter } : undefined)
  const createSchedule = useCreateDockSchedule()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createSchedule.mutateAsync({ ...form })
      toast('success', 'Dock schedule created')
      setShowModal(false)
      setForm({ dock_door: '', direction: 'inbound', scheduled_start: '', scheduled_end: '', carrier_name: '', driver_name: '', trailer_number: '', notes: '' })
    } catch {
      toast('error', 'Failed to create dock schedule')
    }
  }

  const items: DockSchedule[] = Array.isArray(schedules) ? schedules : (schedules as { schedules?: DockSchedule[] })?.schedules ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dock Schedules</h1>
          <p className="text-sm text-gray-500 mt-1">Manage inbound and outbound dock appointments</p>
        </div>
        <Button onClick={() => setShowModal(true)}>Schedule Dock</Button>
      </div>

      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={STATUS_OPTIONS}
          className="w-48"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">No dock schedules found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Dock {s.dock_door}</span>
                    <Badge variant={s.direction === 'inbound' ? 'info' : 'warning'}>
                      {s.direction}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[s.status] ?? 'default'}>
                      {s.status}
                    </Badge>
                  </div>
                  {s.carrier_name && (
                    <p className="text-sm text-gray-500 mt-1">Carrier: {s.carrier_name}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Scheduled Start</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{formatDateTime(s.scheduled_start)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Scheduled End</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{formatDateTime(s.scheduled_end)}</p>
                </div>
                {s.actual_arrival && (
                  <div>
                    <p className="text-xs text-gray-400">Actual Arrival</p>
                    <p className="font-medium text-green-600">{formatDateTime(s.actual_arrival)}</p>
                  </div>
                )}
                {s.actual_departure && (
                  <div>
                    <p className="text-xs text-gray-400">Actual Departure</p>
                    <p className="font-medium text-green-600">{formatDateTime(s.actual_departure)}</p>
                  </div>
                )}
              </div>

              {(s.driver_name || s.trailer_number) && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-4 text-xs text-gray-500">
                  {s.driver_name && <span>Driver: {s.driver_name}</span>}
                  {s.trailer_number && <span>Trailer: {s.trailer_number}</span>}
                </div>
              )}
              {s.notes && (
                <p className="mt-2 text-xs text-gray-400 italic">{s.notes}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Schedule Dock Appointment" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Dock Door"
              value={form.dock_door}
              onChange={(e) => setForm({ ...form, dock_door: e.target.value })}
              placeholder="e.g. D1, D2"
              required
            />
            <Select
              label="Direction"
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              options={DIRECTION_OPTIONS}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Scheduled Start"
              type="datetime-local"
              value={form.scheduled_start}
              onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })}
              required
            />
            <Input
              label="Scheduled End"
              type="datetime-local"
              value={form.scheduled_end}
              onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Carrier Name" value={form.carrier_name} onChange={(e) => setForm({ ...form, carrier_name: e.target.value })} />
            <Input label="Driver Name" value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Trailer Number" value={form.trailer_number} onChange={(e) => setForm({ ...form, trailer_number: e.target.value })} />
            <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createSchedule.isPending}>Create Schedule</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
