import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Select, Pagination, toast,
} from '../../components/ui'
import {
  useRequisitions, useCreateRequisition, useSubmitRequisition,
  useApproveRequisition, useConvertRequisitionToPO, useDeleteRequisition,
  type ProcurementRequisition, type CreateRequisitionPayload, type RequisitionLineIn,
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
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  converted_to_po: 'primary',
}

const PRIORITY_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'converted_to_po', label: 'Converted to PO' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

interface LineFormState {
  item_id: string
  quantity: string
  estimated_unit_price: string
  notes: string
}

const defaultLine: LineFormState = {
  item_id: '',
  quantity: '1',
  estimated_unit_price: '0',
  notes: '',
}

export default function RequisitionsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string } | null>(null)

  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPriority, setFormPriority] = useState('medium')
  const [formRequiredBy, setFormRequiredBy] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formLines, setFormLines] = useState<LineFormState[]>([{ ...defaultLine }])

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useRequisitions({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    skip,
    limit,
  })

  const createMutation = useCreateRequisition()
  const submitMutation = useSubmitRequisition()
  const approveMutation = useApproveRequisition()
  const convertMutation = useConvertRequisitionToPO()
  const deleteMutation = useDeleteRequisition()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const addLine = () => setFormLines([...formLines, { ...defaultLine }])
  const removeLine = (idx: number) => {
    if (formLines.length <= 1) return
    setFormLines(formLines.filter((_, i) => i !== idx))
  }
  const updateLine = (idx: number, field: keyof LineFormState, value: string) => {
    const updated = [...formLines]
    updated[idx] = { ...updated[idx], [field]: value }
    setFormLines(updated)
  }

  const resetForm = () => {
    setFormTitle('')
    setFormDescription('')
    setFormPriority('medium')
    setFormRequiredBy('')
    setFormNotes('')
    setFormLines([{ ...defaultLine }])
  }

  const handleCreate = async () => {
    if (!formTitle.trim()) {
      toast('warning', 'Title is required')
      return
    }
    const validLines = formLines.filter((l) => l.item_id.trim())
    if (validLines.length === 0) {
      toast('warning', 'At least one line item with an item ID is required')
      return
    }
    const lines: RequisitionLineIn[] = validLines.map((l) => ({
      item_id: l.item_id.trim(),
      quantity: Number(l.quantity) || 1,
      estimated_unit_price: Number(l.estimated_unit_price) || 0,
      notes: l.notes.trim() || undefined,
    }))

    const payload: CreateRequisitionPayload = {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      priority: formPriority,
      required_by_date: formRequiredBy || undefined,
      notes: formNotes.trim() || undefined,
      lines,
    }

    try {
      const result = await createMutation.mutateAsync(payload)
      toast('success', `Requisition ${result.requisition_number} created`)
      setShowCreate(false)
      resetForm()
    } catch {
      toast('error', 'Failed to create requisition')
    }
  }

  const handleSubmit = async (id: string) => {
    try {
      const result = await submitMutation.mutateAsync(id)
      toast('success', `Requisition ${result.requisition_number} submitted for approval`)
    } catch {
      toast('error', 'Failed to submit requisition')
    }
  }

  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    try {
      const result = await approveMutation.mutateAsync({ id, action })
      toast('success', `Requisition ${result.requisition_number} ${action}d`)
      setConfirmAction(null)
    } catch {
      toast('error', `Failed to ${action} requisition`)
    }
  }

  const handleConvert = async (id: string) => {
    try {
      const result = await convertMutation.mutateAsync(id)
      toast('success', result.message)
      setConfirmAction(null)
    } catch {
      toast('error', 'Failed to convert requisition to PO')
    }
  }

  const columns = [
    {
      key: 'requisition_number',
      label: 'Req #',
      render: (row: ProcurementRequisition) => (
        <span className="text-[#51459d] font-medium">{row.requisition_number}</span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (row: ProcurementRequisition) => (
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[240px] block">{row.title}</span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row: ProcurementRequisition) => (
        <Badge variant={PRIORITY_BADGE[row.priority] ?? 'default'}>{row.priority}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: ProcurementRequisition) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'total_estimated',
      label: 'Est. Value',
      render: (row: ProcurementRequisition) => (
        <span className="text-gray-700 dark:text-gray-300">{formatCurrency(row.total_estimated)}</span>
      ),
    },
    {
      key: 'required_by_date',
      label: 'Required By',
      render: (row: ProcurementRequisition) => (
        <span className="text-gray-500 text-xs">{row.required_by_date ? formatDate(row.required_by_date) : '-'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: ProcurementRequisition) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: ProcurementRequisition) => (
        <div className="flex items-center gap-1">
          {row.status === 'draft' && (
            <>
              <Button size="sm" variant="ghost" onClick={() => handleSubmit(row.id)}>
                Submit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[#ff3a6e]"
                onClick={async () => {
                  if (!window.confirm('Delete this draft requisition?')) return
                  try {
                    await deleteMutation.mutateAsync(row.id)
                    toast('success', 'Requisition deleted')
                  } catch {
                    toast('error', 'Failed to delete requisition')
                  }
                }}
              >
                Delete
              </Button>
            </>
          )}
          {row.status === 'submitted' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-[#6fd943]"
                onClick={() => setConfirmAction({ id: row.id, action: 'approve' })}
              >
                Approve
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
          {row.status === 'approved' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[#51459d]"
              onClick={() => setConfirmAction({ id: row.id, action: 'convert' })}
            >
              Convert to PO
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Procurement Requisitions</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total requisitions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Requisition
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
          <div className="w-48">
            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
        <Table<ProcurementRequisition>
          columns={columns}
          data={data?.requisitions ?? []}
          loading={isLoading}
          emptyText="No requisitions found"
          keyExtractor={(row) => row.id}
        />
        </div>
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="New Requisition" size="lg">
        <div className="space-y-4">
          <Input
            label="Title *"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Requisition title"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder="Description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Priority"
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value)}
            />
            <Input
              label="Required By Date"
              type="date"
              value={formRequiredBy}
              onChange={(e) => setFormRequiredBy(e.target.value)}
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Line Items *</label>
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
                      placeholder="Unit Price"
                      value={line.estimated_unit_price}
                      onChange={(e) => updateLine(idx, 'estimated_unit_price', e.target.value)}
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

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder="Optional notes"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => { setShowCreate(false); resetForm() }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create Requisition
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Action Modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.action === 'approve'
            ? 'Approve Requisition'
            : confirmAction?.action === 'reject'
              ? 'Reject Requisition'
              : 'Convert to Purchase Order'
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {confirmAction?.action === 'approve' && 'Are you sure you want to approve this requisition?'}
            {confirmAction?.action === 'reject' && 'Are you sure you want to reject this requisition?'}
            {confirmAction?.action === 'convert' && 'This will create a new purchase order from the approved requisition. Continue?'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction(null)}>Cancel</Button>
            {confirmAction?.action === 'approve' && (
              <Button
                size="sm"
                loading={approveMutation.isPending}
                onClick={() => confirmAction && handleApprove(confirmAction.id, 'approve')}
              >
                Approve
              </Button>
            )}
            {confirmAction?.action === 'reject' && (
              <Button
                variant="danger"
                size="sm"
                loading={approveMutation.isPending}
                onClick={() => confirmAction && handleApprove(confirmAction.id, 'reject')}
              >
                Reject
              </Button>
            )}
            {confirmAction?.action === 'convert' && (
              <Button
                size="sm"
                loading={convertMutation.isPending}
                onClick={() => confirmAction && handleConvert(confirmAction.id)}
              >
                Convert to PO
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
