import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Select, Badge, Spinner, toast } from '../../components/ui'
import {
  useCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
  type Coupon,
  type CreateCouponPayload,
} from '../../api/ecommerce_ext'

const emptyCoupon: CreateCouponPayload = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 0,
  min_order_amount: undefined,
  max_discount_amount: undefined,
  usage_limit: undefined,
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: '',
  is_active: true,
}

export default function CouponsPage() {
  const [page, setPage] = useState(1)
  const limit = 20
  const { data, isLoading, error } = useCoupons({ skip: (page - 1) * limit, limit })
  const createCoupon = useCreateCoupon()
  const updateCoupon = useUpdateCoupon()
  const deleteCoupon = useDeleteCoupon()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [form, setForm] = useState<CreateCouponPayload>(emptyCoupon)

  const resetForm = () => {
    setForm(emptyCoupon)
    setEditing(null)
    setShowModal(false)
  }

  const handleEdit = (c: Coupon) => {
    setEditing(c)
    setForm({
      code: c.code,
      description: c.description || '',
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_order_amount: c.min_order_amount || undefined,
      max_discount_amount: c.max_discount_amount || undefined,
      usage_limit: c.usage_limit || undefined,
      valid_from: c.valid_from.slice(0, 10),
      valid_until: c.valid_until?.slice(0, 10) || '',
      is_active: c.is_active,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateCoupon.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Coupon updated')
      } else {
        await createCoupon.mutateAsync(form)
        toast('success', 'Coupon created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save coupon')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this coupon?')) return
    try {
      await deleteCoupon.mutateAsync(id)
      toast('success', 'Coupon deleted')
    } catch {
      toast('error', 'Failed to delete coupon')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load coupons</div>

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (r: Coupon) => <span className="font-mono font-medium text-gray-900">{r.code}</span>,
    },
    {
      key: 'discount_type',
      label: 'Type',
      render: (r: Coupon) => (
        <Badge variant="primary">
          {r.discount_type === 'percentage' ? `${r.discount_value}%` : `$${r.discount_value.toFixed(2)}`}
        </Badge>
      ),
    },
    {
      key: 'usage',
      label: 'Usage',
      render: (r: Coupon) => (
        <span className="text-sm text-gray-600">
          {r.used_count}{r.usage_limit ? ` / ${r.usage_limit}` : ' (unlimited)'}
        </span>
      ),
    },
    {
      key: 'valid_from',
      label: 'Valid From',
      render: (r: Coupon) => <span className="text-sm text-gray-500">{new Date(r.valid_from).toLocaleDateString()}</span>,
    },
    {
      key: 'valid_until',
      label: 'Valid Until',
      render: (r: Coupon) => (
        <span className="text-sm text-gray-500">
          {r.valid_until ? new Date(r.valid_until).toLocaleDateString() : 'No expiry'}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (r: Coupon) => <Badge variant={r.is_active ? 'success' : 'default'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (r: Coupon) => (
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
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="text-sm text-gray-500 mt-1">Manage discount coupons for your store</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>Create Coupon</Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={data?.coupons ?? []}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No coupons found"
        />
        {data && data.total > limit && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm text-gray-500 self-center">Page {page} of {Math.ceil(data.total / limit)}</span>
            <Button size="sm" variant="ghost" disabled={page * limit >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Coupon' : 'Create Coupon'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
              placeholder="e.g. SAVE20"
            />
            <Select
              label="Discount Type"
              value={form.discount_type}
              onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
              options={[
                { value: 'percentage', label: 'Percentage' },
                { value: 'fixed', label: 'Fixed Amount' },
              ]}
            />
          </div>
          <Input
            label="Description"
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description"
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Discount Value"
              type="number"
              step="0.01"
              min="0"
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
              required
            />
            <Input
              label="Min Order Amount"
              type="number"
              step="0.01"
              min="0"
              value={form.min_order_amount ?? ''}
              onChange={(e) => setForm({ ...form, min_order_amount: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
            <Input
              label="Max Discount"
              type="number"
              step="0.01"
              min="0"
              value={form.max_discount_amount ?? ''}
              onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Usage Limit"
              type="number"
              min="0"
              value={form.usage_limit ?? ''}
              onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="Unlimited"
            />
            <Input
              label="Valid From"
              type="date"
              value={form.valid_from}
              onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
              required
            />
            <Input
              label="Valid Until"
              type="date"
              value={form.valid_until || ''}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="coupon-active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="coupon-active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createCoupon.isPending || updateCoupon.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
