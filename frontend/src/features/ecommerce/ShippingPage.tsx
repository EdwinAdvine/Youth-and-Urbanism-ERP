import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Badge, Spinner, toast } from '../../components/ui'
import {
  useShippingMethods,
  useCreateShippingMethod,
  useUpdateShippingMethod,
  useDeleteShippingMethod,
  type ShippingMethod,
  type CreateShippingMethodPayload,
} from '../../api/ecommerce_ext'

const emptyForm: CreateShippingMethodPayload = {
  name: '',
  code: '',
  description: '',
  base_cost: 0,
  cost_per_kg: undefined,
  estimated_days_min: 1,
  estimated_days_max: 5,
  is_active: true,
}

export default function ShippingPage() {
  const { data: methods, isLoading, error } = useShippingMethods()
  const createMethod = useCreateShippingMethod()
  const updateMethod = useUpdateShippingMethod()
  const deleteMethod = useDeleteShippingMethod()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ShippingMethod | null>(null)
  const [form, setForm] = useState<CreateShippingMethodPayload>(emptyForm)

  const resetForm = () => {
    setForm(emptyForm)
    setEditing(null)
    setShowModal(false)
  }

  const handleEdit = (m: ShippingMethod) => {
    setEditing(m)
    setForm({
      name: m.name,
      code: m.code,
      description: m.description || '',
      base_cost: m.base_cost,
      cost_per_kg: m.cost_per_kg || undefined,
      estimated_days_min: m.estimated_days_min,
      estimated_days_max: m.estimated_days_max,
      is_active: m.is_active,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateMethod.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Shipping method updated')
      } else {
        await createMethod.mutateAsync(form)
        toast('success', 'Shipping method created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save shipping method')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shipping method?')) return
    try {
      await deleteMethod.mutateAsync(id)
      toast('success', 'Shipping method deleted')
    } catch {
      toast('error', 'Failed to delete shipping method')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load shipping methods</div>

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (r: ShippingMethod) => <span className="font-medium text-gray-900">{r.name}</span>,
    },
    {
      key: 'code',
      label: 'Code',
      render: (r: ShippingMethod) => <span className="font-mono text-sm text-gray-500">{r.code}</span>,
    },
    {
      key: 'base_cost',
      label: 'Base Cost',
      render: (r: ShippingMethod) => <span className="text-sm">${r.base_cost.toFixed(2)}</span>,
    },
    {
      key: 'cost_per_kg',
      label: 'Per kg',
      render: (r: ShippingMethod) => (
        <span className="text-sm text-gray-500">
          {r.cost_per_kg ? `$${r.cost_per_kg.toFixed(2)}` : '-'}
        </span>
      ),
    },
    {
      key: 'delivery',
      label: 'Delivery',
      render: (r: ShippingMethod) => (
        <span className="text-sm text-gray-600">{r.estimated_days_min}-{r.estimated_days_max} days</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (r: ShippingMethod) => (
        <Badge variant={r.is_active ? 'success' : 'default'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: ShippingMethod) => (
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
          <h1 className="text-2xl font-bold text-gray-900">Shipping Methods</h1>
          <p className="text-sm text-gray-500 mt-1">Configure available shipping options</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>Add Shipping Method</Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={methods ?? []}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No shipping methods configured"
        />
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Shipping Method' : 'Add Shipping Method'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="e.g. standard_shipping" />
          </div>
          <Input label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Base Cost" type="number" step="0.01" min="0" value={form.base_cost} onChange={(e) => setForm({ ...form, base_cost: parseFloat(e.target.value) || 0 })} required />
            <Input label="Cost per kg" type="number" step="0.01" min="0" value={form.cost_per_kg ?? ''} onChange={(e) => setForm({ ...form, cost_per_kg: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Delivery Days" type="number" min="0" value={form.estimated_days_min} onChange={(e) => setForm({ ...form, estimated_days_min: parseInt(e.target.value) || 0 })} required />
            <Input label="Max Delivery Days" type="number" min="0" value={form.estimated_days_max} onChange={(e) => setForm({ ...form, estimated_days_max: parseInt(e.target.value) || 0 })} required />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="shipping-active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            <label htmlFor="shipping-active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createMethod.isPending || updateMethod.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
