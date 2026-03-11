import { useState } from 'react'
import {
  useTicketCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type TicketCategory,
  type CreateCategoryPayload,
} from '../../api/support'
import { Button, Spinner, Badge, Card, Table } from '../../components/ui'

const EMPTY_FORM: CreateCategoryPayload = {
  name: '',
  slug: '',
  description: '',
  color: '#51459d',
  is_active: true,
}

export default function CategoriesPage() {
  const { data: categories, isLoading } = useTicketCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateCategoryPayload>(EMPTY_FORM)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleEdit = (cat: TicketCategory) => {
    setEditingId(cat.id)
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? '',
      color: cat.color ?? '#51459d',
      is_active: cat.is_active,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return
    try {
      await deleteCategory.mutateAsync(id)
      flash('Category deleted.')
    } catch {
      alert('Failed to delete category.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) return
    try {
      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, ...form })
        flash('Category updated.')
      } else {
        await createCategory.mutateAsync(form)
        flash('Category created.')
      }
      resetForm()
    } catch {
      alert(editingId ? 'Failed to update category.' : 'Failed to create category.')
    }
  }

  const slugify = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const columns = [
    {
      key: 'color',
      label: '',
      render: (row: TicketCategory) => (
        <div
          className="w-4 h-4 rounded-full border border-gray-200"
          style={{ backgroundColor: row.color ?? '#ccc' }}
        />
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (row: TicketCategory) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'slug',
      label: 'Slug',
      render: (row: TicketCategory) => <span className="text-gray-500 text-sm font-mono">{row.slug}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: TicketCategory) => (
        <span className="text-gray-600 text-sm truncate max-w-[200px] block">{row.description || '-'}</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: TicketCategory) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: TicketCategory) => (
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => handleEdit(row)}
            className="text-xs text-primary hover:underline font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="text-xs text-[#ff3a6e] hover:underline font-medium"
          >
            Delete
          </button>
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ticket Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Manage support ticket categories</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
        >
          Add Category
        </Button>
      </div>

      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-[10px] px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {showForm && (
        <Card className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Category' : 'New Category'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value
                  setForm((f) => ({
                    ...f,
                    name,
                    slug: editingId ? f.slug : slugify(name),
                  }))
                }}
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Category name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="category-slug"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color ?? '#51459d'}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-10 h-10 rounded-[8px] border border-gray-200 cursor-pointer"
                />
                <span className="text-sm text-gray-500 font-mono">{form.color}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-primary focus:ring-primary"
                id="cat-active"
              />
              <label htmlFor="cat-active" className="text-sm text-gray-700">Active</label>
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createCategory.isPending || updateCategory.isPending}
              >
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <Table<TicketCategory>
          columns={columns}
          data={categories ?? []}
          loading={false}
          emptyText="No categories found"
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  )
}
