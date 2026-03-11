import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useInventoryCounts,
  useCreateInventoryCount,
  useUpdateInventoryCount,
  useWarehouses,
  type InventoryCount,
  type InventoryCountItem,
  type CountStatus,
  type CreateInventoryCountPayload,
} from '../../api/inventory'

const statusVariant: Record<CountStatus, 'default' | 'info' | 'success' | 'warning'> = {
  draft: 'default',
  in_progress: 'info',
  completed: 'warning',
  reconciled: 'success',
}

export default function PhysicalCountPage() {
  const [statusFilter, setStatusFilter] = useState<CountStatus | ''>('')
  const { data: counts, isLoading } = useInventoryCounts({ status: statusFilter || undefined })
  const { data: warehouses } = useWarehouses()
  const createCount = useCreateInventoryCount()
  const updateCount = useUpdateInventoryCount()

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateInventoryCountPayload>({
    warehouse_id: '',
    count_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const [countingId, setCountingId] = useState<string | null>(null)
  const activeCount = counts?.find((c) => c.id === countingId)
  const [countEntries, setCountEntries] = useState<Record<string, number>>({})

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    createCount.mutate(createForm, {
      onSuccess: () => {
        toast('success', 'Physical count started')
        setShowCreate(false)
        setCreateForm({ warehouse_id: '', count_date: new Date().toISOString().slice(0, 10), notes: '' })
      },
      onError: () => toast('error', 'Failed to create count'),
    })
  }

  function openCounting(count: InventoryCount) {
    setCountingId(count.id)
    const entries: Record<string, number> = {}
    count.items?.forEach((item) => {
      entries[item.item_id] = item.counted_quantity ?? 0
    })
    setCountEntries(entries)
  }

  function handleSaveCounts() {
    if (!countingId) return
    const items = Object.entries(countEntries).map(([item_id, counted_quantity]) => ({
      item_id,
      counted_quantity,
    }))
    updateCount.mutate(
      { id: countingId, items, status: 'completed' },
      {
        onSuccess: () => {
          toast('success', 'Counts saved')
          setCountingId(null)
          setCountEntries({})
        },
        onError: () => toast('error', 'Failed to save counts'),
      }
    )
  }

  function handleReconcile(id: string) {
    if (!window.confirm('Reconcile this count? Stock levels will be updated.')) return
    updateCount.mutate(
      { id, status: 'reconciled' },
      {
        onSuccess: () => toast('success', 'Count reconciled'),
        onError: () => toast('error', 'Failed to reconcile'),
      }
    )
  }

  const columns = [
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      render: (c: InventoryCount) => <span className="font-medium text-gray-900">{c.warehouse_name ?? 'Unknown'}</span>,
    },
    {
      key: 'count_date',
      label: 'Count Date',
      render: (c: InventoryCount) => new Date(c.count_date).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (c: InventoryCount) => <Badge variant={statusVariant[c.status]}>{c.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'items',
      label: 'Items',
      render: (c: InventoryCount) => <Badge variant="primary">{c.items?.length ?? 0}</Badge>,
    },
    {
      key: 'counted_by_name',
      label: 'Counted By',
      render: (c: InventoryCount) => c.counted_by_name ?? '-',
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (c: InventoryCount) => (
        <div className="flex items-center justify-end gap-2">
          {(c.status === 'draft' || c.status === 'in_progress') && (
            <Button variant="ghost" size="sm" onClick={() => openCounting(c)}>Enter Counts</Button>
          )}
          {c.status === 'completed' && (
            <Button variant="ghost" size="sm" onClick={() => handleReconcile(c.id)}>Reconcile</Button>
          )}
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
          <h1 className="text-2xl font-bold text-gray-900">Physical Counts</h1>
          <p className="text-sm text-gray-500 mt-1">Conduct inventory counts and reconcile stock</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Start New Count</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'reconciled', label: 'Reconciled' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CountStatus | '')}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={counts ?? []}
          keyExtractor={(c) => c.id}
          emptyText="No physical counts found."
        />
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Start Physical Count">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Warehouse"
            required
            options={[
              { value: '', label: 'Select warehouse...' },
              ...(warehouses?.map((w) => ({ value: w.id, label: w.name })) ?? []),
            ]}
            value={createForm.warehouse_id}
            onChange={(e) => setCreateForm((p) => ({ ...p, warehouse_id: e.target.value }))}
          />
          <Input
            label="Count Date"
            type="date"
            required
            value={createForm.count_date}
            onChange={(e) => setCreateForm((p) => ({ ...p, count_date: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={2}
              value={createForm.notes ?? ''}
              onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createCount.isPending}>Start Count</Button>
          </div>
        </form>
      </Modal>

      {/* Counting Modal */}
      <Modal open={!!countingId} onClose={() => setCountingId(null)} title="Enter Counts" size="xl">
        {activeCount && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Warehouse: <span className="font-medium">{activeCount.warehouse_name}</span> |
              Date: <span className="font-medium">{new Date(activeCount.count_date).toLocaleDateString()}</span>
            </p>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Expected</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Counted</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCount.items?.map((item: InventoryCountItem) => {
                    const counted = countEntries[item.item_id] ?? 0
                    const variance = counted - item.expected_quantity
                    return (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-2 px-3">
                          <p className="font-medium">{item.item_name ?? 'Unknown'}</p>
                          {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                        </td>
                        <td className="py-2 px-3 text-right">{item.expected_quantity}</td>
                        <td className="py-2 px-3 text-right">
                          <Input
                            type="number"
                            min="0"
                            value={counted}
                            onChange={(e) => setCountEntries((p) => ({ ...p, [item.item_id]: Number(e.target.value) }))}
                            className="w-24 text-right"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={variance === 0 ? 'text-gray-500' : variance > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {variance > 0 ? '+' : ''}{variance}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setCountingId(null)}>Cancel</Button>
              <Button onClick={handleSaveCounts} loading={updateCount.isPending}>Save & Complete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
