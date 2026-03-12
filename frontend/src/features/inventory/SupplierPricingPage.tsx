import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useSupplierPrices, useCreateSupplierPrice, useSuppliers, useInventoryItems, type SupplierPrice } from '../../api/inventory'

export default function SupplierPricingPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ supplier_id: '', item_id: '', unit_price: '', min_order_qty: '1', lead_time_days: '0', currency: 'USD', valid_from: '', valid_to: '' })

  const { data: prices, isLoading } = useSupplierPrices()
  const { data: suppliersData } = useSuppliers()
  const { data: items } = useInventoryItems()
  const createPrice = useCreateSupplierPrice()

  const supplierOptions = (suppliersData ?? []).map(s => ({ value: s.id, label: s.name }))
  const itemOptions = (items?.items ?? []).map(i => ({ value: i.id, label: `${i.name} (${i.sku})` }))

  async function handleCreate() {
    if (!form.supplier_id || !form.item_id || !form.unit_price) {
      toast('warning', 'Supplier, item, and unit price are required')
      return
    }
    try {
      await createPrice.mutateAsync({
        supplier_id: form.supplier_id,
        item_id: form.item_id,
        unit_price: parseFloat(form.unit_price),
        min_order_qty: parseInt(form.min_order_qty),
        lead_time_days: parseInt(form.lead_time_days),
        currency: form.currency,
        valid_from: form.valid_from || undefined,
        valid_to: form.valid_to || undefined,
      } as Partial<import('../../api/inventory').SupplierPrice>)
      toast('success', 'Price list entry created')
      setModalOpen(false)
      setForm({ supplier_id: '', item_id: '', unit_price: '', min_order_qty: '1', lead_time_days: '0', currency: 'USD', valid_from: '', valid_to: '' })
    } catch {
      toast('error', 'Failed to create price')
    }
  }

  const columns = [
    { key: 'item_name', label: 'Item', render: (row: SupplierPrice) => <span className="font-medium">{row.item_name ?? row.item_id}</span> },
    { key: 'supplier_name', label: 'Supplier', render: (row: SupplierPrice) => row.supplier_name ?? '—' },
    { key: 'unit_price', label: 'Unit Price', render: (row: SupplierPrice) => <span className="font-semibold">${row.unit_price} {row.currency}</span> },
    { key: 'min_order_qty', label: 'Min Qty' },
    { key: 'lead_time_days', label: 'Lead Time', render: (row: SupplierPrice) => `${row.lead_time_days}d` },
    { key: 'valid_to', label: 'Valid Until', render: (row: SupplierPrice) => row.valid_to ? new Date(row.valid_to).toLocaleDateString() : <span className="text-gray-400">Open</span> },
    { key: 'is_active', label: 'Status', render: (row: SupplierPrice) => <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge> },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Supplier Pricing</h1>
          <p className="text-sm text-gray-500 mt-1">Manage supplier price lists and best-price lookup</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Add Price</Button>
      </div>

      <Card padding={false}>
        <Table<SupplierPrice>
          columns={columns}
          data={prices ?? []}
          loading={isLoading}
          emptyText="No supplier prices configured."
          keyExtractor={(row) => row.id}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Supplier Price" size="sm">
        <div className="space-y-4">
          <Select label="Supplier *" options={[{ value: '', label: 'Select supplier...' }, ...supplierOptions]} value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} />
          <Select label="Item *" options={[{ value: '', label: 'Select item...' }, ...itemOptions]} value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Unit Price *" type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} step="0.01" />
            <Input label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min Qty" type="number" value={form.min_order_qty} onChange={(e) => setForm({ ...form, min_order_qty: e.target.value })} />
            <Input label="Lead Time (days)" type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valid From" type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            <Input label="Valid To" type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createPrice.isPending}>Add Price</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
