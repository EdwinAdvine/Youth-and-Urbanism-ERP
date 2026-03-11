import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useBlanketOrders, useCreateBlanketOrder, useUpdateBlanketOrder, useSuppliers, type BlanketOrder } from '../../api/inventory'

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  active: 'success', draft: 'default', exhausted: 'warning', expired: 'danger', cancelled: 'danger',
}

interface BlanketOrderFormState {
  supplier_id: string
  start_date: string
  end_date: string
  total_value_limit: string
  terms: string
  notes: string
}

const defaultForm: BlanketOrderFormState = { supplier_id: '', start_date: '', end_date: '', total_value_limit: '', terms: '', notes: '' }

export default function BlanketOrdersPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<BlanketOrderFormState>(defaultForm)

  const { data: orders, isLoading } = useBlanketOrders()
  const { data: suppliersData } = useSuppliers()
  const createOrder = useCreateBlanketOrder()

  const supplierOptions = (suppliersData ?? []).map(s => ({ value: s.id, label: s.name }))

  async function handleCreate() {
    if (!form.supplier_id || !form.start_date) {
      toast('warning', 'Supplier and start date are required')
      return
    }
    try {
      await createOrder.mutateAsync({
        supplier_id: form.supplier_id,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        total_value_limit: form.total_value_limit ? parseFloat(form.total_value_limit) : undefined,
        terms: form.terms || undefined,
        notes: form.notes || undefined,
      } as unknown)
      toast('success', 'Blanket order created')
      setModalOpen(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to create blanket order')
    }
  }

  const columns = [
    { key: 'bo_number', label: 'BO #', render: (row: BlanketOrder) => <span className="font-mono font-medium text-primary">{row.bo_number}</span> },
    { key: 'supplier_name', label: 'Supplier', render: (row: BlanketOrder) => row.supplier_name ?? '—' },
    { key: 'status', label: 'Status', render: (row: BlanketOrder) => <Badge variant={STATUS_COLORS[row.status] ?? 'default'}>{row.status}</Badge> },
    { key: 'start_date', label: 'Start', render: (row: BlanketOrder) => new Date(row.start_date).toLocaleDateString() },
    { key: 'end_date', label: 'End', render: (row: BlanketOrder) => row.end_date ? new Date(row.end_date).toLocaleDateString() : '—' },
    {
      key: 'utilization', label: 'Utilization',
      render: (row: BlanketOrder) => row.total_value_limit ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 w-20">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(row.utilization_pct ?? 0, 100)}%` }} />
          </div>
          <span className="text-xs text-gray-600">{row.utilization_pct ?? 0}%</span>
        </div>
      ) : <span className="text-gray-400">Unlimited</span>,
    },
    {
      key: 'released_value', label: 'Released',
      render: (row: BlanketOrder) => <span>${row.released_value.toLocaleString()}{row.total_value_limit ? ` / $${row.total_value_limit.toLocaleString()}` : ''}</span>,
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Blanket Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Long-term supplier framework agreements</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New Blanket Order</Button>
      </div>

      <Card padding={false}>
        <Table<BlanketOrder>
          columns={columns}
          data={orders ?? []}
          loading={isLoading}
          emptyText="No blanket orders found."
          keyExtractor={(row) => row.id}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Blanket Order" size="sm">
        <div className="space-y-4">
          <Select label="Supplier *" options={[{ value: '', label: 'Select supplier...' }, ...supplierOptions]} value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} />
          <Input label="Start Date *" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input label="End Date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <Input label="Total Value Limit (optional)" type="number" value={form.total_value_limit} onChange={(e) => setForm({ ...form, total_value_limit: e.target.value })} placeholder="Leave blank for unlimited" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Terms</label>
            <textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={2} className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Payment terms, delivery terms..." />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createOrder.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
