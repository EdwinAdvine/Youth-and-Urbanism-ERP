import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Select, Pagination, toast,
} from '../../components/ui'
import {
  useGRNs, useCreateGRN, useAcceptGRN, useRejectGRN,
  type GoodsReceivedNote, type CreateGRNPayload, type GRNLineIn,
} from '../../api/supplychain'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  inspecting: 'warning',
  accepted: 'success',
  partial: 'warning',
  rejected: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'inspecting', label: 'Inspecting' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'partial', label: 'Partial' },
  { value: 'rejected', label: 'Rejected' },
]

interface GRNLineFormState {
  po_line_id: string
  item_id: string
  ordered_quantity: string
  received_quantity: string
  accepted_quantity: string
  rejected_quantity: string
  rejection_reason: string
}

const defaultLine: GRNLineFormState = {
  po_line_id: '',
  item_id: '',
  ordered_quantity: '0',
  received_quantity: '0',
  accepted_quantity: '0',
  rejected_quantity: '0',
  rejection_reason: '',
}

export default function GRNPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'accept' | 'reject' } | null>(null)

  const [formPOId, setFormPOId] = useState('')
  const [formSupplierId, setFormSupplierId] = useState('')
  const [formWarehouseId, setFormWarehouseId] = useState('')
  const [formReceivedDate, setFormReceivedDate] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formLines, setFormLines] = useState<GRNLineFormState[]>([{ ...defaultLine }])

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useGRNs({
    status: statusFilter || undefined,
    skip,
    limit,
  })

  const createMutation = useCreateGRN()
  const acceptMutation = useAcceptGRN()
  const rejectMutation = useRejectGRN()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const addLine = () => setFormLines([...formLines, { ...defaultLine }])
  const removeLine = (idx: number) => {
    if (formLines.length <= 1) return
    setFormLines(formLines.filter((_, i) => i !== idx))
  }
  const updateLine = (idx: number, field: keyof GRNLineFormState, value: string) => {
    const updated = [...formLines]
    updated[idx] = { ...updated[idx], [field]: value }
    setFormLines(updated)
  }

  const resetForm = () => {
    setFormPOId('')
    setFormSupplierId('')
    setFormWarehouseId('')
    setFormReceivedDate('')
    setFormNotes('')
    setFormLines([{ ...defaultLine }])
  }

  const handleCreate = async () => {
    if (!formPOId.trim() || !formSupplierId.trim() || !formWarehouseId.trim() || !formReceivedDate) {
      toast('warning', 'PO ID, Supplier ID, Warehouse ID, and Received Date are required')
      return
    }

    const validLines = formLines.filter((l) => l.po_line_id.trim() && l.item_id.trim())
    if (validLines.length === 0) {
      toast('warning', 'At least one line item is required')
      return
    }

    const lines: GRNLineIn[] = validLines.map((l) => ({
      po_line_id: l.po_line_id.trim(),
      item_id: l.item_id.trim(),
      ordered_quantity: Number(l.ordered_quantity) || 0,
      received_quantity: Number(l.received_quantity) || 0,
      accepted_quantity: Number(l.accepted_quantity) || 0,
      rejected_quantity: Number(l.rejected_quantity) || 0,
      rejection_reason: l.rejection_reason.trim() || undefined,
    }))

    const payload: CreateGRNPayload = {
      purchase_order_id: formPOId.trim(),
      supplier_id: formSupplierId.trim(),
      warehouse_id: formWarehouseId.trim(),
      received_date: formReceivedDate,
      notes: formNotes.trim() || undefined,
      lines,
    }

    try {
      const result = await createMutation.mutateAsync(payload)
      toast('success', `GRN ${result.grn_number} created`)
      setShowCreate(false)
      resetForm()
    } catch {
      toast('error', 'Failed to create GRN')
    }
  }

  const handleAccept = async (id: string) => {
    try {
      const result = await acceptMutation.mutateAsync(id)
      toast('success', `GRN ${result.grn_number} accepted - stock updated`)
      setConfirmAction(null)
    } catch {
      toast('error', 'Failed to accept GRN')
    }
  }

  const handleReject = async (id: string) => {
    try {
      const result = await rejectMutation.mutateAsync(id)
      toast('success', `GRN ${result.grn_number} rejected`)
      setConfirmAction(null)
    } catch {
      toast('error', 'Failed to reject GRN')
    }
  }

  const columns = [
    {
      key: 'grn_number',
      label: 'GRN #',
      render: (row: GoodsReceivedNote) => (
        <span className="text-[#51459d] font-medium">{row.grn_number}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: GoodsReceivedNote) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'received_date',
      label: 'Received Date',
      render: (row: GoodsReceivedNote) => (
        <span className="text-gray-600">{formatDate(row.received_date)}</span>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (row: GoodsReceivedNote) => (
        <span className="text-gray-500 truncate max-w-[180px] block text-xs">{row.notes || '-'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: GoodsReceivedNote) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: GoodsReceivedNote) => (
        <div className="flex items-center gap-1">
          {(row.status === 'draft' || row.status === 'inspecting') && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-[#6fd943]"
                onClick={() => setConfirmAction({ id: row.id, action: 'accept' })}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[#ff3a6e]"
                onClick={() => setConfirmAction({ id: row.id, action: 'reject' })}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Goods Received Notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} total GRNs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')} className="min-h-[44px] sm:min-h-0">
            Dashboard
          </Button>
          <Button onClick={() => setShowCreate(true)} className="min-h-[44px] sm:min-h-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New GRN
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-5 sm:mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-full sm:w-48">
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
        <div className="overflow-x-auto">
          <Table<GoodsReceivedNote>
            columns={columns}
            data={data?.grns ?? []}
            loading={isLoading}
            emptyText="No goods received notes found"
            keyExtractor={(row) => row.id}
          />
        </div>
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="New Goods Received Note" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Purchase Order ID *"
              value={formPOId}
              onChange={(e) => setFormPOId(e.target.value)}
              placeholder="PO UUID"
            />
            <Input
              label="Supplier ID *"
              value={formSupplierId}
              onChange={(e) => setFormSupplierId(e.target.value)}
              placeholder="Supplier UUID"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Warehouse ID *"
              value={formWarehouseId}
              onChange={(e) => setFormWarehouseId(e.target.value)}
              placeholder="Warehouse UUID"
            />
            <Input
              label="Received Date *"
              type="date"
              value={formReceivedDate}
              onChange={(e) => setFormReceivedDate(e.target.value)}
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">GRN Lines *</label>
              <Button variant="ghost" size="sm" onClick={addLine}>
                + Add Line
              </Button>
            </div>
            <div className="space-y-3">
              {formLines.map((line, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-[10px] space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="PO Line ID"
                        value={line.po_line_id}
                        onChange={(e) => updateLine(idx, 'po_line_id', e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Item ID"
                        value={line.item_id}
                        onChange={(e) => updateLine(idx, 'item_id', e.target.value)}
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Ordered"
                      value={line.ordered_quantity}
                      onChange={(e) => updateLine(idx, 'ordered_quantity', e.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Received"
                      value={line.received_quantity}
                      onChange={(e) => updateLine(idx, 'received_quantity', e.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Accepted"
                      value={line.accepted_quantity}
                      onChange={(e) => updateLine(idx, 'accepted_quantity', e.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Rejected"
                      value={line.rejected_quantity}
                      onChange={(e) => updateLine(idx, 'rejected_quantity', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder="Optional notes"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={() => { setShowCreate(false); resetForm() }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create GRN
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Accept/Reject Modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.action === 'accept' ? 'Accept GRN' : 'Reject GRN'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {confirmAction?.action === 'accept'
              ? 'Accepting this GRN will update stock levels for all accepted quantities. Continue?'
              : 'Are you sure you want to reject this GRN? No stock changes will be made.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction(null)}>Cancel</Button>
            {confirmAction?.action === 'accept' ? (
              <Button
                size="sm"
                loading={acceptMutation.isPending}
                onClick={() => confirmAction && handleAccept(confirmAction.id)}
              >
                Accept GRN
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                loading={rejectMutation.isPending}
                onClick={() => confirmAction && handleReject(confirmAction.id)}
              >
                Reject GRN
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
