import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useStockAdjustments,
  useCreateStockAdjustment,
  useInventoryItems,
  useWarehouses,
  type StockAdjustment,
  type CreateStockAdjustmentPayload,
  type AdjustmentReason,
} from '../../api/inventory'

const reasonOptions: { value: AdjustmentReason; label: string }[] = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
  { value: 'correction', label: 'Correction' },
  { value: 'return', label: 'Return' },
  { value: 'other', label: 'Other' },
]

const reasonVariant: Record<AdjustmentReason, 'default' | 'danger' | 'warning' | 'success' | 'info'> = {
  damaged: 'danger',
  expired: 'warning',
  lost: 'danger',
  found: 'success',
  correction: 'info',
  return: 'default',
  other: 'default',
}

const defaultForm: CreateStockAdjustmentPayload = {
  item_id: '',
  warehouse_id: '',
  adjustment_type: 'decrease',
  quantity: 1,
  reason: 'correction',
  notes: '',
}

export default function StockAdjustmentPage() {
  const [reasonFilter, setReasonFilter] = useState<AdjustmentReason | ''>('')
  const { data: adjustments, isLoading } = useStockAdjustments({ reason: reasonFilter || undefined })
  const { data: itemsData } = useInventoryItems({ limit: 500 })
  const { data: warehouses } = useWarehouses()
  const createAdjustment = useCreateStockAdjustment()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateStockAdjustmentPayload>(defaultForm)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createAdjustment.mutate(form, {
      onSuccess: () => {
        toast('success', 'Stock adjustment recorded')
        setShowModal(false)
        setForm(defaultForm)
      },
      onError: () => toast('error', 'Failed to create adjustment'),
    })
  }

  const columns = [
    {
      key: 'item_name',
      label: 'Item',
      render: (a: StockAdjustment) => <span className="font-medium text-gray-900">{a.item_name ?? 'Unknown'}</span>,
    },
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      render: (a: StockAdjustment) => a.warehouse_name ?? '-',
    },
    {
      key: 'adjustment_type',
      label: 'Type',
      render: (a: StockAdjustment) => (
        <Badge variant={a.adjustment_type === 'increase' ? 'success' : 'danger'}>
          {a.adjustment_type === 'increase' ? '+' : '-'}{a.quantity}
        </Badge>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (a: StockAdjustment) => <Badge variant={reasonVariant[a.reason]}>{a.reason}</Badge>,
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (a: StockAdjustment) => a.notes ? <span className="text-sm text-gray-600 truncate max-w-xs block">{a.notes}</span> : '-',
    },
    {
      key: 'adjusted_by_name',
      label: 'By',
      render: (a: StockAdjustment) => a.adjusted_by_name ?? '-',
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (a: StockAdjustment) => new Date(a.created_at).toLocaleString(),
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
          <h1 className="text-2xl font-bold text-gray-900">Stock Adjustments</h1>
          <p className="text-sm text-gray-500 mt-1">Record and track inventory adjustments</p>
        </div>
        <Button onClick={() => setShowModal(true)}>New Adjustment</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Reasons' },
            ...reasonOptions,
          ]}
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value as AdjustmentReason | '')}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={adjustments ?? []}
          keyExtractor={(a) => a.id}
          emptyText="No stock adjustments recorded."
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Stock Adjustment" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Item"
            required
            options={[
              { value: '', label: 'Select item...' },
              ...(itemsData?.items?.map((i) => ({ value: i.id, label: `${i.sku} - ${i.name}` })) ?? []),
            ]}
            value={form.item_id}
            onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}
          />
          <Select
            label="Warehouse"
            required
            options={[
              { value: '', label: 'Select warehouse...' },
              ...(warehouses?.map((w) => ({ value: w.id, label: w.name })) ?? []),
            ]}
            value={form.warehouse_id}
            onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Adjustment Type"
              options={[
                { value: 'increase', label: 'Increase (+)' },
                { value: 'decrease', label: 'Decrease (-)' },
              ]}
              value={form.adjustment_type}
              onChange={(e) => setForm((p) => ({ ...p, adjustment_type: e.target.value as 'increase' | 'decrease' }))}
            />
            <Input
              label="Quantity"
              type="number"
              min="1"
              required
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
            />
          </div>
          <Select
            label="Reason"
            options={reasonOptions}
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value as AdjustmentReason }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createAdjustment.isPending}>Record Adjustment</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
