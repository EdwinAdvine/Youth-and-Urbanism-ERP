import { useState } from 'react'
import { Button, Card, Badge, Input, Modal, Table, toast } from '../../components/ui'
import {
  useBundles,
  useCreateBundle,
  useUpdateBundle,
  useDeleteBundle,
  type POSBundle,
  type BundlePayload,
  type BundleItemPayload,
} from '../../api/pos-bundles'
import { usePOSProducts, type POSProduct } from '../../api/pos'

interface BundleFormState {
  name: string
  description: string
  bundle_price: string
  is_active: boolean
  items: (BundleItemPayload & { item_name?: string })[]
}

const EMPTY_FORM: BundleFormState = {
  name: '',
  description: '',
  bundle_price: '',
  is_active: true,
  items: [],
}

export default function BundlesPage() {
  const { data: bundles, isLoading } = useBundles(false)
  const createBundle = useCreateBundle()
  const updateBundle = useUpdateBundle()
  const deleteBundle = useDeleteBundle()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BundleFormState>({ ...EMPTY_FORM })
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Product search for adding items to bundle
  const [productSearch, setProductSearch] = useState('')
  const { data: productsData } = usePOSProducts({ limit: 100 })
  const filteredProducts = (productsData?.products ?? []).filter(
    (p) =>
      productSearch &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  )

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setProductSearch('')
    setModalOpen(true)
  }

  const openEdit = (bundle: POSBundle) => {
    setEditingId(bundle.id)
    setForm({
      name: bundle.name,
      description: bundle.description ?? '',
      bundle_price: bundle.bundle_price,
      is_active: bundle.is_active,
      items: bundle.items.map((i) => ({
        item_id: i.item_id,
        quantity: i.quantity,
        item_name: i.item_name,
      })),
    })
    setProductSearch('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setProductSearch('')
  }

  const addProductToBundle = (product: POSProduct) => {
    const exists = form.items.find((i) => i.item_id === product.id)
    if (exists) {
      setForm((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.item_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      }))
    } else {
      setForm((prev) => ({
        ...prev,
        items: [...prev.items, { item_id: product.id, quantity: 1, item_name: product.name }],
      }))
    }
    setProductSearch('')
  }

  const updateItemQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      setForm((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.item_id !== itemId),
      }))
    } else {
      setForm((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.item_id === itemId ? { ...i, quantity: qty } : i
        ),
      }))
    }
  }

  const removeItem = (itemId: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.item_id !== itemId),
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast('error', 'Bundle name is required')
      return
    }
    const price = parseFloat(form.bundle_price)
    if (!price || price <= 0) {
      toast('error', 'Bundle price must be greater than 0')
      return
    }
    if (form.items.length === 0) {
      toast('error', 'Add at least one item to the bundle')
      return
    }

    const payload: BundlePayload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      bundle_price: price,
      is_active: form.is_active,
      items: form.items.map(({ item_id, quantity }) => ({ item_id, quantity })),
    }

    try {
      if (editingId) {
        await updateBundle.mutateAsync({ id: editingId, ...payload })
        toast('success', 'Bundle updated')
      } else {
        await createBundle.mutateAsync(payload)
        toast('success', 'Bundle created')
      }
      closeModal()
    } catch {
      toast('error', `Failed to ${editingId ? 'update' : 'create'} bundle`)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirmId) return
    try {
      await deleteBundle.mutateAsync(deleteConfirmId)
      toast('success', 'Bundle deleted')
    } catch {
      toast('error', 'Failed to delete bundle')
    } finally {
      setDeleteConfirmId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Product Bundles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage bundled product packages
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          + Create Bundle
        </Button>
      </div>

      {/* Bundle list */}
      <Card padding={false}>
        <Table
          loading={isLoading}
          data={bundles ?? []}
          keyExtractor={(b) => b.id}
          emptyText="No bundles yet. Create your first bundle."
          columns={[
            {
              key: 'name',
              label: 'Bundle Name',
              render: (b) => (
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{b.name}</p>
                  {b.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{b.description}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'bundle_price',
              label: 'Price',
              render: (b) => (
                <span className="font-medium">${parseFloat(b.bundle_price).toFixed(2)}</span>
              ),
            },
            {
              key: 'items',
              label: 'Items',
              render: (b) => (
                <Badge variant="default">{b.items.length} item{b.items.length !== 1 ? 's' : ''}</Badge>
              ),
            },
            {
              key: 'is_active',
              label: 'Status',
              render: (b) => (
                <Badge variant={b.is_active ? 'success' : 'warning'}>
                  {b.is_active ? 'Active' : 'Inactive'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              className: 'text-right',
              render: (b) => (
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteConfirmId(b.id)}>
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Bundle' : 'Create Bundle'}
        size="xl"
      >
        <div className="space-y-4">
          <Input
            label="Bundle Name"
            placeholder="e.g. Breakfast Combo"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />

          <Input
            label="Description"
            placeholder="Optional description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Bundle Price"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.bundle_price}
              onChange={(e) => setForm((prev) => ({ ...prev, bundle_price: e.target.value }))}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </label>
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                  form.is_active
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
                onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
              >
                {form.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>

          {/* Add items */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Bundle Items
            </label>
            <Input
              placeholder="Search products to add..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />

            {filteredProducts.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                {filteredProducts.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 last:border-0"
                    onClick={() => addProductToBundle(p)}
                  >
                    <span className="text-gray-900 dark:text-gray-100">{p.name}</span>
                    <span className="text-xs text-gray-400">{p.sku} - ${parseFloat(p.selling_price).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected items */}
            {form.items.length > 0 && (
              <div className="space-y-2 mt-3">
                {form.items.map((item) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                      {item.item_name ?? item.item_id}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        className="w-7 h-7 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
                        onClick={() => updateItemQty(item.item_id, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        className="w-7 h-7 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
                        onClick={() => updateItemQty(item.item_id, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                        onClick={() => removeItem(item.item_id)}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createBundle.isPending || updateBundle.isPending}
              onClick={handleSave}
            >
              {editingId ? 'Update Bundle' : 'Create Bundle'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Bundle"
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete this bundle? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteBundle.isPending} onClick={handleDelete}>
            Delete Bundle
          </Button>
        </div>
      </Modal>
    </div>
  )
}
