import React, { useState } from 'react'
import {
  cn,
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
  useVendorBills,
  useCreateVendorBill,
  useUpdateVendorBill,
  useApproveVendorBill,
  usePayVendorBill,
  useDeleteVendorBill,
  type VendorBill,
  type VendorBillStatus,
} from '../../api/finance'
import { CustomFieldsSection } from './components/CustomFieldsSection'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<VendorBillStatus, 'default' | 'info' | 'success' | 'warning' | 'danger' | 'primary'> = {
  draft: 'default',
  pending: 'warning',
  approved: 'info',
  paid: 'success',
  cancelled: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
]

// ─── Line Item Row ───────────────────────────────────────────────────────────

interface LineRow {
  description: string
  quantity: string
  unit_price: string
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface VendorBillModalProps {
  open: boolean
  onClose: () => void
  editing: VendorBill | null
}

function VendorBillModal({ open, onClose, editing }: VendorBillModalProps) {
  const createMut = useCreateVendorBill()
  const updateMut = useUpdateVendorBill()

  const [vendorName, setVendorName] = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [taxAmount, setTaxAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([{ description: '', quantity: '1', unit_price: '' }])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({})

  React.useEffect(() => {
    if (open && editing) {
      setVendorName(editing.vendor_name)
      setVendorEmail(editing.vendor_email || '')
      setIssueDate(editing.issue_date?.split('T')[0] || '')
      setDueDate(editing.due_date?.split('T')[0] || '')
      setTaxAmount(editing.tax_amount ? String(editing.tax_amount) : '')
      setNotes(editing.notes || '')
      setLines(
        editing.line_items.length > 0
          ? editing.line_items.map((l) => ({
              description: l.description,
              quantity: String(l.quantity),
              unit_price: String(l.unit_price),
            }))
          : [{ description: '', quantity: '1', unit_price: '' }]
      )
    } else if (open && !editing) {
      setVendorName('')
      setVendorEmail('')
      setIssueDate(new Date().toISOString().split('T')[0])
      setDueDate('')
      setTaxAmount('')
      setNotes('')
      setLines([{ description: '', quantity: '1', unit_price: '' }])
      setCustomFieldValues({})
    }
    if (open && editing) {
      setCustomFieldValues((editing as any).custom_fields || {})
    }
    setErrors({})
  }, [open, editing])

  function addLine() {
    setLines((prev) => [...prev, { description: '', quantity: '1', unit_price: '' }])
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof LineRow, value: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!vendorName.trim()) e.vendorName = 'Vendor name is required'
    if (!issueDate) e.issueDate = 'Issue date is required'
    if (!dueDate) e.dueDate = 'Due date is required'
    const validLines = lines.filter((l) => l.description && l.unit_price)
    if (validLines.length === 0) e.lines = 'At least one line item is required'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    const validLines = lines
      .filter((l) => l.description && l.unit_price)
      .map((l) => ({
        description: l.description,
        quantity: Number(l.quantity) || 1,
        unit_price: Number(l.unit_price),
      }))

    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          vendor_name: vendorName.trim(),
          vendor_email: vendorEmail.trim() || undefined,
          issue_date: issueDate,
          due_date: dueDate,
          line_items: validLines,
          tax_amount: taxAmount ? Number(taxAmount) : undefined,
          notes: notes || undefined,
          custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
        } as any)
        toast('success', 'Vendor bill updated')
      } else {
        await createMut.mutateAsync({
          vendor_name: vendorName.trim(),
          vendor_email: vendorEmail.trim() || undefined,
          issue_date: issueDate,
          due_date: dueDate,
          line_items: validLines,
          tax_amount: taxAmount ? Number(taxAmount) : undefined,
          notes: notes || undefined,
          custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
        } as any)
        toast('success', 'Vendor bill created')
      }
      onClose()
    } catch {
      toast('error', 'Failed to save vendor bill')
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Vendor Bill' : 'New Vendor Bill'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Vendor Name *"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            error={errors.vendorName}
            placeholder="e.g. Office Supplies Ltd"
          />
          <Input
            label="Vendor Email"
            type="email"
            value={vendorEmail}
            onChange={(e) => setVendorEmail(e.target.value)}
            placeholder="billing@vendor.com"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Issue Date *"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            error={errors.issueDate}
          />
          <Input
            label="Due Date *"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            error={errors.dueDate}
          />
          <Input
            label="Tax Amount"
            type="number"
            min="0"
            step="0.01"
            value={taxAmount}
            onChange={(e) => setTaxAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Line Items *</label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              + Add Line
            </Button>
          </div>
          {errors.lines && <p className="text-xs text-danger mb-2">{errors.lines}</p>}
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label={idx === 0 ? 'Description' : undefined}
                    value={line.description}
                    onChange={(e) => updateLine(idx, 'description', e.target.value)}
                    placeholder="Item description"
                  />
                </div>
                <div className="w-24">
                  <Input
                    label={idx === 0 ? 'Qty' : undefined}
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <Input
                    label={idx === 0 ? 'Unit Price' : undefined}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => updateLine(idx, 'unit_price', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="mb-0.5 text-gray-400 hover:text-danger transition-colors p-1.5"
                    title="Remove line"
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

        <Input
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
        />

        {/* Dynamic custom fields */}
        <CustomFieldsSection
          entityType="vendor_bill"
          values={customFieldValues}
          onChange={setCustomFieldValues}
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" loading={isBusy}>
            {editing ? 'Save Changes' : 'Create Vendor Bill'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── VendorBillsPage ─────────────────────────────────────────────────────────

export default function VendorBillsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VendorBill | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useVendorBills({ status: statusFilter || undefined })
  const deleteMut = useDeleteVendorBill()
  const approveMut = useApproveVendorBill()
  const payMut = usePayVendorBill()

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(bill: VendorBill) {
    setEditing(bill)
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this vendor bill? This action cannot be undone.')) return
    try {
      await deleteMut.mutateAsync(id)
      toast('success', 'Vendor bill deleted')
    } catch {
      toast('error', 'Failed to delete vendor bill')
    }
  }

  async function handleApprove(id: string) {
    try {
      await approveMut.mutateAsync(id)
      toast('success', 'Vendor bill approved')
    } catch {
      toast('error', 'Failed to approve vendor bill')
    }
  }

  async function handlePay(id: string) {
    if (!confirm('Mark this bill as paid?')) return
    try {
      await payMut.mutateAsync(id)
      toast('success', 'Vendor bill marked as paid')
    } catch {
      toast('error', 'Failed to pay vendor bill')
    }
  }

  const items = data?.items ?? []

  const columns = [
    {
      key: 'bill_number',
      label: 'Bill #',
      render: (row: VendorBill) => <span className="font-medium text-gray-900">{row.bill_number}</span>,
    },
    {
      key: 'vendor_name',
      label: 'Vendor',
      render: (row: VendorBill) => (
        <div>
          <span className="text-gray-900">{row.vendor_name}</span>
          {row.vendor_email && <p className="text-xs text-gray-500">{row.vendor_email}</p>}
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: VendorBill) => <span className="font-medium">{formatCurrency(row.total)}</span>,
    },
    {
      key: 'issue_date',
      label: 'Issue Date',
      render: (row: VendorBill) => <span className="text-gray-700">{formatDate(row.issue_date)}</span>,
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (row: VendorBill) => {
        const overdue = new Date(row.due_date) < new Date() && row.status !== 'paid'
        return (
          <span className={cn('text-gray-700', overdue && 'text-danger font-medium')}>
            {formatDate(row.due_date)}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: VendorBill) => (
        <Badge variant={STATUS_BADGE[row.status]}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: VendorBill) => (
        <div className="flex items-center gap-2">
          {(row.status === 'draft' || row.status === 'pending') && (
            <>
              <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleApprove(row.id)}
                loading={approveMut.isPending}
              >
                Approve
              </Button>
            </>
          )}
          {row.status === 'approved' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handlePay(row.id)}
              loading={payMut.isPending}
            >
              Pay
            </Button>
          )}
          {row.status === 'draft' && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDelete(row.id)}
              loading={deleteMut.isPending}
            >
              Delete
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
          <h1 className="text-2xl font-bold text-gray-900">Vendor Bills</h1>
          <p className="text-sm text-gray-500 mt-1">Manage bills from vendors and suppliers</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Vendor Bill
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 mb-4">
        <div className="w-40">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        <span className="text-sm text-gray-500 mb-2">{data?.total ?? 0} bills</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card padding={false}>
          <Table<VendorBill>
            columns={columns}
            data={items}
            loading={isLoading}
            emptyText="No vendor bills found"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      <VendorBillModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />
    </div>
  )
}
