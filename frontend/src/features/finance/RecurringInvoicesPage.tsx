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
  useRecurringInvoices,
  useCreateRecurringInvoice,
  useUpdateRecurringInvoice,
  useDeleteRecurringInvoice,
  useGenerateRecurringInvoice,
  type RecurringInvoice,
  type RecurringFrequency,
} from '../../api/finance'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const FREQUENCY_BADGE: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger' | 'primary'> = {
  weekly: 'info',
  biweekly: 'info',
  monthly: 'primary',
  quarterly: 'warning',
  yearly: 'success',
}

// ─── Line Item Row ───────────────────────────────────────────────────────────

interface LineRow {
  description: string
  quantity: string
  unit_price: string
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface RecurringModalProps {
  open: boolean
  onClose: () => void
  editing: RecurringInvoice | null
}

function RecurringInvoiceModal({ open, onClose, editing }: RecurringModalProps) {
  const createMut = useCreateRecurringInvoice()
  const updateMut = useUpdateRecurringInvoice()

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [nextDate, setNextDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [taxAmount, setTaxAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([{ description: '', quantity: '1', unit_price: '' }])
  const [errors, setErrors] = useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open && editing) {
      setCustomerName(editing.customer_name)
      setCustomerEmail(editing.customer_email || '')
      setFrequency(editing.frequency)
      setNextDate(editing.next_date?.split('T')[0] || '')
      setEndDate(editing.end_date?.split('T')[0] || '')
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
      setCustomerName('')
      setCustomerEmail('')
      setFrequency('monthly')
      setNextDate('')
      setEndDate('')
      setTaxAmount('')
      setNotes('')
      setLines([{ description: '', quantity: '1', unit_price: '' }])
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
    if (!customerName.trim()) e.customerName = 'Customer name is required'
    if (!nextDate) e.nextDate = 'Next date is required'
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
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim() || undefined,
          frequency,
          next_date: nextDate,
          end_date: endDate || null,
          line_items: validLines,
          tax_amount: taxAmount ? Number(taxAmount) : undefined,
          notes: notes || undefined,
        })
        toast('success', 'Recurring invoice updated')
      } else {
        await createMut.mutateAsync({
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim() || undefined,
          frequency,
          next_date: nextDate,
          end_date: endDate || null,
          line_items: validLines,
          tax_amount: taxAmount ? Number(taxAmount) : undefined,
          notes: notes || undefined,
        })
        toast('success', 'Recurring invoice created')
      }
      onClose()
    } catch {
      toast('error', 'Failed to save recurring invoice')
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Recurring Invoice' : 'New Recurring Invoice'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Customer Name *"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            error={errors.customerName}
            placeholder="e.g. Acme Corp"
          />
          <Input
            label="Customer Email"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="billing@acme.com"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Frequency *"
            options={FREQUENCY_OPTIONS}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
          />
          <Input
            label="Next Date *"
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            error={errors.nextDate}
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
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
                    placeholder="Service or product description"
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

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Tax Amount"
            type="number"
            min="0"
            step="0.01"
            value={taxAmount}
            onChange={(e) => setTaxAmount(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" loading={isBusy}>
            {editing ? 'Save Changes' : 'Create Recurring Invoice'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── RecurringInvoicesPage ───────────────────────────────────────────────────

export default function RecurringInvoicesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringInvoice | null>(null)

  const { data, isLoading } = useRecurringInvoices()
  const deleteMut = useDeleteRecurringInvoice()
  const generateMut = useGenerateRecurringInvoice()
  const updateMut = useUpdateRecurringInvoice()

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(r: RecurringInvoice) {
    setEditing(r)
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this recurring invoice? This action cannot be undone.')) return
    try {
      await deleteMut.mutateAsync(id)
      toast('success', 'Recurring invoice deleted')
    } catch {
      toast('error', 'Failed to delete recurring invoice')
    }
  }

  async function handleGenerate(id: string) {
    try {
      await generateMut.mutateAsync(id)
      toast('success', 'Invoice generated successfully')
    } catch {
      toast('error', 'Failed to generate invoice')
    }
  }

  async function handleToggleActive(r: RecurringInvoice) {
    try {
      await updateMut.mutateAsync({ id: r.id, is_active: !r.is_active })
      toast('success', r.is_active ? 'Recurring invoice deactivated' : 'Recurring invoice activated')
    } catch {
      toast('error', 'Failed to update status')
    }
  }

  const items = data?.items ?? []

  const columns = [
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: RecurringInvoice) => (
        <div>
          <span className="font-medium text-gray-900">{row.customer_name}</span>
          {row.customer_email && (
            <p className="text-xs text-gray-500">{row.customer_email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'frequency',
      label: 'Frequency',
      render: (row: RecurringInvoice) => (
        <Badge variant={FREQUENCY_BADGE[row.frequency] ?? 'default'}>
          {row.frequency.charAt(0).toUpperCase() + row.frequency.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'total',
      label: 'Amount',
      render: (row: RecurringInvoice) => (
        <span className="font-medium">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'next_date',
      label: 'Next Date',
      render: (row: RecurringInvoice) => (
        <span className="text-gray-700">{formatDate(row.next_date)}</span>
      ),
    },
    {
      key: 'generated_count',
      label: 'Generated',
      render: (row: RecurringInvoice) => (
        <span className="text-gray-700">{row.generated_count} invoices</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: RecurringInvoice) => (
        <button
          onClick={() => handleToggleActive(row)}
          className="cursor-pointer"
          title={row.is_active ? 'Click to deactivate' : 'Click to activate'}
        >
          <Badge variant={row.is_active ? 'success' : 'default'}>
            {row.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: RecurringInvoice) => (
        <div className="flex items-center gap-2">
          {row.is_active && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGenerate(row.id)}
              loading={generateMut.isPending}
            >
              Generate Now
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDelete(row.id)}
            loading={deleteMut.isPending}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Manage auto-generated invoices on a schedule</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Recurring Invoice
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-sm text-gray-500">Total Recurring</p>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-700">{items.filter((i) => i.is_active).length}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Monthly Revenue</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(
              items
                .filter((i) => i.is_active)
                .reduce((sum, i) => sum + i.total, 0)
            )}
          </p>
        </Card>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card padding={false}>
          <Table<RecurringInvoice>
            columns={columns}
            data={items}
            loading={isLoading}
            emptyText="No recurring invoices yet"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      <RecurringInvoiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />
    </div>
  )
}
