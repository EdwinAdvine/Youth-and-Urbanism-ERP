import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Input, Select, Modal, Pagination } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  usePurchaseOrders,
  useCreatePO,
  useInventoryItems,
  type PurchaseOrder,
  type CreatePOPayload,
  type CreatePOLinePayload,
} from '../../api/inventory'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function todayString() {
  return new Date().toISOString().split('T')[0]
}

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'danger'> = {
  draft: 'default',
  sent: 'info',
  received: 'success',
  cancelled: 'danger',
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

interface POFormState {
  supplier_name: string
  supplier_email: string
  order_date: string
  expected_date: string
  notes: string
}

interface LineForm {
  item_id: string
  quantity: string
  unit_price: string
}

const defaultPOForm: POFormState = {
  supplier_name: '',
  supplier_email: '',
  order_date: todayString(),
  expected_date: '',
  notes: '',
}

const defaultLine: LineForm = { item_id: '', quantity: '1', unit_price: '0' }

export default function PurchaseOrdersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<POFormState>(defaultPOForm)
  const [lines, setLines] = useState<LineForm[]>([{ ...defaultLine }])

  const limit = 10
  const skip = (page - 1) * limit

  const { data, isLoading } = usePurchaseOrders({ status: statusFilter || undefined })
  const { data: items } = useInventoryItems({ limit: 500 })
  const createPO = useCreatePO()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const pagedItems = data?.items.slice(skip, skip + limit) ?? []

  const itemOptions = [
    { value: '', label: 'Select item...' },
    ...(items?.items ?? []).map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` })),
  ]

  function addLine() {
    setLines([...lines, { ...defaultLine }])
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return
    setLines(lines.filter((_, i) => i !== index))
  }

  function updateLine(index: number, field: keyof LineForm, value: string) {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    setLines(updated)
  }

  const lineTotal = lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unit_price), 0)

  function openCreate() {
    setForm(defaultPOForm)
    setLines([{ ...defaultLine }])
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (!form.supplier_name.trim()) {
      toast('warning', 'Supplier name is required')
      return
    }
    if (!form.order_date) {
      toast('warning', 'Order date is required')
      return
    }
    const validLines = lines.filter((l) => l.item_id && Number(l.quantity) > 0)
    if (validLines.length === 0) {
      toast('warning', 'Add at least one line item')
      return
    }

    const payload: CreatePOPayload = {
      supplier_name: form.supplier_name.trim(),
      supplier_email: form.supplier_email.trim() || undefined,
      order_date: form.order_date,
      expected_date: form.expected_date || undefined,
      notes: form.notes.trim() || undefined,
      lines: validLines.map((l): CreatePOLinePayload => ({
        item_id: l.item_id,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
      })),
    }

    try {
      const created = await createPO.mutateAsync(payload)
      toast('success', 'Purchase order created')
      setModalOpen(false)
      navigate(`/inventory/purchase-orders/${created.id}`)
    } catch {
      toast('error', 'Failed to create purchase order')
    }
  }

  const columns = [
    {
      key: 'po_number',
      label: 'PO Number',
      render: (row: PurchaseOrder) => (
        <button
          onClick={() => navigate(`/inventory/purchase-orders/${row.id}`)}
          className="text-primary font-medium hover:underline"
        >
          {row.po_number}
        </button>
      ),
    },
    { key: 'supplier_name', label: 'Supplier' },
    {
      key: 'order_date',
      label: 'Order Date',
      render: (row: PurchaseOrder) => formatDate(row.order_date),
    },
    {
      key: 'expected_date',
      label: 'Expected',
      render: (row: PurchaseOrder) =>
        row.expected_date ? formatDate(row.expected_date) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: PurchaseOrder) => <span className="font-medium">{formatCurrency(row.total)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: PurchaseOrder) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'} className="capitalize">{row.status}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: PurchaseOrder) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/inventory/purchase-orders/${row.id}`)}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage supplier purchase orders</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New PO
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-44">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          />
        </div>
        <span className="text-sm text-gray-500">{data?.total ?? 0} orders</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<PurchaseOrder>
          columns={columns}
          data={pagedItems}
          loading={isLoading}
          emptyText="No purchase orders found"
          keyExtractor={(row) => row.id}
        />
        <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
      </Card>

      {/* Create PO Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Purchase Order"
        size="xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Header Fields */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Supplier Name *"
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
              placeholder="Supplier company name"
            />
            <Input
              label="Supplier Email"
              type="email"
              value={form.supplier_email}
              onChange={(e) => setForm({ ...form, supplier_email: e.target.value })}
              placeholder="supplier@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Order Date *"
              type="date"
              value={form.order_date}
              onChange={(e) => setForm({ ...form, order_date: e.target.value })}
            />
            <Input
              label="Expected Delivery Date"
              type="date"
              value={form.expected_date}
              onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional notes"
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Line Items</h3>
              <Button variant="ghost" size="sm" onClick={addLine}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Line
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Qty</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Unit Price</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Subtotal</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 px-2">
                        <select
                          value={line.item_id}
                          onChange={(e) => updateLine(i, 'item_id', e.target.value)}
                          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        >
                          {itemOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) => updateLine(i, 'unit_price', e.target.value)}
                          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right font-medium">
                        {formatCurrency(Number(line.quantity) * Number(line.unit_price))}
                      </td>
                      <td className="py-1.5 px-1">
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
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-3">
              <div className="flex items-center gap-3 text-sm font-bold text-gray-900">
                <span>Total:</span>
                <span className="text-base">{formatCurrency(lineTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} loading={createPO.isPending}>
              Create Purchase Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
