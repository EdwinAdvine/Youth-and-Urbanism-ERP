import { useState } from 'react'
import { cn, Button, Card, Input, Modal, Badge } from '../../components/ui'
import { toast } from '../../components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  description: string
  sort_order: number
  is_active: boolean
  children: Category[]
}

// ─── Local storage for categories (until backend supports dedicated endpoint) ─

function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem('ecom_categories')
    return raw ? JSON.parse(raw) : defaultCategories()
  } catch {
    return defaultCategories()
  }
}

function saveCategories(categories: Category[]) {
  localStorage.setItem('ecom_categories', JSON.stringify(categories))
}

function defaultCategories(): Category[] {
  return [
    {
      id: 'cat-1',
      name: 'Electronics',
      slug: 'electronics',
      parent_id: null,
      description: 'Electronic devices and accessories',
      sort_order: 0,
      is_active: true,
      children: [
        {
          id: 'cat-1-1',
          name: 'Smartphones',
          slug: 'smartphones',
          parent_id: 'cat-1',
          description: '',
          sort_order: 0,
          is_active: true,
          children: [],
        },
        {
          id: 'cat-1-2',
          name: 'Laptops',
          slug: 'laptops',
          parent_id: 'cat-1',
          description: '',
          sort_order: 1,
          is_active: true,
          children: [],
        },
      ],
    },
    {
      id: 'cat-2',
      name: 'Clothing',
      slug: 'clothing',
      parent_id: null,
      description: 'Apparel and fashion',
      sort_order: 1,
      is_active: true,
      children: [],
    },
  ]
}

