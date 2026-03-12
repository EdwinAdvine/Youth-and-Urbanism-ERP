import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button, Card, Badge, Input, Select, Modal, Table, toast } from '../../components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BundleItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
}

interface Bundle {
  id: string
  name: string
  slug: string
  description: string
  discount_type: 'pct' | 'fixed'
  discount_value: number
  is_active: boolean
  items: BundleItem[]
  created_at: string
}

interface BundleForm {
  name: string
  slug: string
  description: string
  discount_type: 'pct' | 'fixed'
  discount_value: number
  is_active: boolean
}

// ─── API ─────────────────────────────────────────────────────────────────────

const fetchBundles = (): Promise<Bundle[]> =>
  axios.get('/api/v1/ecommerce/bundles').then((r) => r.data)

const createBundle = (data: BundleForm): Promise<Bundle> =>
  axios.post('/api/v1/ecommerce/bundles', data).then((r) => r.data)

const updateBundle = ({ id, data }: { id: string; data: Partial<BundleForm> }): Promise<Bundle> =>
  axios.patch(`/api/v1/ecommerce/bundles/${id}`, data).then((r) => r.data)

const deleteBundle = (id: string): Promise<void> =>
  axios.delete(`/api/v1/ecommerce/bundles/${id}`).then((r) => r.data)

const addBundleItem = (bundleId: string, productId: string, quantity: number): Promise<Bundle> =>
  axios.post(`/api/v1/ecommerce/bundles/${bundleId}/items`, { product_id: productId, quantity }).then((r) => r.data)

const removeBundleItem = (bundleId: string, itemId: string): Promise<void> =>
  axios.delete(`/api/v1/ecommerce/bundles/${bundleId}/items/${itemId}`).then((r) => r.data)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeBundlePrice(bundle: Bundle): number {
  const subtotal = bundle.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  if (bundle.discount_type === 'pct') return subtotal * (1 - bundle.discount_value / 100)
  return Math.max(0, subtotal - bundle.discount_value)
}

const EMPTY_FORM: BundleForm = {
  name: '',
  slug: '',
  description: '',
  discount_type: 'pct',
  discount_value: 0,
  is_active: true,
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BundlesPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Bundle | null>(null)
  const [form, setForm] = useState<BundleForm>(EMPTY_FORM)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null)
  const [newItemProductId, setNewItemProductId] = useState('')
  const [newItemQty, setNewItemQty] = useState(1)

  const { data: bundles = [], isLoading } = useQuery({ queryKey: ['bundles'], queryFn: fetchBundles })

  const saveMutation = useMutation({
    mutationFn: editing
      ? (data: BundleForm) => updateBundle({ id: editing.id, data })
      : createBundle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bundles'] })
      setDialogOpen(false)
      toast('success', editing ? 'Bundle updated.' : 'Bundle created.')
    },
    onError: () => toast('error', 'Failed to save bundle.'),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateBundle({ id, data: { is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bundles'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBundle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bundles'] })
      setDeleteTarget(null)
      toast('success', 'Bundle deleted.')
    },
  })

  const addItemMutation = useMutation({
    mutationFn: ({ bundleId }: { bundleId: string }) =>
      addBundleItem(bundleId, newItemProductId, newItemQty),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bundles'] })
      setNewItemProductId('')
      setNewItemQty(1)
      toast('success', 'Item added to bundle.')
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: ({ bundleId, itemId }: { bundleId: string; itemId: string }) =>
      removeBundleItem(bundleId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bundles'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(b: Bundle) {
    setEditing(b)
    setForm({ name: b.name, slug: b.slug, description: b.description, discount_type: b.discount_type, discount_value: b.discount_value, is_active: b.is_active })
    setDialogOpen(true)
  }

  function slugify(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Bundles</h1>
          <p className="text-sm text-gray-500 mt-1">Group products with discounts to drive higher order value</p>
        </div>
        <Button onClick={openCreate}>+ New Bundle</Button>
      </div>

      <Card padding={false}>
        <Table<Bundle>
          loading={isLoading}
          keyExtractor={(b) => b.id}
          emptyText="No bundles yet. Create your first bundle."
          data={bundles}
          columns={[
            { key: 'name', label: 'Bundle', render: (b) => (
              <div>
                <p className="font-medium text-gray-900">{b.name}</p>
                <p className="text-xs text-gray-400">{b.slug}</p>
              </div>
            )},
            { key: 'items', label: 'Items', render: (b) => (
              <span className="text-sm text-gray-600">{b.items.length} product{b.items.length !== 1 ? 's' : ''}</span>
            )},
            { key: 'discount', label: 'Discount', render: (b) => (
              <Badge variant="info">
                {b.discount_type === 'pct' ? `${b.discount_value}% off` : `$${b.discount_value} off`}
              </Badge>
            )},
            { key: 'bundle_price', label: 'Bundle Price', render: (b) => (
              <span className="text-sm font-semibold text-gray-900">${computeBundlePrice(b).toFixed(2)}</span>
            )},
            { key: 'is_active', label: 'Active', render: (b) => (
              <button
                onClick={() => toggleActive.mutate({ id: b.id, is_active: !b.is_active })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${b.is_active ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${b.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            )},
            { key: 'actions', label: '', render: (b) => (
              <div className="flex items-center gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>
                  {expandedId === b.id ? 'Collapse' : 'Items'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(b)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteTarget(b)}>Delete</Button>
              </div>
            )},
          ]}
        />
        {bundles.map((b) =>
          expandedId === b.id ? (
            <div key={`exp-${b.id}`} className="border-t border-gray-100 px-6 py-4 bg-gray-50 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bundle Items</p>
              {b.items.length === 0 && <p className="text-sm text-gray-400">No items yet.</p>}
              {b.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-[10px] px-4 py-2">
                  <span className="text-sm text-gray-800">{item.product_name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                    <span className="text-xs text-gray-500">${item.unit_price.toFixed(2)} each</span>
                    <Button size="sm" variant="danger" onClick={() => removeItemMutation.mutate({ bundleId: b.id, itemId: item.id })}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-end gap-3 pt-2">
                <Input label="Product ID" value={newItemProductId} onChange={(e) => setNewItemProductId(e.target.value)} className="w-48" />
                <Input label="Qty" type="number" min={1} value={newItemQty} onChange={(e) => setNewItemQty(Number(e.target.value))} className="w-20" />
                <Button size="sm" loading={addItemMutation.isPending} onClick={() => addItemMutation.mutate({ bundleId: b.id })}>
                  Add Item
                </Button>
              </div>
            </div>
          ) : null
        )}
      </Card>

      {/* Create / Edit Dialog */}
      <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Bundle' : 'New Bundle'} size="md">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })} />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Discount Type" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'pct' | 'fixed' })}
              options={[{ value: 'pct', label: 'Percentage (%)' }, { value: 'fixed', label: 'Fixed Amount ($)' }]}
            />
            <Input label="Discount Value" type="number" min={0} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
              {editing ? 'Save Changes' : 'Create Bundle'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Bundle" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
