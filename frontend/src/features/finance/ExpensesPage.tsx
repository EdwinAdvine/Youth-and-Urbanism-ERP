import React, { useState } from 'react'
import {
  Button,
  Input,
  Select,
  Badge,
  Card,
  Spinner,
  Modal,
  Table,
  toast,
} from '../../components/ui'
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useSubmitExpense,
  useApproveExpense,
  useRejectExpense,
  useReimburseExpense,
  useUploadReceipt,
  getExpenseReceiptUrl,
  type Expense,
  type ExpenseStatus,
  type ExpenseCategory,
} from '../../api/finance'
import { CustomFieldsSection } from './components/CustomFieldsSection'
import apiClient from '../../api/client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<ExpenseStatus, 'default' | 'info' | 'success' | 'warning' | 'danger' | 'primary'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  reimbursed: 'primary',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'reimbursed', label: 'Reimbursed' },
]

const CATEGORY_OPTIONS: { value: ExpenseCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'software', label: 'Software' },
  { value: 'services', label: 'Services' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_OPTIONS_FORM = CATEGORY_OPTIONS.filter((o) => o.value !== '')

// ─── Reject Modal ────────────────────────────────────────────────────────────

function RejectModal({ open, onClose, expenseId }: { open: boolean; onClose: () => void; expenseId: string }) {
  const [reason, setReason] = useState('')
  const rejectMut = useRejectExpense()

  React.useEffect(() => {
    if (open) setReason('')
  }, [open])

  async function handleReject(ev: React.FormEvent) {
    ev.preventDefault()
    if (!reason.trim()) { toast('error', 'Rejection reason is required'); return }
    try {
      await rejectMut.mutateAsync({ id: expenseId, reason: reason.trim() })
      toast('success', 'Expense rejected')
      onClose()
    } catch {
      toast('error', 'Failed to reject expense')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reject Expense" size="sm">
      <form onSubmit={handleReject} className="space-y-4">
        <Input
          label="Rejection Reason *"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this expense is being rejected..."
        />
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={rejectMut.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={rejectMut.isPending}>
            Reject
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Expense Modal ───────────────────────────────────────────────────────────

interface ExpenseModalProps {
  open: boolean
  onClose: () => void
  editing: Expense | null
}

function ExpenseModal({ open, onClose, editing }: ExpenseModalProps) {
  const createMut = useCreateExpense()
  const updateMut = useUpdateExpense()
  const uploadReceiptMut = useUploadReceipt()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('other')
  const [date, setDate] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [hasExistingReceipt, setHasExistingReceipt] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open && editing) {
      setDescription(editing.description)
      setAmount(String(editing.amount))
      setCategory(editing.category)
      setDate(editing.expense_date?.split('T')[0] || '')
      setReceiptFile(null)
      setReceiptPreview(null)
      setHasExistingReceipt(!!editing.receipt_file_id)
    } else if (open && !editing) {
      setDescription('')
      setAmount('')
      setCategory('other')
      setDate(new Date().toISOString().split('T')[0])
      setReceiptFile(null)
      setReceiptPreview(null)
      setHasExistingReceipt(false)
      setCustomFieldValues({})
    }
    if (open && editing) {
      setCustomFieldValues((editing as any).custom_fields || {})
    }
    setErrors({})
  }, [open, editing])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'application/pdf']
    if (!allowed.includes(file.type)) {
      toast('error', 'Please upload an image (JPEG, PNG, GIF, WebP, HEIC) or PDF')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('error', 'File must be under 10 MB')
      return
    }

    setReceiptFile(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setReceiptPreview(url)
    } else {
      setReceiptPreview(null)
    }
  }

  function clearReceipt() {
    setReceiptFile(null)
    setReceiptPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleOcrAutoFill() {
    if (!receiptFile || !receiptFile.type.startsWith('image/')) return
    setIsOcrLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', receiptFile)
      const { data } = await apiClient.post('/finance/ai/ocr-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const filled = data.pre_filled || {}
      if (filled.vendor_name) setDescription(filled.vendor_name)
      if (filled.amount) setAmount(String(filled.amount))
      if (filled.expense_date) setDate(filled.expense_date)
      if (filled.category) {
        const catMap: Record<string, ExpenseCategory> = {
          meals: 'meals', travel: 'travel', accommodation: 'travel',
          office_supplies: 'supplies', software: 'software', hardware: 'equipment',
          utilities: 'utilities', marketing: 'marketing', training: 'other', other: 'other',
        }
        const mapped = catMap[filled.category] || 'other'
        setCategory(mapped as ExpenseCategory)
      }
      toast('success', `Auto-filled from receipt (${data.ocr_result?.confidence || 'medium'} confidence)`)
    } catch {
      toast('error', 'OCR failed — fill in manually')
    } finally {
      setIsOcrLoading(false)
    }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!description.trim()) e.description = 'Description is required'
    if (!amount || Number(amount) <= 0) e.amount = 'Valid amount is required'
    if (!date) e.date = 'Date is required'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    try {
      let expenseId: string
      if (editing) {
        const result = await updateMut.mutateAsync({
          id: editing.id,
          description: description.trim(),
          amount: Number(amount),
          category,
          expense_date: date,
          custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
        } as any)
        expenseId = (result as any).id || editing.id
        toast('success', 'Expense updated')
      } else {
        const result = await createMut.mutateAsync({
          description: description.trim(),
          amount: Number(amount),
          category,
          expense_date: date,
          custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
        } as any)
        expenseId = (result as any).id
        toast('success', 'Expense created')
      }

      // Upload receipt if a file was selected
      if (receiptFile) {
        try {
          await uploadReceiptMut.mutateAsync({ expenseId, file: receiptFile })
          toast('success', 'Receipt uploaded')
        } catch {
          toast('error', 'Expense saved but receipt upload failed')
        }
      }

      onClose()
    } catch {
      toast('error', 'Failed to save expense')
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending || uploadReceiptMut.isPending

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Expense' : 'New Expense'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <Input
          label="Description *"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          placeholder="e.g. Client dinner at Bistro"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Amount *"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.amount}
            placeholder="0.00"
          />
          <Select
            label="Category *"
            options={CATEGORY_OPTIONS_FORM}
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          />
          <Input
            label="Date *"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
          />
        </div>

        {/* Receipt Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Receipt</label>
          <div className="border-2 border-dashed border-gray-300 rounded-[10px] p-4 text-center hover:border-[#51459d] transition-colors">
            {receiptPreview ? (
              <div className="space-y-2">
                <img src={receiptPreview} alt="Receipt preview" className="max-h-32 mx-auto rounded-lg object-contain" />
                <p className="text-xs text-gray-500">{receiptFile?.name}</p>
                <div className="flex items-center justify-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={clearReceipt}>
                    Remove
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleOcrAutoFill}
                    loading={isOcrLoading}
                    className="border-[#51459d] text-[#51459d] hover:bg-[#51459d]/5"
                  >
                    ✨ Auto-fill from Receipt
                  </Button>
                </div>
              </div>
            ) : receiptFile ? (
              <div className="space-y-2">
                <svg className="h-8 w-8 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-600">{receiptFile.name}</p>
                <Button type="button" size="sm" variant="outline" onClick={clearReceipt}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <svg className="h-8 w-8 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-500">
                  {hasExistingReceipt ? 'Receipt attached — upload new to replace' : 'Take photo or upload receipt'}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute('capture', 'environment')
                        fileInputRef.current.click()
                      }
                    }}
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    Camera
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.removeAttribute('capture')
                        fileInputRef.current.click()
                      }
                    }}
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Browse
                  </Button>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic,application/pdf"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Dynamic custom fields */}
        <CustomFieldsSection
          entityType="expense"
          values={customFieldValues}
          onChange={setCustomFieldValues}
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" loading={isBusy}>
            {editing ? 'Save Changes' : 'Create Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── ExpensesPage ────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectId, setRejectId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading } = useExpenses({
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  })
  const submitMut = useSubmitExpense()
  const approveMut = useApproveExpense()
  const reimburseMut = useReimburseExpense()

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(exp: Expense) {
    setEditing(exp)
    setModalOpen(true)
  }

  function openReject(id: string) {
    setRejectId(id)
    setRejectModalOpen(true)
  }

  async function handleSubmitExpense(id: string) {
    try {
      await submitMut.mutateAsync(id)
      toast('success', 'Expense submitted for approval')
    } catch {
      toast('error', 'Failed to submit expense')
    }
  }

  async function handleApprove(id: string) {
    try {
      await approveMut.mutateAsync(id)
      toast('success', 'Expense approved')
    } catch {
      toast('error', 'Failed to approve expense')
    }
  }

  async function handleReimburse(id: string) {
    try {
      await reimburseMut.mutateAsync(id)
      toast('success', 'Expense marked as reimbursed')
    } catch {
      toast('error', 'Failed to reimburse expense')
    }
  }

  const items = data?.items ?? []

  const columns = [
    {
      key: 'description',
      label: 'Description',
      render: (row: Expense) => (
        <div className="flex items-center gap-1.5">
          <div>
            <span className="font-medium text-gray-900">{row.description}</span>
          </div>
          {row.receipt_file_id && (
            <button
              onClick={async () => {
                try {
                  const url = await getExpenseReceiptUrl(row.id)
                  window.open(url, '_blank')
                } catch {
                  toast('error', 'Failed to load receipt')
                }
              }}
              className="text-[#51459d] hover:text-[#3d3478] flex-shrink-0"
              title="View receipt"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: Expense) => <span className="font-medium">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: Expense) => (
        <span className="text-gray-700 capitalize">{row.category}</span>
      ),
    },
    {
      key: 'expense_date',
      label: 'Date',
      render: (row: Expense) => <span className="text-gray-700">{formatDate(row.expense_date)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Expense) => (
        <Badge variant={STATUS_BADGE[row.status]}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Expense) => (
        <div className="flex items-center gap-2">
          {row.status === 'draft' && (
            <>
              <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleSubmitExpense(row.id)}
                loading={submitMut.isPending}
              >
                Submit
              </Button>
            </>
          )}
          {row.status === 'submitted' && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleApprove(row.id)}
                loading={approveMut.isPending}
              >
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => openReject(row.id)}>
                Reject
              </Button>
            </>
          )}
          {row.status === 'approved' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleReimburse(row.id)}
              loading={reimburseMut.isPending}
            >
              Reimburse
            </Button>
          )}
          {row.status === 'rejected' && row.rejection_reason && (
            <span className="text-xs text-danger" title={row.rejection_reason}>
              Reason: {row.rejection_reason.length > 30
                ? row.rejection_reason.slice(0, 30) + '...'
                : row.rejection_reason}
            </span>
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
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage employee expenses</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Expense
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-40">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <span className="text-sm text-gray-500 mb-2">{data?.total ?? 0} expenses</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <Table<Expense>
              columns={columns}
              data={items}
              loading={isLoading}
              emptyText="No expenses found"
              keyExtractor={(row) => row.id}
            />
          </div>
        </Card>
      )}

      <ExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />

      <RejectModal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        expenseId={rejectId}
      />
    </div>
  )
}
