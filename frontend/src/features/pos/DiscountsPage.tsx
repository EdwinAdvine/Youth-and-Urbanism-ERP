import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useDiscounts,
  useCreateDiscount,
  useUpdateDiscount,
  useDeleteDiscount,
  type POSDiscount,
  type CreateDiscountPayload,
} from '../../api/pos_ext'

const emptyForm: CreateDiscountPayload = {
  name: '',
  code: '',
  discount_type: 'percentage',
  value: 0,
  applies_to: 'order',
  valid_from: new Date().toISOString().slice(0, 10),
  is_active: true,
}

export default function DiscountsPage() {
  const { data, isLoading, error } = useDiscounts()
  const createDiscount = useCreateDiscount()
  const updateDiscount = useUpdateDiscount()
  const deleteDiscount = useDeleteDiscount()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<POSDiscount | null>(null)
  const [form, setForm] = useState<CreateDiscountPayload>(emptyForm)

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowModal(false) }

  const handleEdit = (d: POSDiscount) => {
    setEditing(d)
    setForm({
      name: d.name,
      code: d.code || '',
      discount_type: d.discount_type,
      value: d.value,
      min_order_amount: d.min_order_amount || undefined,
      max_discount_amount: d.max_discount_amount || undefined,
      applies_to: d.applies_to,
      valid_from: d.valid_from.slice(0, 10),
      valid_until: d.valid_until?.slice(0, 10) || undefined,
      is_active: d.is_active,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateDiscount.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Discount updated')
      } else {
        await createDiscount.mutateAsync(form)
        toast('success', 'Discount created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save discount')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this discount?')) return
    try {
      await deleteDiscount.mutateAsync(id)
      toast('success', 'Discount deleted')
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load discounts</div>

  const columns = [
    { key: 'name', label: 'Name', render: (r: POSDiscount) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'code', label: 'Code', render: (r: POSDiscount) => <span className="font-mono text-sm text-gray-500">{r.code || '-'}</span> },
    {
      key: 'value',
      label: 'Discount',
      render: (r: POSDiscount) => (
        <Badge variant="primary">{r.discount_type === 'percentage' ? `${r.value}%` : `$${r.value.toFixed(2)}`}</Badge>
      ),
    },
    { key: 'applies_to', label: 'Applies To', render: (r: POSDiscount) => <span className="text-sm text-gray-600 capitalize">{r.applies_to}</span> },
    { key: 'is_active', label: 'Status', render: (r: POSDiscount) => <Badge variant={r.is_active ? 'success' : 'default'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (r: POSDiscount) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Discounts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage discounts for POS transactions</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>Add Discount</Button>
      </div>

      <Card padding={false}>
        <Table columns={columns} data={data?.discounts ?? []} loading={isLoading} keyExtractor={(r) => r.id} emptyText="No discounts found" />
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Discount' : 'Add Discount'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Code" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Type" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
              options={[{ value: 'percentage', label: 'Percentage' }, { value: 'fixed', label: 'Fixed Amount' }]} />
            <Input label="Value" type="number" step="0.01" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} required />
            <Select label="Applies To" value={form.applies_to || 'order'} onChange={(e) => setForm({ ...form, applies_to: e.target.value as 'order' | 'item' })}
              options={[{ value: 'order', label: 'Entire Order' }, { value: 'item', label: 'Per Item' }]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid From" type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} required />
            <Input label="Valid Until" type="date" value={form.valid_until || ''} onChange={(e) => setForm({ ...form, valid_until: e.target.value || undefined })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="discount-active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            <label htmlFor="discount-active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createDiscount.isPending || updateDiscount.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
