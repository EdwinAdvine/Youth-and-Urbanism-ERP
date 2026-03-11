import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Input, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useWorkOrders,
  useCreateWorkOrder,
  useStartWorkOrder,
  useCompleteWorkOrder,
  useCancelWorkOrder,
  useBOMs,
  type WorkOrder,
  type CreateWorkOrderPayload,
} from '../../api/manufacturing'
import { useWarehouses } from '../../api/inventory'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'default' | 'success' | 'danger' | 'info' | 'warning'> = {
  draft: 'default',
  planned: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

const PRIORITY_BADGE: Record<string, 'default' | 'success' | 'danger' | 'warning'> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
}

const STATUS_FILTERS = ['all', 'draft', 'planned', 'in_progress', 'completed', 'cancelled']

interface WOFormState {
  bom_id: string
  planned_quantity: string
  priority: string
  target_warehouse_id: string
  source_warehouse_id: string
  notes: string
  planned_start: string
  planned_end: string
}

const defaultForm: WOFormState = {
  bom_id: '',
  planned_quantity: '1',
  priority: 'medium',
  target_warehouse_id: '',
  source_warehouse_id: '',
  notes: '',
  planned_start: '',
  planned_end: '',
}

export default function WorkOrdersPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [completeModal, setCompleteModal] = useState<WorkOrder | null>(null)
  const [completedQty, setCompletedQty] = useState('')
  const [rejectedQty, setRejectedQty] = useState('0')
  const [form, setForm] = useState<WOFormState>(defaultForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useWorkOrders({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
    skip,
    limit,
  })
  const { data: boms } = useBOMs({ is_active: true, limit: 100 })
  const { data: warehouses } = useWarehouses()

  const createWO = useCreateWorkOrder()
  const startWO = useStartWorkOrder()
  const completeWO = useCompleteWorkOrder()
  const cancelWO = useCancelWorkOrder()

  const handleCreate = async () => {
    if (!form.bom_id || !form.target_warehouse_id || !form.source_warehouse_id) {
      toast('error', 'BOM, source warehouse, and target warehouse are required')
      return
    }
    try {
      const payload: CreateWorkOrderPayload = {
        bom_id: form.bom_id,
        planned_quantity: parseInt(form.planned_quantity) || 1,
        priority: form.priority,
        target_warehouse_id: form.target_warehouse_id,
        source_warehouse_id: form.source_warehouse_id,
        notes: form.notes || undefined,
        planned_start: form.planned_start || undefined,
        planned_end: form.planned_end || undefined,
      }
      await createWO.mutateAsync(payload)
      toast('success', 'Work order created')
      setModalOpen(false)
      setForm(defaultForm)
    } catch (err: any) {
      toast('error', err?.response?.data?.detail || 'Failed to create work order')
    }
  }

  const handleStart = async (id: string) => {
    try {
      await startWO.mutateAsync(id)
      toast('success', 'Work order started - materials consumed from inventory')
    } catch (err: any) {
      toast('error', err?.response?.data?.detail || 'Failed to start work order')
    }
  }

  const handleComplete = async () => {
    if (!completeModal) return
    try {
      await completeWO.mutateAsync({
        id: completeModal.id,
        completed_quantity: parseInt(completedQty) || 0,
        rejected_quantity: parseInt(rejectedQty) || 0,
      })
      toast('success', 'Work order completed - finished goods added to inventory')
      setCompleteModal(null)
    } catch (err: any) {
      toast('error', err?.response?.data?.detail || 'Failed to complete work order')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await cancelWO.mutateAsync(id)
      toast('success', 'Work order cancelled')
    } catch (err: any) {
      toast('error', err?.response?.data?.detail || 'Failed to cancel work order')
    }
  }

  const columns = [
    {
      key: 'wo_number',
      label: 'WO #',
      render: (row: WorkOrder) => (
        <button className="font-medium text-primary hover:underline" onClick={() => navigate(`/manufacturing/work-orders/${row.id}`)}>
          {row.wo_number}
        </button>
      ),
    },
    {
      key: 'finished_item_name',
      label: 'Product',
      render: (row: WorkOrder) => <span className="text-gray-700">{row.finished_item_name ?? '-'}</span>,
    },
    {
      key: 'bom_name',
      label: 'BOM',
      render: (row: WorkOrder) => <span className="text-gray-500 text-sm">{row.bom_name ?? '-'}</span>,
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (row: WorkOrder) => (
        <span>
          <span className="font-medium">{row.completed_quantity}</span>
          <span className="text-gray-400">/{row.planned_quantity}</span>
          {row.rejected_quantity > 0 && (
            <span className="text-red-500 ml-1">(-{row.rejected_quantity})</span>
          )}
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row: WorkOrder) => <Badge variant={PRIORITY_BADGE[row.priority] ?? 'default'}>{row.priority}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: WorkOrder) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'total_material_cost',
      label: 'Material Cost',
      render: (row: WorkOrder) => formatCurrency(row.total_material_cost),
    },
    {
      key: 'planned_start',
      label: 'Start',
      render: (row: WorkOrder) => formatDate(row.planned_start),
    },
    {
      key: 'actions',
      label: '',
      render: (row: WorkOrder) => (
        <div className="flex gap-1">
          {(row.status === 'draft' || row.status === 'planned') && (
            <Button size="sm" variant="outline" onClick={() => handleStart(row.id)}>
              Start
            </Button>
          )}
          {row.status === 'in_progress' && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-300"
              onClick={() => {
                setCompleteModal(row)
                setCompletedQty(String(row.planned_quantity))
                setRejectedQty('0')
              }}
            >
              Complete
            </Button>
          )}
          {row.status !== 'completed' && row.status !== 'cancelled' && (
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleCancel(row.id)}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage production work orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/manufacturing')} className="min-h-[44px] sm:min-h-0">
            Dashboard
          </Button>
          <Button onClick={() => setModalOpen(true)} className="min-h-[44px] sm:min-h-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Work Order
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((sf) => (
            <Button
              key={sf}
              size="sm"
              variant={statusFilter === sf ? 'secondary' : 'outline'}
              onClick={() => { setStatusFilter(sf); setPage(1) }}
            >
              {sf === 'all' ? 'All' : sf.replace('_', ' ')}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Search WO number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <Table<WorkOrder>
            columns={columns}
            data={data?.work_orders ?? []}
            loading={isLoading}
            emptyText="No work orders found"
            keyExtractor={(row) => row.id}
          />
        </div>
        {(data?.total ?? 0) > limit && (
          <div className="flex justify-center p-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-gray-500 flex items-center px-2">
                Page {page} of {Math.ceil((data?.total ?? 0) / limit)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= Math.ceil((data?.total ?? 0) / limit)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Work Order Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Work Order">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bill of Materials</label>
            <select
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.bom_id}
              onChange={(e) => setForm({ ...form, bom_id: e.target.value })}
            >
              <option value="">Select BOM...</option>
              {boms?.boms?.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.bom_number})</option>
              ))}
            </select>
          </div>
          <Input
            label="Planned Quantity"
            type="number"
            value={form.planned_quantity}
            onChange={(e) => setForm({ ...form, planned_quantity: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Warehouse (raw materials)</label>
            <select
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.source_warehouse_id}
              onChange={(e) => setForm({ ...form, source_warehouse_id: e.target.value })}
            >
              <option value="">Select warehouse...</option>
              {warehouses?.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Warehouse (finished goods)</label>
            <select
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.target_warehouse_id}
              onChange={(e) => setForm({ ...form, target_warehouse_id: e.target.value })}
            >
              <option value="">Select warehouse...</option>
              {warehouses?.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Planned Start"
              type="date"
              value={form.planned_start}
              onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
            />
            <Input
              label="Planned End"
              type="date"
              value={form.planned_end}
              onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
            />
          </div>
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createWO.isPending}>
              {createWO.isPending ? 'Creating...' : 'Create Work Order'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete Work Order Modal */}
      <Modal
        open={!!completeModal}
        onClose={() => setCompleteModal(null)}
        title={`Complete ${completeModal?.wo_number ?? ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Planned quantity: <span className="font-semibold">{completeModal?.planned_quantity}</span>
          </p>
          <Input
            label="Completed Quantity"
            type="number"
            value={completedQty}
            onChange={(e) => setCompletedQty(e.target.value)}
          />
          <Input
            label="Rejected Quantity"
            type="number"
            value={rejectedQty}
            onChange={(e) => setRejectedQty(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCompleteModal(null)}>Cancel</Button>
            <Button onClick={handleComplete} disabled={completeWO.isPending}>
              {completeWO.isPending ? 'Completing...' : 'Complete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
