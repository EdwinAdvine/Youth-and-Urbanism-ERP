import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useSerialNumbers, useCreateSerial,
  useInventoryItems, useWarehouses,
  type SerialNumber,
} from '../../api/inventory'
import apiClient from '../../api/client'

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  available: 'success', reserved: 'warning', sold: 'info', returned: 'default', scrapped: 'danger',
}

export default function SerialTrackingPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [traceModal, setTraceModal] = useState<{ open: boolean; data: Record<string, unknown> | null }>({ open: false, data: null })
  const [form, setForm] = useState({ item_id: '', serial_no: '', warehouse_id: '', status: 'available' })

  const { data: serials, isLoading } = useSerialNumbers({ status: statusFilter || undefined })
  const { data: items } = useInventoryItems()
  const { data: warehouses } = useWarehouses()
  const createSerial = useCreateSerial()

  const itemOptions = (items?.items ?? []).map(i => ({ value: i.id, label: `${i.name} (${i.sku})` }))
  const warehouseOptions = (warehouses ?? []).map(w => ({ value: w.id, label: w.name }))

  async function handleTrace(sn: SerialNumber) {
    try {
      const { data } = await apiClient.get(`/inventory/serials/${sn.id}/trace`)
      setTraceModal({ open: true, data })
    } catch {
      toast('error', 'Failed to load trace data')
    }
  }

  async function handleCreate() {
    if (!form.item_id || !form.serial_no) {
      toast('warning', 'Item and serial number are required')
      return
    }
    try {
      await createSerial.mutateAsync(form)
      toast('success', 'Serial number created')
      setModalOpen(false)
      setForm({ item_id: '', serial_no: '', warehouse_id: '', status: 'available' })
    } catch {
      toast('error', 'Failed to create serial number')
    }
  }

  const columns = [
    { key: 'serial_no', label: 'Serial No', render: (row: SerialNumber) => <span className="font-mono font-medium">{row.serial_no}</span> },
    { key: 'item_name', label: 'Item', render: (row: SerialNumber) => row.item_name ?? '—' },
    {
      key: 'status', label: 'Status',
      render: (row: SerialNumber) => <Badge variant={STATUS_COLORS[row.status] ?? 'default'}>{row.status}</Badge>,
    },
    { key: 'warehouse_id', label: 'Warehouse', render: (row: SerialNumber) => row.warehouse_id ? (warehouses?.find(w => w.id === row.warehouse_id)?.name ?? row.warehouse_id) : '—' },
    { key: 'created_at', label: 'Created', render: (row: SerialNumber) => new Date(row.created_at).toLocaleDateString() },
    {
      key: 'actions', label: '',
      render: (row: SerialNumber) => (
        <Button size="sm" variant="ghost" onClick={() => handleTrace(row)}>Trace</Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Serial Numbers</h1>
          <p className="text-sm text-gray-500 mt-1">Track individual units by serial number</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New Serial</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <Select
          label=""
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'available', label: 'Available' },
            { value: 'reserved', label: 'Reserved' },
            { value: 'sold', label: 'Sold' },
            { value: 'returned', label: 'Returned' },
            { value: 'scrapped', label: 'Scrapped' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
      </div>

      <Card padding={false}>
        <Table<SerialNumber>
          columns={columns}
          data={serials ?? []}
          loading={isLoading}
          emptyText="No serial numbers found."
          keyExtractor={(row) => row.id}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Serial Number" size="sm">
        <div className="space-y-4">
          <Select label="Item *" options={itemOptions} value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} />
          <Input label="Serial Number *" value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} placeholder="SN-001234" />
          <Select label="Warehouse" options={[{ value: '', label: 'None' }, ...warehouseOptions]} value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} />
          <Select
            label="Status"
            options={[
              { value: 'available', label: 'Available' },
              { value: 'reserved', label: 'Reserved' },
            ]}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createSerial.isPending}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={traceModal.open} onClose={() => setTraceModal({ open: false, data: null })} title="Serial Traceability" size="sm">
        {traceModal.data && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(traceModal.data).map(([key, value]) => value && typeof value === 'object' ? (
                <div key={key} className="col-span-2">
                  <p className="font-medium text-gray-700 dark:text-gray-300 capitalize">{key.replace(/_/g, ' ')}</p>
                  {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                    <p key={k} className="text-gray-600 dark:text-gray-400 ml-2">{k}: <span className="font-medium">{String(v)}</span></p>
                  ))}
                </div>
              ) : (
                <div key={key}>
                  <p className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{String(value ?? '—')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
