import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useScrapEntries,
  useCreateScrapEntry,
  type ScrapEntry,
  type CreateScrapEntryPayload,
} from '../../api/manufacturing_ext'

const scrapTypeColors: Record<string, 'default' | 'warning' | 'danger'> = {
  material: 'default',
  finished_product: 'danger',
  wip: 'warning',
}

const emptyForm: CreateScrapEntryPayload = {
  work_order_id: '',
  item_id: '',
  quantity: 0,
  unit_of_measure: 'pcs',
  reason: '',
  scrap_type: 'material',
  cost_impact: 0,
  notes: '',
}

export default function ScrapPage() {
  const [page, setPage] = useState(1)
  const limit = 20
  const { data, isLoading, error } = useScrapEntries({ skip: (page - 1) * limit, limit })
  const createScrap = useCreateScrapEntry()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateScrapEntryPayload>(emptyForm)

  const resetForm = () => { setForm(emptyForm); setShowModal(false) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createScrap.mutateAsync(form)
      toast('success', 'Scrap entry recorded')
      resetForm()
    } catch {
      toast('error', 'Failed to record scrap')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load scrap entries</div>

  const entries = data?.entries ?? []
  const totalCost = entries.reduce((s, e) => s + e.cost_impact, 0)

  const columns = [
    { key: 'wo_number', label: 'Work Order', render: (r: ScrapEntry) => <span className="font-mono text-sm text-gray-600">{r.wo_number || r.work_order_id.slice(0, 8)}</span> },
    { key: 'item', label: 'Item', render: (r: ScrapEntry) => <span className="font-medium text-gray-900">{r.item_name || r.item_id.slice(0, 8)}</span> },
    { key: 'quantity', label: 'Qty', render: (r: ScrapEntry) => <span className="text-sm">{r.quantity} {r.unit_of_measure}</span> },
    { key: 'scrap_type', label: 'Type', render: (r: ScrapEntry) => <Badge variant={scrapTypeColors[r.scrap_type]}>{r.scrap_type.replace(/_/g, ' ')}</Badge> },
    { key: 'reason', label: 'Reason', render: (r: ScrapEntry) => <span className="text-sm text-gray-600 max-w-xs truncate block">{r.reason}</span> },
    { key: 'cost_impact', label: 'Cost Impact', render: (r: ScrapEntry) => <span className="text-sm font-medium text-red-600">${r.cost_impact.toFixed(2)}</span> },
    { key: 'reported_by', label: 'Reported By', render: (r: ScrapEntry) => <span className="text-sm">{r.reported_by_name || r.reported_by}</span> },
    { key: 'date', label: 'Date', render: (r: ScrapEntry) => <span className="text-sm text-gray-500">{new Date(r.reported_at).toLocaleDateString()}</span> },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scrap Log</h1>
          <p className="text-sm text-gray-500 mt-1">Track material and product scrap entries</p>
        </div>
        <Button onClick={() => setShowModal(true)}>Record Scrap</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><p className="text-sm text-gray-500">Total Entries</p><p className="text-2xl font-bold text-gray-900">{data?.total ?? 0}</p></Card>
        <Card><p className="text-sm text-gray-500">Total Cost Impact</p><p className="text-2xl font-bold text-red-600">${totalCost.toFixed(2)}</p></Card>
        <Card><p className="text-sm text-gray-500">Total Qty Scrapped</p><p className="text-2xl font-bold text-orange-600">{entries.reduce((s, e) => s + e.quantity, 0)}</p></Card>
      </div>

      <Card padding={false}>
        <Table columns={columns} data={entries} loading={isLoading} keyExtractor={(r) => r.id} emptyText="No scrap entries" />
      </Card>

      <Modal open={showModal} onClose={resetForm} title="Record Scrap Entry" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Work Order ID" value={form.work_order_id} onChange={(e) => setForm({ ...form, work_order_id: e.target.value })} required />
            <Input label="Item ID" value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Quantity" type="number" min="0.01" step="0.01" value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} required />
            <Input label="Unit" value={form.unit_of_measure || 'pcs'} onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })} />
            <Select label="Scrap Type" value={form.scrap_type} onChange={(e) => setForm({ ...form, scrap_type: e.target.value as 'material' | 'finished_product' | 'wip' })}
              options={[{ value: 'material', label: 'Material' }, { value: 'finished_product', label: 'Finished Product' }, { value: 'wip', label: 'Work in Progress' }]} />
          </div>
          <Input label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          <Input label="Cost Impact" type="number" step="0.01" min="0" value={form.cost_impact || ''} onChange={(e) => setForm({ ...form, cost_impact: parseFloat(e.target.value) || 0 })} />
          <Input label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createScrap.isPending}>Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
