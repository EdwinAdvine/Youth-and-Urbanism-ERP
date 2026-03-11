import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useItemBatches,
  useCreateItemBatch,
  useInventoryItems,
  useWarehouses,
  type BatchNumber,
  type CreateItemBatchPayload,
} from '../../api/inventory'

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  expired: 'danger',
  recalled: 'warning',
  consumed: 'default',
}

const defaultForm: CreateItemBatchPayload = {
  item_id: '',
  batch_no: '',
  quantity: 1,
  manufacture_date: '',
  expiry_date: '',
  warehouse_id: '',
}

export default function BatchTrackingPage() {
  const [itemFilter, setItemFilter] = useState('')
  const { data: batches, isLoading } = useItemBatches({ item_id: itemFilter || undefined })
  const { data: itemsData } = useInventoryItems({ limit: 500 })
  const { data: warehouses } = useWarehouses()
  const createBatch = useCreateItemBatch()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateItemBatchPayload>(defaultForm)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createBatch.mutate(form, {
      onSuccess: () => {
        toast('success', 'Batch created')
        setShowModal(false)
        setForm(defaultForm)
      },
      onError: () => toast('error', 'Failed to create batch'),
    })
  }

  function isExpiringSoon(date: string | null): boolean {
    if (!date) return false
    const d = new Date(date)
    const now = new Date()
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 30
  }

  const columns = [
    {
      key: 'batch_no',
      label: 'Batch #',
      render: (b: BatchNumber) => <p className="font-medium text-gray-900">{b.batch_no}</p>,
    },
    {
      key: 'item_name',
      label: 'Item',
      render: (b: BatchNumber) => b.item_name ?? '-',
    },
    {
      key: 'quantity',
      label: 'Qty',
      render: (b: BatchNumber) => <Badge variant="primary">{b.quantity}</Badge>,
    },
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      render: (b: BatchNumber) => b.warehouse_name ?? '-',
    },
    {
      key: 'manufacture_date',
      label: 'Mfg Date',
      render: (b: BatchNumber) => b.manufacture_date ? new Date(b.manufacture_date).toLocaleDateString() : '-',
    },
    {
      key: 'expiry_date',
      label: 'Expiry',
      render: (b: BatchNumber) => {
        if (!b.expiry_date) return <span className="text-gray-400">N/A</span>
        const expired = new Date(b.expiry_date) < new Date()
        const expiring = isExpiringSoon(b.expiry_date)
        if (expired) return <Badge variant="danger">Expired</Badge>
        if (expiring) return <Badge variant="warning">{new Date(b.expiry_date).toLocaleDateString()}</Badge>
        return new Date(b.expiry_date).toLocaleDateString()
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (b: BatchNumber) => <Badge variant={statusVariant[b.status] ?? 'default'}>{b.status}</Badge>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (b: BatchNumber) => new Date(b.created_at).toLocaleDateString(),
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
          <h1 className="text-2xl font-bold text-gray-900">Batch Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">Track batches and serial numbers</p>
        </div>
        <Button onClick={() => setShowModal(true)}>Add Batch</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Items' },
            ...(itemsData?.items?.map((i) => ({ value: i.id, label: `${i.sku} - ${i.name}` })) ?? []),
          ]}
          value={itemFilter}
          onChange={(e) => setItemFilter(e.target.value)}
          className="w-64"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={batches ?? []}
          keyExtractor={(b) => b.id}
          emptyText="No batches found."
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Batch" size="lg">
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
          <div className="grid grid-cols-2 gap-4">
            <Input label="Batch Number" required value={form.batch_no} onChange={(e) => setForm((p) => ({ ...p, batch_no: e.target.value }))} />
            <Input label="Quantity" type="number" min="1" required value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <Input label="Manufacturing Date" type="date" required value={form.manufacture_date} onChange={(e) => setForm((p) => ({ ...p, manufacture_date: e.target.value }))} />
          </div>
          <Input label="Expiry Date" type="date" value={form.expiry_date ?? ''} onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createBatch.isPending}>Create Batch</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
