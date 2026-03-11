import { useState } from 'react'
import { Button, Badge, Card, Table, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { usePickLists, useCreatePickList, useUpdatePickListStatus, useWarehouses, type PickList } from '../../api/inventory'

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  pending: 'default', in_progress: 'info', picked: 'warning', packed: 'warning', shipped: 'success',
}

export default function PickListsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')

  const { data: pickLists, isLoading } = usePickLists({ status: statusFilter || undefined, warehouse_id: warehouseFilter || undefined })
  const { data: warehouses } = useWarehouses()
  const updateStatus = useUpdatePickListStatus()

  const warehouseOptions = (warehouses ?? []).map(w => ({ value: w.id, label: w.name }))

  async function advanceStatus(pl: PickList) {
    const nextStatus: Record<string, string> = {
      pending: 'in_progress', in_progress: 'picked', picked: 'packed', packed: 'shipped',
    }
    const next = nextStatus[pl.status]
    if (!next) return
    try {
      await updateStatus.mutateAsync({ id: pl.id, status: next })
      toast('success', `Pick list ${pl.pick_number} moved to ${next}`)
    } catch {
      toast('error', 'Failed to update status')
    }
  }

  const columns = [
    { key: 'pick_number', label: 'Pick #', render: (row: PickList) => <span className="font-mono font-medium text-primary">{row.pick_number}</span> },
    { key: 'warehouse_id', label: 'Warehouse', render: (row: PickList) => warehouses?.find(w => w.id === row.warehouse_id)?.name ?? row.warehouse_id },
    { key: 'status', label: 'Status', render: (row: PickList) => <Badge variant={STATUS_COLORS[row.status] ?? 'default'}>{row.status.replace('_', ' ')}</Badge> },
    { key: 'pick_strategy', label: 'Strategy', render: (row: PickList) => <Badge variant="info">{row.pick_strategy.toUpperCase()}</Badge> },
    { key: 'lines', label: 'Lines', render: (row: PickList) => row.lines.length },
    {
      key: 'progress', label: 'Progress',
      render: (row: PickList) => {
        const total = row.lines.reduce((s, l) => s + l.quantity_requested, 0)
        const picked = row.lines.reduce((s, l) => s + l.quantity_picked, 0)
        const pct = total > 0 ? Math.round(picked / total * 100) : 0
        return <span className="text-sm">{picked}/{total} ({pct}%)</span>
      },
    },
    { key: 'created_at', label: 'Created', render: (row: PickList) => new Date(row.created_at).toLocaleDateString() },
    {
      key: 'actions', label: '',
      render: (row: PickList) => row.status !== 'shipped' && (
        <Button size="sm" variant="outline" onClick={() => advanceStatus(row)}>
          {row.status === 'pending' ? 'Start' : row.status === 'in_progress' ? 'Mark Picked' : row.status === 'picked' ? 'Pack' : 'Ship'}
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pick Lists</h1>
          <p className="text-sm text-gray-500 mt-1">Manage pick, pack, and ship operations</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <Select
          label=""
          options={[{ value: '', label: 'All Statuses' }, { value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }, { value: 'picked', label: 'Picked' }, { value: 'packed', label: 'Packed' }, { value: 'shipped', label: 'Shipped' }]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
        <Select
          label=""
          options={[{ value: '', label: 'All Warehouses' }, ...warehouseOptions]}
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
        />
      </div>

      <Card padding={false}>
        <Table<PickList>
          columns={columns}
          data={pickLists ?? []}
          loading={isLoading}
          emptyText="No pick lists found."
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  )
}
