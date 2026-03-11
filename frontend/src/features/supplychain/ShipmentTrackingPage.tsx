import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Select, Badge, Spinner, toast } from '../../components/ui'
import {
  useShipments,
  useCreateShipment,
  useTrackShipment,
  type Shipment,
  type CreateShipmentPayload,
} from '../../api/supplychain_ext'

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning',
  in_transit: 'info',
  delivered: 'success',
  delayed: 'danger',
  cancelled: 'default',
}

const emptyForm: CreateShipmentPayload = {
  origin: '',
  destination: '',
  carrier: '',
  tracking_number: '',
  estimated_departure: '',
  estimated_arrival: '',
}

export default function ShipmentTrackingPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20
  const { data, isLoading, error } = useShipments({ status: statusFilter || undefined, skip: (page - 1) * limit, limit })
  const createShipment = useCreateShipment()

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateShipmentPayload>(emptyForm)
  const [trackingId, setTrackingId] = useState('')
  const { data: events, isLoading: eventsLoading } = useTrackShipment(trackingId)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createShipment.mutateAsync(form)
      toast('success', 'Shipment created')
      setForm(emptyForm)
      setShowCreate(false)
    } catch {
      toast('error', 'Failed to create shipment')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load shipments</div>

  const columns = [
    { key: 'shipment_number', label: 'Shipment #', render: (r: Shipment) => <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{r.shipment_number}</span> },
    { key: 'origin', label: 'Origin', render: (r: Shipment) => <span className="text-sm">{r.origin}</span> },
    { key: 'destination', label: 'Destination', render: (r: Shipment) => <span className="text-sm">{r.destination}</span> },
    { key: 'carrier', label: 'Carrier', render: (r: Shipment) => <span className="text-sm text-gray-600 dark:text-gray-400">{r.carrier || '-'}</span> },
    { key: 'tracking', label: 'Tracking #', render: (r: Shipment) => <span className="text-sm font-mono text-gray-500">{r.tracking_number || '-'}</span> },
    { key: 'status', label: 'Status', render: (r: Shipment) => <Badge variant={statusColors[r.status] || 'default'}>{r.status.replace(/_/g, ' ')}</Badge> },
    { key: 'eta', label: 'ETA', render: (r: Shipment) => <span className="text-sm text-gray-500">{r.estimated_arrival ? new Date(r.estimated_arrival).toLocaleDateString() : '-'}</span> },
    {
      key: 'actions',
      label: '',
      render: (r: Shipment) => (
        <Button size="sm" variant="ghost" onClick={() => setTrackingId(trackingId === r.id ? '' : r.id)}>
          {trackingId === r.id ? 'Hide' : 'Track'}
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shipment Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage shipments</p>
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            options={[
              { value: '', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'in_transit', label: 'In Transit' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'delayed', label: 'Delayed' },
            ]}
          />
          <Button onClick={() => setShowCreate(true)}>Create Shipment</Button>
        </div>
      </div>

      <Card padding={false}>
        <Table columns={columns} data={data?.shipments ?? []} loading={isLoading} keyExtractor={(r) => r.id} emptyText="No shipments found" />
      </Card>

      {/* Tracking Timeline */}
      {trackingId && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Shipment Timeline</h2>
          {eventsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !events || events.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No tracking events</p>
          ) : (
            <div className="relative pl-8">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
              {events.map((ev, i) => (
                <div key={ev.id} className="relative pb-6 last:pb-0">
                  <div className={`absolute left-[-1.25rem] w-3 h-3 rounded-full border-2 ${ i === 0 ? 'bg-primary border-primary' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600' }`} />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ev.status}</p>
                    {ev.location && <p className="text-xs text-gray-500">{ev.location}</p>}
                    <p className="text-xs text-gray-400">{ev.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(ev.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Shipment" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Origin" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} required />
            <Input label="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Carrier" value={form.carrier || ''} onChange={(e) => setForm({ ...form, carrier: e.target.value })} />
            <Input label="Tracking Number" value={form.tracking_number || ''} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Est. Departure" type="date" value={form.estimated_departure || ''} onChange={(e) => setForm({ ...form, estimated_departure: e.target.value })} />
            <Input label="Est. Arrival" type="date" value={form.estimated_arrival || ''} onChange={(e) => setForm({ ...form, estimated_arrival: e.target.value })} />
          </div>
          <Input label="Weight (kg)" type="number" step="0.01" value={form.weight_kg ?? ''} onChange={(e) => setForm({ ...form, weight_kg: e.target.value ? parseFloat(e.target.value) : undefined })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createShipment.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
