import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spinner, Badge, Card, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useSendInvoice,
  useMarkInvoicePaid,
  exportInvoicePDF,
  type InvoiceType,
  type CreateInvoicePayload,
} from '../../api/finance'

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'danger'> = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
}

const TYPE_OPTIONS = [
  { value: 'sales', label: 'Sales Invoice' },
  { value: 'purchase', label: 'Purchase Invoice' },
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function todayString() {
  return new Date().toISOString().split('T')[0]
}

function dueDateString() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split('T')[0]
}

interface LineItemForm {
  description: string
  quantity: number
  unit_price: number
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const { data: invoice, isLoading } = useInvoice(isNew ? '' : (id ?? ''))
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const sendInvoice = useSendInvoice()
  const markPaid = useMarkInvoicePaid()

  const [downloading, setDownloading] = useState(false)
  const [editing, setEditing] = useState(isNew)
  const [type, setType] = useState<InvoiceType>('sales')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [issueDate, setIssueDate] = useState(todayString())
  const [dueDate, setDueDate] = useState(dueDateString())
  const [notes, setNotes] = useState('')
  const [taxAmount, setTaxAmount] = useState(0)
  const [lines, setLines] = useState<LineItemForm[]>([
    { description: '', quantity: 1, unit_price: 0 },
  ])

  // Populate form from existing invoice
  useEffect(() => {
    if (invoice && !isNew) {
      setType(invoice.invoice_type)
      setCustomerName(invoice.customer_name)
      setCustomerEmail(invoice.customer_email)
      setIssueDate(invoice.issue_date)
      setDueDate(invoice.due_date)
      setNotes(invoice.notes)
      setTaxAmount(invoice.tax_amount)
      setLines(
        (invoice.line_items ?? []).map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
        }))
      )
    }
  }, [invoice, isNew])

  function addLine() {
    setLines([...lines, { description: '', quantity: 1, unit_price: 0 }])
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return
    setLines(lines.filter((_, i) => i !== index))
  }

  function updateLine(index: number, field: keyof LineItemForm, value: string | number) {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    setLines(updated)
  }

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
  const total = subtotal + taxAmount

  async function handleSave() {
    if (!customerName.trim()) {
      toast('warning', 'Customer name is required')
      return
    }
    if (lines.some((l) => !l.description.trim())) {
      toast('warning', 'All line items need a description')
      return
    }

    const payload: CreateInvoicePayload = {
      invoice_type: type,
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      issue_date: issueDate,
      due_date: dueDate,
      line_items: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
      tax_amount: taxAmount,
      notes,
    }

    try {
      if (isNew) {
        const created = await createInvoice.mutateAsync(payload)
        toast('success', 'Invoice created')
        navigate(`/finance/invoices/${created.id}`, { replace: true })
      } else {
        await updateInvoice.mutateAsync({ id: id ?? '', ...payload })
        toast('success', 'Invoice updated')
        setEditing(false)
      }
    } catch {
      toast('error', 'Failed to save invoice')
    }
  }

  async function handleSend() {
    if (!id || isNew) return
    try {
      await sendInvoice.mutateAsync(id)
      toast('success', 'Invoice marked as sent')
    } catch {
      toast('error', 'Failed to send invoice')
    }
  }

  async function handleDownloadPDF() {
    if (!id || isNew) return
    setDownloading(true)
    try {
      await exportInvoicePDF(id)
      toast('success', 'Invoice PDF downloaded')
    } catch {
      toast('error', 'Failed to download invoice PDF')
    } finally {
      setDownloading(false)
    }
  }

  async function handleMarkPaid() {
    if (!id || isNew) return
    try {
      await markPaid.mutateAsync(id)
      toast('success', 'Invoice marked as paid')
    } catch {
      toast('error', 'Failed to mark invoice as paid')
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const isDraft = isNew || invoice?.status === 'draft'
  const isSent = invoice?.status === 'sent'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/finance/invoices')}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isNew ? 'New Invoice' : invoice?.invoice_number ?? 'Invoice'}
            </h1>
            {invoice && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={STATUS_BADGE[invoice.status] ?? 'default'}>{invoice.status}</Badge>
                <span className="text-sm text-gray-500">{invoice.invoice_type} invoice</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#51459d] px-3 py-1.5 text-sm font-medium text-[#51459d] hover:bg-[#51459d]/10 transition-colors disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
          )}
          {!isNew && isDraft && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {!isNew && isDraft && (
            <Button variant="outline" size="sm" onClick={handleSend} loading={sendInvoice.isPending}>
              Send
            </Button>
          )}
          {!isNew && isSent && (
            <Button size="sm" onClick={handleMarkPaid} loading={markPaid.isPending}>
              Mark Paid
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Form / View */}
      <Card>
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editing ? (
              <>
                <Select
                  label="Invoice Type"
                  options={TYPE_OPTIONS}
                  value={type}
                  onChange={(e) => setType(e.target.value as InvoiceType)}
                />
                <Input
                  label="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer or vendor name"
                />
                <Input
                  label="Customer Email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                />
                <div />
                <Input
                  label="Issue Date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
                <Input
                  label="Due Date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{invoice?.customer_name}</p>
                  {invoice?.customer_email && (
                    <p className="text-xs text-gray-500">{invoice.customer_email}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Issue Date</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                      {invoice?.issue_date && new Date(invoice.issue_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                      {invoice?.due_date && new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Line Items</h3>
              {editing && (
                <Button variant="ghost" size="sm" onClick={addLine}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Line
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Qty</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Unit Price</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Amount</th>
                    {editing && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {editing ? (
                    lines.map((line, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-gray-950">
                        <td className="py-2 px-3">
                          <input
                            value={line.description}
                            onChange={(e) => updateLine(i, 'description', e.target.value)}
                            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            placeholder="Item description"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                            min={1}
                            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={line.unit_price}
                            onChange={(e) => updateLine(i, 'unit_price', Number(e.target.value))}
                            min={0}
                            step={0.01}
                            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {formatCurrency(line.quantity * line.unit_price)}
                        </td>
                        <td className="py-2 px-1">
                          {lines.length > 1 && (
                            <button
                              onClick={() => removeLine(i)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    (invoice?.line_items ?? []).map((li, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-gray-950">
                        <td className="py-2 px-3">{li.description}</td>
                        <td className="py-2 px-3 text-right">{li.quantity}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(li.unit_price)}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCurrency(li.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(editing ? subtotal : (invoice?.subtotal ?? 0))}</span>
                </div>
                {editing ? (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Tax</span>
                    <input
                      type="number"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(Number(e.target.value))}
                      min={0}
                      step={0.01}
                      className="w-24 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax</span>
                    <span>{formatCurrency(invoice?.tax_amount ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(editing ? total : (invoice?.total ?? 0))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {editing ? (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
                placeholder="Additional notes..."
              />
            </div>
          ) : (
            invoice?.notes && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{invoice.notes}</p>
              </div>
            )
          )}

          {/* Actions */}
          {editing && (
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (isNew) {
                    navigate('/finance/invoices')
                  } else {
                    setEditing(false)
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={createInvoice.isPending || updateInvoice.isPending}
              >
                {isNew ? 'Create Invoice' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
