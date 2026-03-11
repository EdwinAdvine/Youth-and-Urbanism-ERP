import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Input, Modal, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { useLots, useCreateLot, type LotSerial, type LotSerialCreate } from '../../api/manufacturing_trace'

const statusColors: Record<string, string> = { active: 'green', consumed: 'blue', shipped: 'purple', recalled: 'red' }

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LotTrackingPage() {
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<LotSerialCreate>({ tracking_number: '', item_id: '', tracking_type: 'lot' })

  const { data: lots, isLoading } = useLots({
    ...(typeFilter && { tracking_type: typeFilter }),
    ...(statusFilter && { status: statusFilter }),
  })
  const createLot = useCreateLot()

  const handleCreate = async () => {
    if (!form.tracking_number || !form.item_id) return toast({ title: 'Tracking number and item are required', variant: 'destructive' })
    try {
      const lot = await createLot.mutateAsync(form)
      toast({ title: `${form.tracking_type === 'lot' ? 'Lot' : 'Serial'} ${lot.tracking_number} created` })
      setModalOpen(false)
      setForm({ tracking_number: '', item_id: '', tracking_type: 'lot' })
    } catch {
      toast({ title: 'Failed to create', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lot / Serial Tracking</h1>
        <Button onClick={() => setModalOpen(true)}>+ New Lot/Serial</Button>
      </div>

      <div className="flex gap-3">
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="lot">Lot</option>
          <option value="serial">Serial</option>
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['active', 'consumed', 'shipped', 'recalled'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Tracking #</th>
              <th>Type</th>
              <th>Status</th>
              <th>Quantity</th>
              <th>Manufactured</th>
              <th>Expiry</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>
            ) : lots?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">No lots/serials found</td></tr>
            ) : lots?.map((lot: LotSerial) => (
              <tr key={lot.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/manufacturing/lots/${lot.id}`)}>
                <td className="font-mono text-sm font-medium">{lot.tracking_number}</td>
                <td className="capitalize">{lot.tracking_type}</td>
                <td><Badge variant={statusColors[lot.status] || 'gray'}>{lot.status}</Badge></td>
                <td>{lot.quantity}</td>
                <td>{formatDate(lot.manufactured_date)}</td>
                <td>{formatDate(lot.expiry_date)}</td>
                <td>{formatDate(lot.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Lot / Serial Number">
        <div className="space-y-4">
          <Input label="Tracking Number" value={form.tracking_number} onChange={e => setForm({ ...form, tracking_number: e.target.value })} placeholder="LOT-2026-001 or SN-12345" />
          <Select label="Type" value={form.tracking_type || 'lot'} onChange={e => setForm({ ...form, tracking_type: e.target.value })}>
            <option value="lot">Lot</option>
            <option value="serial">Serial</option>
          </Select>
          <Input label="Item ID" value={form.item_id} onChange={e => setForm({ ...form, item_id: e.target.value })} placeholder="Inventory Item UUID" />
          <Input label="Quantity" type="number" value={String(form.quantity || 1)} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} />
          <Input label="Work Order ID" value={form.work_order_id || ''} onChange={e => setForm({ ...form, work_order_id: e.target.value || undefined })} placeholder="Optional" />
          <Input label="Manufactured Date" type="date" value={form.manufactured_date || ''} onChange={e => setForm({ ...form, manufactured_date: e.target.value || undefined })} />
          <Input label="Expiry Date" type="date" value={form.expiry_date || ''} onChange={e => setForm({ ...form, expiry_date: e.target.value || undefined })} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createLot.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