function generateId() {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CategoryManagerPage() {
  const [categories, setCategories] = useState<Category[]>(() => loadCategories())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editModal, setEditModal] = useState<{ category: Category | null; parentId: string | null; isNew: boolean } | null>(null)
  const [dragItem, setDragItem] = useState<{ id: string; parentId: string | null } | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formActive, setFormActive] = useState(true)

  function persist(updated: Category[]) {
    setCategories(updated)
    saveCategories(updated)
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedIds(next)
  }

  function openAddModal(parentId: string | null) {
    setFormName('')
    setFormSlug('')
    setFormDescription('')
    setFormActive(true)
    setEditModal({ category: null, parentId, isNew: true })
  }

  function openEditModal(category: Category) {
    setFormName(category.name)
    setFormSlug(category.slug)
    setFormDescription(category.description)
    setFormActive(category.is_active)
    setEditModal({ category, parentId: category.parent_id, isNew: false })
  }

  function handleSave() {
    if (!formName.trim()) {
      toast('warning', 'Category name is required')
      return
    }
    const slug = formSlug.trim() || slugify(formName)

    if (editModal?.isNew) {
      // Add new
      const newCat: Category = {
        id: generateId(),
        name: formName.trim(),
        slug,
        parent_id: editModal.parentId,
        description: formDescription,
        sort_order: 999,
        is_active: formActive,
        children: [],
      }
      const updated = addCategoryToTree([...categories], newCat, editModal.parentId)
      persist(updated)
      toast('success', 'Category added')
      // Auto-expand parent
      if (editModal.parentId) {
        setExpandedIds((prev) => new Set([...prev, editModal.parentId!]))
      }
    } else if (editModal?.category) {
      // Update existing
      const updated = updateCategoryInTree([...categories], editModal.category.id, {
        name: formName.trim(),
        slug,
        description: formDescription,
        is_active: formActive,
      })
      persist(updated)
      toast('success', 'Category updated')
    }
    setEditModal(null)
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this category and all its children?')) return
    const updated = removeCategoryFromTree([...categories], id)
    persist(updated)
    toast('success', 'Category deleted')
  }

  // Drag and drop for reordering
  function handleDragStart(id: string, parentId: string | null) {
    setDragItem({ id, parentId })
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    setDragOverId(targetId)
  }

  function handleDrop(e: React.DragEvent, targetId: string, targetParentId: string | null) {
    e.preventDefault()
    setDragOverId(null)
    if (!dragItem || dragItem.id === targetId) return

    // Move dragItem next to targetId under targetParentId
    const catToMove = findCategory(categories, dragItem.id)
    if (!catToMove) return

    let updated = removeCategoryFromTree([...categories], dragItem.id)
    catToMove.parent_id = targetParentId
    updated = insertCategoryAfter(updated, catToMove, targetId, targetParentId)
    persist(updated)
    setDragItem(null)
  }

  const totalCount = countCategories(categories)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Categories</h1>
          <p className="text-sm text-gray-500 mt-1">{totalCount} categories total</p>
        </div>
        <Button onClick={() => openAddModal(null)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Root Category
        </Button>
      </div>

      {/* Tree View */}
      <Card>
        {categories.length > 0 ? (
          <div className="space-y-0.5">
            {categories.map((cat) => (
              <CategoryNode
                key={cat.id}
                category={cat}
                depth={0}
                expandedIds={expandedIds}
                dragOverId={dragOverId}
                onToggleExpand={toggleExpand}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onAddChild={openAddModal}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">No categories yet. Create one to get started.</p>
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={editModal !== null}
        onClose={() => setEditModal(null)}
        title={editModal?.isNew ? 'Add Category' : 'Edit Category'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            value={formName}
            onChange={(e) => {
              setFormName(e.target.value)
              if (editModal?.isNew) setFormSlug(slugify(e.target.value))
            }}
            placeholder="e.g. Electronics"
            autoFocus
          />
          <Input
            label="Slug"
            value={formSlug}
            onChange={(e) => setFormSlug(e.target.value)}
            placeholder="e.g. electronics"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional category description..."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditModal(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>
              {editModal?.isNew ? 'Create' : 'Update'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── CategoryNode ────────────────────────────────────────────────────────────

interface CategoryNodeProps {
  category: Category
  depth: number
  expandedIds: Set<string>
  dragOverId: string | null
  onToggleExpand: (id: string) => void
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string) => void
  onDragStart: (id: string, parentId: string | null) => void
  onDragOver: (e: React.DragEvent, targetId: string) => void
  onDrop: (e: React.DragEvent, targetId: string, targetParentId: string | null) => void
}

function CategoryNode({
  category,
  depth,
  expandedIds,
  dragOverId,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddChild,
  onDragStart,
  onDragOver,
  onDrop,
}: CategoryNodeProps) {
  const isExpanded = expandedIds.has(category.id)
  const hasChildren = category.children.length > 0
  const isDragOver = dragOverId === category.id

  return (
    <div>
      <div
        draggable
        onDragStart={() => onDragStart(category.id, category.parent_id)}
        onDragOver={(e) => onDragOver(e, category.id)}
        onDrop={(e) => onDrop(e, category.id, category.parent_id)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-[10px] hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing group',
          isDragOver && 'ring-2 ring-primary/40 bg-primary/5'
        )}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            onClick={() => onToggleExpand(category.id)}
            className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Folder icon */}
        <svg
          className={cn('h-4 w-4 shrink-0', category.is_active ? 'text-primary' : 'text-gray-300')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>

        {/* Name */}
        <span className={cn('text-sm font-medium flex-1', category.is_active ? 'text-gray-900' : 'text-gray-400')}>
          {category.name}
        </span>

        {/* Slug */}
        <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">{category.slug}</span>

        {!category.is_active && <Badge variant="default" className="text-[9px]">Inactive</Badge>}

        {hasChildren && (
          <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
            {category.children.length}
          </span>
        )}

        {/* Actions (show on hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
          <button
            onClick={() => onAddChild(category.id)}
            className="p-1 text-gray-400 hover:text-primary transition-colors"
            title="Add child category"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(category)}
            className="p-1 text-gray-400 hover:text-primary transition-colors"
            title="Edit"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {category.children.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              dragOverId={dragOverId}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tree helpers ────────────────────────────────────────────────────────────

function countCategories(cats: Category[]): number {
  return cats.reduce((sum, c) => sum + 1 + countCategories(c.children), 0)
}

function findCategory(cats: Category[], id: string): Category | null {
  for (const c of cats) {
    if (c.id === id) return { ...c, children: [...c.children] }
    const found = findCategory(c.children, id)
    if (found) return found
  }
  return null
}

function addCategoryToTree(cats: Category[], newCat: Category, parentId: string | null): Category[] {
  if (!parentId) {
    return [...cats, newCat]
  }
  return cats.map((c) => {
    if (c.id === parentId) {
      return { ...c, children: [...c.children, newCat] }
    }
    return { ...c, children: addCategoryToTree(c.children, newCat, parentId) }
  })
}

function updateCategoryInTree(cats: Category[], id: string, updates: Partial<Category>): Category[] {
  return cats.map((c) => {
    if (c.id === id) {
      return { ...c, ...updates }
    }
    return { ...c, children: updateCategoryInTree(c.children, id, updates) }
  })
}

function removeCategoryFromTree(cats: Category[], id: string): Category[] {
  return cats
    .filter((c) => c.id !== id)
    .map((c) => ({ ...c, children: removeCategoryFromTree(c.children, id) }))
}

function insertCategoryAfter(cats: Category[], catToInsert: Category, afterId: string, parentId: string | null): Category[] {
  if (!parentId) {
    const idx = cats.findIndex((c) => c.id === afterId)
    if (idx === -1) return [...cats, catToInsert]
    const result = [...cats]
    result.splice(idx + 1, 0, catToInsert)
    return result
  }
  return cats.map((c) => {
    if (c.id === parentId) {
      const idx = c.children.findIndex((ch) => ch.id === afterId)
      const children = [...c.children]
      if (idx === -1) children.push(catToInsert)
      else children.splice(idx + 1, 0, catToInsert)
      return { ...c, children }
    }
    return { ...c, children: insertCategoryAfter(c.children, catToInsert, afterId, parentId) }
  })
}
