import { useState } from 'react'
import { cn, Button, Badge, Card, Table, Input, Select, Modal, Pagination } from '../../components/ui'
import { toast } from '../../components/ui'
import apiClient from '../../api/client'
import {
  useInventoryItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useStockLevels,
  type InventoryItem,
  type CreateItemPayload,
} from '../../api/inventory'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

const UOM_OPTIONS = [
  { value: 'unit', label: 'Unit' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'l', label: 'Litre (l)' },
  { value: 'm', label: 'Metre (m)' },
  { value: 'box', label: 'Box' },
  { value: 'pair', label: 'Pair' },
]

interface ItemFormState {
  sku: string
  name: string
  description: string
  category: string
  unit_of_measure: string
  cost_price: string
  selling_price: string
  reorder_level: string
}

const defaultForm: ItemFormState = {
  sku: '',
  name: '',
  description: '',
  category: '',
  unit_of_measure: 'unit',
  cost_price: '0',
  selling_price: '0',
  reorder_level: '0',
}

async function handleExport(endpoint: string, filename: string) {
  try {
    const response = await apiClient.get(endpoint, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    toast('error', 'Export failed')
  }
}

export default function ItemsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<ItemFormState>(defaultForm)

  const limit = 10
  const skip = (page - 1) * limit

  const { data, isLoading } = useInventoryItems({
    search: search || undefined,
    category: categoryFilter || undefined,
    skip,
    limit,
  })
  const { data: stockLevels } = useStockLevels()

  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  function getStockOnHand(itemId: string): number | null {
    if (!stockLevels) return null
    const levels = stockLevels.filter((sl) => sl.item_id === itemId)
    if (levels.length === 0) return null
    return levels.reduce((sum, sl) => sum + sl.quantity_on_hand, 0)
  }

  function openCreate() {
    setEditingItem(null)
    setForm(defaultForm)
    setModalOpen(true)
  }

  function openEdit(item: InventoryItem) {
    setEditingItem(item)
    setForm({
      sku: item.sku,
      name: item.name,
      description: item.description ?? '',
      category: item.category ?? '',
      unit_of_measure: item.unit_of_measure,
      cost_price: String(item.cost_price),
      selling_price: String(item.selling_price),
      reorder_level: String(item.reorder_level),
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast('warning', 'Item name is required')
      return
    }
    if (Number(form.cost_price) < 0 || Number(form.selling_price) < 0) {
      toast('warning', 'Prices must be non-negative')
      return
    }

    const payload: CreateItemPayload = {
      sku: form.sku.trim() || undefined,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      unit_of_measure: form.unit_of_measure,
      cost_price: Number(form.cost_price),
      selling_price: Number(form.selling_price),
      reorder_level: Number(form.reorder_level),
    }

    try {
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, ...payload })
        toast('success', 'Item updated')
      } else {
        await createItem.mutateAsync(payload)
        toast('success', 'Item created')
      }
      closeModal()
    } catch {
      toast('error', editingItem ? 'Failed to update item' : 'Failed to create item')
    }
  }

  async function handleDelete(item: InventoryItem) {
    try {
      await deleteItem.mutateAsync(item.id)
      toast('success', 'Item deleted')
      setConfirmDelete(null)
    } catch {
      toast('error', 'Failed to delete item')
    }
  }

  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Name', render: (row: InventoryItem) => <span className="font-medium text-gray-900">{row.name}</span> },
    { key: 'category', label: 'Category', render: (row: InventoryItem) => row.category ?? <span className="text-gray-400">—</span> },
    { key: 'unit_of_measure', label: 'UOM' },
    { key: 'cost_price', label: 'Cost', render: (row: InventoryItem) => formatCurrency(row.cost_price) },
    { key: 'selling_price', label: 'Sell Price', render: (row: InventoryItem) => formatCurrency(row.selling_price) },
    { key: 'reorder_level', label: 'Reorder Lvl' },
    {
      key: 'stock',
      label: 'Stock',
      render: (row: InventoryItem) => {
        const stock = getStockOnHand(row.id)
        if (stock === null) return <span className="text-gray-400">—</span>
        return (
          <span className={cn('font-medium', stock <= row.reorder_level ? 'text-red-600' : 'text-gray-900')}>
            {stock}
          </span>
        )
      },
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: InventoryItem) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: InventoryItem) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(row)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Items</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your product catalog and stock items</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('/inventory/items/export', 'inventory_items.csv')}>
            Export CSV
          </Button>
          <Button onClick={openCreate}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-64">
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <div className="w-44">
          <Input
            placeholder="Category filter"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
          />
        </div>
        <span className="text-sm text-gray-500">{data?.total ?? 0} items</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<InventoryItem>
          columns={columns}
          data={data?.items ?? []}
          loading={isLoading}
          emptyText="No inventory items found"
          keyExtractor={(row) => row.id}
        />
        <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingItem ? 'Edit Item' : 'New Item'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="Auto-generated if empty"
            />
            <Input
              label="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Item name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Electronics, Raw Material"
            />
            <Select
              label="Unit of Measure"
              options={UOM_OPTIONS}
              value={form.unit_of_measure}
              onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Cost Price *"
              type="number"
              min="0"
              step="0.01"
              value={form.cost_price}
              onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
            />
            <Input
              label="Selling Price *"
              type="number"
              min="0"
              step="0.01"
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
            />
            <Input
              label="Reorder Level"
              type="number"
              min="0"
              value={form.reorder_level}
              onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={closeModal}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              loading={createItem.isPending || updateItem.isPending}
            >
              {editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Item"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold">{confirmDelete?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleteItem.isPending}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
