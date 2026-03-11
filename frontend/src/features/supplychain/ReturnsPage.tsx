import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Select, Pagination, toast,
} from '../../components/ui'
import {
  useReturns, useCreateReturn, useApproveReturn, useCompleteReturn, useDeleteReturn,
  type SupplierReturn, type CreateReturnPayload, type ReturnLineIn,
} from '../../api/supplychain'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  pending_approval: 'info',
  approved: 'success',
  shipped: 'info',
  completed: 'primary',
  cancelled: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

interface ReturnLineFormState {
  item_id: string
  quantity: string
  unit_cost: string
  reason: string
}

const defaultLine: ReturnLineFormState = {
  item_id: '',
  quantity: '1',
  unit_cost: '0',
  reason: '',
}

export default function ReturnsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'approve' | 'complete' } | null>(null)

  const [formSupplierId, setFormSupplierId] = useState('')
  const [formGRNId, setFormGRNId] = useState('')
  const [formWarehouseId, setFormWarehouseId] = useState('')
  const [formReason, setFormReason] = useState('')
  const [formLines, setFormLines] = useState<ReturnLineFormState[]>([{ ...defaultLine }])

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useReturns({
    status: statusFilter || undefined,
    skip,
    limit,
  })

  const createMutation = useCreateReturn()
  const approveMutation = useApproveReturn()
  const completeMutation = useCompleteReturn()
  const deleteMutation = useDeleteReturn()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const addLine = () => setFormLines([...formLines, { ...defaultLine }])
  const removeLine = (idx: number) => {
    if (formLines.length <= 1) return
    setFormLines(formLines.filter((_, i) => i !== idx))
  }
  const updateLine = (idx: number, field: keyof ReturnLineFormState, value: string) => {
    const updated = [...formLines]
    updated[idx] = { ...updated[idx], [field]: value }
    setFormLines(updated)
  }

  const resetForm = () => {
    setFormSupplierId('')
    setFormGRNId('')
    setFormWarehouseId('')
    setFormReason('')
    setFormLines([{ ...defaultLine }])
  }

  const handleCreate = async () => {
    if (!formSupplierId.trim() || !formWarehouseId.trim() || !formReason.trim()) {
      toast('warning', 'Supplier ID, Warehouse ID, and Reason are required')
      return
    }

    const validLines = formLines.filter((l) => l.item_id.trim())
    if (validLines.length === 0) {
      toast('warning', 'At least one line item with an item ID is required')
      return
    }

    const lines: ReturnLineIn[] = validLines.map((l) => ({
      item_id: l.item_id.trim(),
      quantity: Number(l.quantity) || 1,
      unit_cost: Number(l.unit_cost) || 0,
      reason: l.reason.trim() || undefined,
    }))

    const payload: CreateReturnPayload = {
      supplier_id: formSupplierId.trim(),
      grn_id: formGRNId.trim() || undefined,
      warehouse_id: formWarehouseId.trim(),
      reason: formReason.trim(),
      lines,
    }

    try {
      const result = await createMutation.mutateAsync(payload)
      toast('success', `Return ${result.return_number} created`)
      setShowCreate(false)
      resetForm()
    } catch {
      toast('error', 'Failed to create return')
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const result = await approveMutation.mutateAsync(id)
      toast('success', `Return ${result.return_number} approved`)
      setConfirmAction(null)
    } catch {
      toast('error', 'Failed to approve return')
    }
  }

  const handleComplete = async (id: string) => {
    try {
      const result = await completeMutation.mutateAsync(id)
      toast('success', `Return ${result.return_number} completed - stock adjusted`)
      setConfirmAction(null)
    } catch {
      toast('error', 'Failed to complete return')
    }
  }

  const columns = [
    {
      key: 'return_number',
      label: 'Return #',
      render: (row: SupplierReturn) => (
        <span className="text-[#51459d] font-medium">{row.return_number}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: SupplierReturn) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row: SupplierReturn) => (
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[200px] block text-sm">{row.reason}</span>
      ),
    },
    {
      key: 'total_value',
      label: 'Value',
      render: (row: SupplierReturn) => (
        <span className="text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(row.total_value)}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: SupplierReturn) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: SupplierReturn) => (
        <div className="flex items-center gap-1">
          {(row.status === 'draft' || row.status === 'pending_approval') && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[#6fd943]"
              onClick={() => setConfirmAction({ id: row.id, action: 'approve' })}
            >
              Approve
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-[#ff3a6e]"
            onClick={async () => {
              if (!window.confirm('Delete this return? This cannot be undone.')) return
              try {
                await deleteMutation.mutateAsync(row.id)
                toast('success', 'Return deleted')
              } catch {
                toast('error', 'Failed to delete return')
              }
            }}
          >
            Delete
          </Button>
          {(row.status === 'approved' || row.status === 'shipped') && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[#51459d]"
              onClick={() => setConfirmAction({ id: row.id, action: 'complete' })}
            >
              Complete
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Supplier Returns</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total returns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Return
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-48">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <Table<SupplierReturn>
          columns={columns}
          data={data?.returns ?? []}
          loading={isLoading}
          emptyText="No supplier returns found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="New Supplier Return" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Supplier ID *"
              value={formSupplierId}
              onChange={(e) => setFormSupplierId(e.target.value)}
              placeholder="Supplier UUID"
            />
            <Input
              label="Warehouse ID *"
              value={formWarehouseId}
              onChange={(e) => setFormWarehouseId(e.target.value)}
              placeholder="Warehouse UUID"
            />
          </div>
          <Input
            label="GRN ID (optional)"
            value={formGRNId}
            onChange={(e) => setFormGRNId(e.target.value)}
            placeholder="GRN UUID (if returning from a specific GRN)"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason *</label>
            <textarea
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder="Reason for return..."
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Return Lines *</label>
              <Button variant="ghost" size="sm" onClick={addLine}>
                + Add Line
              </Button>
            </div>
            <div className="space-y-3">
              {formLines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-950 rounded-[10px]">
                  <div className="flex-1">
                    <Input
                      placeholder="Item ID (UUID)"
                      value={line.item_id}
                      onChange={(e) => updateLine(idx, 'item_id', e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit Cost"
                      value={line.unit_cost}
                      onChange={(e) => updateLine(idx, 'unit_cost', e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Reason (optional)"
                      value={line.reason}
                      onChange={(e) => updateLine(idx, 'reason', e.target.value)}
                    />
                  </div>
                  {formLines.length > 1 && (
                    <button
                      onClick={() => removeLine(idx)}
                      className="mt-2 text-red-400 hover:text-red-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => { setShowCreate(false); resetForm() }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create Return
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Action Modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.action === 'approve' ? 'Approve Return' : 'Complete Return'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {confirmAction?.action === 'approve'
              ? 'Are you sure you want to approve this supplier return?'
              : 'Completing this return will deduct stock from inventory. Continue?'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction(null)}>Cancel</Button>
            {confirmAction?.action === 'approve' ? (
              <Button
                size="sm"
                loading={approveMutation.isPending}
                onClick={() => confirmAction && handleApprove(confirmAction.id)}
              >
                Approve
              </Button>
            ) : (
              <Button
                size="sm"
                loading={completeMutation.isPending}
                onClick={() => confirmAction && handleComplete(confirmAction.id)}
              >
                Complete Return
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
