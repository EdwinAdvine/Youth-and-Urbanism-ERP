import { useState } from 'react'
import { Button, Spinner, Badge, Card, Table } from '../../components/ui'
import {
  useEcomStores,
  useCreateStore,
  useUpdateStore,
  type EcomStore,
  type CreateStorePayload,
} from '../../api/ecommerce'

export default function StoresPage() {
  const { data: stores, isLoading } = useEcomStores()
  const createStore = useCreateStore()
  const updateStore = useUpdateStore()

  const [showForm, setShowForm] = useState(false)
  const [editingStore, setEditingStore] = useState<EcomStore | null>(null)
  const [form, setForm] = useState<CreateStorePayload>({
    name: '',
    slug: '',
    currency: 'KES',
    is_active: true,
  })

  const resetForm = () => {
    setForm({ name: '', slug: '', currency: 'KES', is_active: true })
    setEditingStore(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingStore) {
      await updateStore.mutateAsync({ id: editingStore.id, ...form })
    } else {
      await createStore.mutateAsync(form)
    }
    resetForm()
  }

  const handleEdit = (store: EcomStore) => {
    setEditingStore(store)
    setForm({
      name: store.name,
      slug: store.slug,
      currency: store.currency,
      is_active: store.is_active,
    })
    setShowForm(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: EcomStore) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'slug',
      label: 'Slug',
      render: (row: EcomStore) => <span className="text-gray-500 text-sm">{row.slug}</span>,
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (row: EcomStore) => <Badge variant="primary">{row.currency}</Badge>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: EcomStore) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: EcomStore) => (
        <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Stores</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your e-commerce storefronts</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true) }} className="w-full sm:w-auto">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Store
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editingStore ? 'Edit Store' : 'Create Store'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="KES">KES - Kenyan Shilling</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded"
                />
                Active
              </label>
            </div>
            <div className="md:col-span-2 flex gap-2 justify-end">
              <Button variant="ghost" type="button" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" loading={createStore.isPending || updateStore.isPending}>
                {editingStore ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Stores List */}
      <Card padding={false}>
        <Table<EcomStore>
          columns={columns}
          data={stores ?? []}
          loading={false}
          emptyText="No stores yet. Create your first store."
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  )
}
