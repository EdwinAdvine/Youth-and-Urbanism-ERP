import { useState } from 'react'
import { cn, Button, Badge, Card, Table, Input, Select, Modal, Pagination } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useStockMovements,
  useCreateStockMovement,
  useInventoryItems,
  useWarehouses,
  type StockMovement,
  type CreateStockMovementPayload,
} from '../../api/inventory'

const MOVEMENT_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning'> = {
  receipt: 'success',
  issue: 'danger',
  transfer: 'info',
  adjustment: 'warning',
}

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'issue', label: 'Issue' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'adjustment', label: 'Adjustment' },
]

const TYPE_OPTIONS = [
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'issue', label: 'Issue' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'transfer', label: 'Transfer' },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface MovementFormState {
  item_id: string
  warehouse_id: string
  movement_type: string
  quantity: string
  notes: string
}

const defaultForm: MovementFormState = {
  item_id: '',
  warehouse_id: '',
  movement_type: 'adjustment',
  quantity: '1',
  notes: '',
}

export default function StockMovementsPage() {
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<MovementFormState>(defaultForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useStockMovements({
    movement_type: typeFilter || undefined,
    search: search || undefined,
    skip,
    limit,
  })
  const { data: items } = useInventoryItems({ limit: 500 })
  const { data: warehouses } = useWarehouses()
  const createMovement = useCreateStockMovement()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const itemOptions = [
    { value: '', label: 'Select item...' },
    ...(items?.items ?? []).map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` })),
  ]

  const warehouseOptions = [
    { value: '', label: 'Select warehouse...' },
    ...(warehouses ?? []).filter((w) => w.is_active).map((w) => ({ value: w.id, label: w.name })),
  ]

  function openModal() {
    setForm(defaultForm)
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (!form.item_id) {
      toast('warning', 'Please select an item')
      return
    }
    if (!form.warehouse_id) {
      toast('warning', 'Please select a warehouse')
      return
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast('warning', 'Quantity must be greater than 0')
      return
    }

    const payload: CreateStockMovementPayload = {
      item_id: form.item_id,
      warehouse_id: form.warehouse_id,
      movement_type: form.movement_type,
      quantity: Number(form.quantity),
      notes: form.notes.trim() || undefined,
    }

    try {
      await createMovement.mutateAsync(payload)
      toast('success', 'Stock movement recorded')
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to record stock movement')
    }
  }

  const columns = [
    {
      key: 'movement_type',
      label: 'Type',
      render: (row: StockMovement) => (
        <Badge variant={MOVEMENT_BADGE[row.movement_type] ?? 'default'} className="capitalize">
          {row.movement_type}
        </Badge>
      ),
    },
    {
      key: 'item_name',
      label: 'Item',
      render: (row: StockMovement) => <span className="font-medium text-gray-900 dark:text-gray-100">{row.item_name ?? row.item_id}</span>,
    },
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      render: (row: StockMovement) => row.warehouse_name ?? row.warehouse_id,
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (row: StockMovement) => (
        <span className={cn('font-semibold', row.movement_type === 'issue' ? 'text-red-600' : 'text-green-700')}>
          {row.movement_type === 'issue' ? '-' : '+'}{row.quantity}
        </span>
      ),
    },
    {
      key: 'reference_type',
      label: 'Reference',
      render: (row: StockMovement) =>
        row.reference_type
          ? <span className="text-xs text-gray-500">{row.reference_type}{row.reference_id ? ` #${row.reference_id}` : ''}</span>
          : <span className="text-gray-400">—</span>,
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (row: StockMovement) => row.notes
        ? <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px] block">{row.notes}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (row: StockMovement) => formatDate(row.created_at),
    },
  ]

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Movements</h1>
          <p className="text-sm text-gray-500 mt-1">Track all inventory inflows and outflows</p>
        </div>
        <Button onClick={openModal} className="w-full sm:w-auto">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Manual Adjustment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="w-full sm:w-44">
          <Select
            options={TYPE_FILTER_OPTIONS}
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          />
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search by item name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <span className="text-sm text-gray-500">{data?.total ?? 0} movements</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<StockMovement>
          columns={columns}
          data={data?.items ?? []}
          loading={isLoading}
          emptyText="No stock movements found"
          keyExtractor={(row) => row.id}
        />
        <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
      </Card>

      {/* Manual Adjustment Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Stock Movement"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Item *"
            options={itemOptions}
            value={form.item_id}
            onChange={(e) => setForm({ ...form, item_id: e.target.value })}
          />
          <Select
            label="Warehouse *"
            options={warehouseOptions}
            value={form.warehouse_id}
            onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Movement Type *"
              options={TYPE_OPTIONS}
              value={form.movement_type}
              onChange={(e) => setForm({ ...form, movement_type: e.target.value })}
            />
            <Input
              label="Quantity *"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional notes or reason for adjustment"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} loading={createMovement.isPending}>
              Record Movement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
