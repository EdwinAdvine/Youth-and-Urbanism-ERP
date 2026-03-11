import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useQuotes,
  useCreateQuote,
  useUpdateQuote,
  useSendQuote,
  useContacts,
  useCRMProducts,
  type Quote,
  type QuoteStatus,
  type CreateQuotePayload,
  type CreateQuoteLinePayload,
} from '../../api/crm'

const statusVariant: Record<QuoteStatus, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  sent: 'info',
  accepted: 'success',
  rejected: 'danger',
  expired: 'warning',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const emptyLine: CreateQuoteLinePayload = { description: '', quantity: 1, unit_price: 0, discount: 0 }

export default function QuotesPage() {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | ''>('')
  const { data: quotes, isLoading } = useQuotes({ status: statusFilter || undefined })
  const { data: contacts } = useContacts({ limit: 500 })
  const { data: products } = useCRMProducts()
  const createQuote = useCreateQuote()
  const updateQuote = useUpdateQuote()
  const sendQuote = useSendQuote()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Quote | null>(null)
  const [form, setForm] = useState<{ contact_id: string; valid_until: string; notes: string; tax_rate: number; items: CreateQuoteLinePayload[] }>({
    contact_id: '',
    valid_until: '',
    notes: '',
    tax_rate: 0,
    items: [{ ...emptyLine }],
  })

  function openCreate() {
    setEditing(null)
    setForm({ contact_id: '', valid_until: '', notes: '', tax_rate: 0, items: [{ ...emptyLine }] })
    setShowModal(true)
  }

  function openEdit(q: Quote) {
    setEditing(q)
    setForm({
      contact_id: q.contact_id,
      valid_until: q.valid_until?.slice(0, 10) ?? '',
      notes: q.notes ?? '',
      tax_rate: 0,
      items: q.items.map((i) => ({
        product_id: i.product_id ?? undefined,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
      })),
    })
    setShowModal(true)
  }

  function addLine() {
    setForm((p) => ({ ...p, items: [...p.items, { ...emptyLine }] }))
  }

  function removeLine(idx: number) {
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))
  }

  function updateLine(idx: number, field: keyof CreateQuoteLinePayload, value: string | number) {
    setForm((p) => ({
      ...p,
      items: p.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }))
  }

  function selectProduct(idx: number, productId: string) {
    const product = products?.find((p) => p.id === productId)
    if (product) {
      setForm((p) => ({
        ...p,
        items: p.items.map((item, i) =>
          i === idx ? { ...item, product_id: productId, description: product.name, unit_price: product.price } : item
        ),
      }))
    }
  }

  const subtotal = form.items.reduce((sum, item) => sum + item.quantity * item.unit_price * (1 - (item.discount ?? 0) / 100), 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: CreateQuotePayload = {
      contact_id: form.contact_id,
      valid_until: form.valid_until || undefined,
      notes: form.notes || undefined,
      tax_rate: form.tax_rate || undefined,
      items: form.items,
    }

    if (editing) {
      updateQuote.mutate(
        { id: editing.id, valid_until: payload.valid_until, notes: payload.notes, tax_rate: payload.tax_rate, items: payload.items },
        {
          onSuccess: () => { toast('success', 'Quote updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update quote'),
        }
      )
    } else {
      createQuote.mutate(payload, {
        onSuccess: () => { toast('success', 'Quote created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create quote'),
      })
    }
  }

  function handleSend(id: string) {
    if (!window.confirm('Send this quote to the contact?')) return
    sendQuote.mutate(id, {
      onSuccess: () => toast('success', 'Quote sent'),
      onError: () => toast('error', 'Failed to send quote'),
    })
  }

  const columns = [
    {
      key: 'quote_number',
      label: 'Quote #',
      render: (q: Quote) => <span className="font-medium text-gray-900 dark:text-gray-100">{q.quote_number}</span>,
    },
    {
      key: 'contact_name',
      label: 'Contact',
      render: (q: Quote) => q.contact_name ?? '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (q: Quote) => <Badge variant={statusVariant[q.status]}>{q.status}</Badge>,
    },
    {
      key: 'grand_total',
      label: 'Total',
      render: (q: Quote) => <span className="font-semibold">{formatCurrency(q.grand_total)}</span>,
    },
    {
      key: 'valid_until',
      label: 'Valid Until',
      render: (q: Quote) => q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '-',
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (q: Quote) => new Date(q.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (q: Quote) => (
        <div className="flex items-center justify-end gap-2">
          {q.status === 'draft' && (
            <Button variant="ghost" size="sm" onClick={() => handleSend(q.id)}>Send</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>Edit</Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quotes</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage sales quotes</p>
        </div>
        <Button onClick={openCreate}>Create Quote</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'sent', label: 'Sent' },
            { value: 'accepted', label: 'Accepted' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'expired', label: 'Expired' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | '')}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={quotes ?? []}
          keyExtractor={(q) => q.id}
          emptyText="No quotes found."
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Quote' : 'Create Quote'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <Select
              label="Contact"
              required
              options={[
                { value: '', label: 'Select contact...' },
                ...(contacts?.items?.map((c) => ({ value: c.id, label: c.name })) ?? []),
              ]}
              value={form.contact_id}
              onChange={(e) => setForm((p) => ({ ...p, contact_id: e.target.value }))}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid Until" type="date" value={form.valid_until} onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))} />
            <Input label="Tax Rate (%)" type="number" step="0.01" value={form.tax_rate || ''} onChange={(e) => setForm((p) => ({ ...p, tax_rate: Number(e.target.value) }))} />
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Line Items</label>
              <Button variant="ghost" size="sm" type="button" onClick={addLine}>+ Add Item</Button>
            </div>
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3">
                  {products && products.length > 0 ? (
                    <Select
                      options={[{ value: '', label: 'Custom...' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
                      value={item.product_id ?? ''}
                      onChange={(e) => selectProduct(idx, e.target.value)}
                    />
                  ) : null}
                </div>
                <div className="col-span-3">
                  <Input placeholder="Description" value={item.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  <Input type="number" step="0.01" placeholder="Price" value={item.unit_price} onChange={(e) => updateLine(idx, 'unit_price', Number(e.target.value))} />
                </div>
                <div className="col-span-1">
                  <Input type="number" placeholder="Disc%" value={item.discount ?? 0} onChange={(e) => updateLine(idx, 'discount', Number(e.target.value))} />
                </div>
                <div className="col-span-1">
                  {form.items.length > 1 && (
                    <Button variant="ghost" size="sm" type="button" className="text-danger" onClick={() => removeLine(idx)}>X</Button>
                  )}
                </div>
              </div>
            ))}
            <div className="text-right text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2 border-t border-gray-100 dark:border-gray-800">
              Subtotal: {formatCurrency(subtotal)}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createQuote.isPending || updateQuote.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
