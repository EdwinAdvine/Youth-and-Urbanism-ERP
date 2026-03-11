import { useState } from 'react'
import { Button, Input, Spinner } from '@/components/ui'
import {
  useHandbookCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/api/handbook'
import BreadcrumbNav from './components/BreadcrumbNav'
import type { HandbookCategory } from '@/api/handbook'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

interface CategoryFormData {
  name: string
  slug: string
  description: string
  icon: string
  module: string
}

const EMPTY_FORM: CategoryFormData = { name: '', slug: '', description: '', icon: '', module: '' }

export default function CategoryManager() {
  const { data: categories, isLoading } = useHandbookCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryFormData>(EMPTY_FORM)
  const [showNew, setShowNew] = useState(false)

  const handleCreate = async () => {
    await createCategory.mutateAsync({
      name: form.name,
      slug: form.slug || slugify(form.name),
      description: form.description || undefined,
      icon: form.icon || undefined,
      module: form.module || undefined,
    })
    setForm(EMPTY_FORM)
    setShowNew(false)
  }

  const handleEdit = (cat: HandbookCategory) => {
    setEditing(cat.id)
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      icon: cat.icon || '',
      module: cat.module || '',
    })
  }

  const handleUpdate = async () => {
    if (!editing) return
    await updateCategory.mutateAsync({
      id: editing,
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
      icon: form.icon || undefined,
      module: form.module || undefined,
    })
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category and all its articles?')) return
    await deleteCategory.mutateAsync(id)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <BreadcrumbNav articleTitle="Manage Categories" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Categories</h1>
        <Button size="sm" onClick={() => { setShowNew(true); setEditing(null); setForm(EMPTY_FORM) }}>
          New Category
        </Button>
      </div>

      {/* New / Edit form */}
      {(showNew || editing) && (
        <div className="rounded-[10px] border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {editing ? 'Edit Category' : 'New Category'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editing ? f.slug : slugify(e.target.value) }))}
              placeholder="Finance"
            />
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="finance"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Icon (emoji)"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="e.g. icon emoji"
            />
            <Input
              label="Module"
              value={form.module}
              onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}
              placeholder="finance, hr, crm..."
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm resize-none"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={editing ? handleUpdate : handleCreate}
              loading={createCategory.isPending || updateCategory.isPending}
            >
              {editing ? 'Update' : 'Create'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setShowNew(false); setForm(EMPTY_FORM) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="space-y-2">
        {categories && categories.length > 0 ? (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between p-4 rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800"
            >
              <div>
                <div className="flex items-center gap-2">
                  {cat.icon && <span>{cat.icon}</span>}
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cat.name}</span>
                  <span className="text-[10px] text-gray-400">/{cat.slug}</span>
                  {cat.module && (
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-gray-500">
                      {cat.module}
                    </span>
                  )}
                </div>
                {cat.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(cat)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => handleDelete(cat.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No categories yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
