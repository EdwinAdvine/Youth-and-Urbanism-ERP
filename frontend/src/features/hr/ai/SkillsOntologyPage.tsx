import { useState, useMemo } from 'react'
import { Card, Badge, Button, Input, Select, Modal, Spinner } from '../../../components/ui'
import {
  useSkillOntology,
  useSkillOntologyTree,
  useCreateSkillNode,
  useUpdateSkillNode,
  useDeleteSkillNode,
  type SkillNode,
  type SkillNodeCreatePayload,
  type SkillNodeUpdatePayload,
} from '@/api/hr_phase3'
import { toast } from '../../../components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#51459d', '#3ec9d6', '#6fd943', '#ffa21d', '#ff3a6e',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
]

function categoryColor(category: string, allCategories: string[]): string {
  const idx = allCategories.indexOf(category)
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] ?? '#51459d'
}

// ─── Alias Chip ────────────────────────────────────────────────────────────────

function AliasChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
      {label}
    </span>
  )
}

// ─── Inline Edit Form ─────────────────────────────────────────────────────────

interface InlineEditFormProps {
  node: SkillNode
  allCategories: string[]
  allSkills: SkillNode[]
  onSave: (data: SkillNodeUpdatePayload) => void
  onCancel: () => void
  saving: boolean
}

function InlineEditForm({ node, allCategories, allSkills, onSave, onCancel, saving }: InlineEditFormProps) {
  const [name, setName] = useState(node.name)
  const [category, setCategory] = useState(node.category ?? '')
  const [description, setDescription] = useState(node.description ?? '')
  const [aliasesStr, setAliasesStr] = useState((node.aliases ?? []).join(', '))

  function handleSave() {
    onSave({
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || undefined,
      aliases: aliasesStr
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    })
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-[10px] border border-gray-100 dark:border-gray-700 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
          <input
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            list="category-list"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="category-list">
            {allCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>
      <Input
        label="Aliases (comma-separated)"
        value={aliasesStr}
        onChange={(e) => setAliasesStr(e.target.value)}
        placeholder="e.g. JS, JavaScript, ECMAScript"
      />
      <Input
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional description"
      />
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>
      </div>
    </div>
  )
}

// ─── Skill Row ─────────────────────────────────────────────────────────────────

interface SkillRowProps {
  node: SkillNode
  allCategories: string[]
  allSkills: SkillNode[]
  onEdit: (node: SkillNode) => void
  onDelete: (node: SkillNode) => void
  editingId: string | null
  onSaveEdit: (data: SkillNodeUpdatePayload) => void
  onCancelEdit: () => void
  saving: boolean
}

function SkillRow({
  node, allCategories, allSkills,
  onEdit, onDelete, editingId,
  onSaveEdit, onCancelEdit, saving,
}: SkillRowProps) {
  const isEditing = editingId === node.id
  const childCount = (node.children ?? []).length

  return (
    <div className="py-2 px-3 rounded-[10px] hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{node.name}</span>
            {childCount > 0 && (
              <span className="text-xs text-gray-400">({childCount} sub-skills)</span>
            )}
            {(node.aliases ?? []).map((alias) => (
              <AliasChip key={alias} label={alias} />
            ))}
          </div>
          {node.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{node.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            className="p-1.5 rounded-md text-gray-400 hover:text-[#51459d] hover:bg-[#51459d]/10 transition-colors"
            title="Edit"
            onClick={() => onEdit(node)}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            className="p-1.5 rounded-md text-gray-400 hover:text-[#ff3a6e] hover:bg-[#ff3a6e]/10 transition-colors"
            title="Delete"
            onClick={() => onDelete(node)}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3m-9 0h12" />
            </svg>
          </button>
        </div>
      </div>
      {isEditing && (
        <InlineEditForm
          node={node}
          allCategories={allCategories}
          allSkills={allSkills}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          saving={saving}
        />
      )}
    </div>
  )
}

// ─── Category Section ──────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: string
  nodes: SkillNode[]
  color: string
  allCategories: string[]
  allSkills: SkillNode[]
  onEdit: (node: SkillNode) => void
  onDelete: (node: SkillNode) => void
  editingId: string | null
  onSaveEdit: (data: SkillNodeUpdatePayload) => void
  onCancelEdit: () => void
  saving: boolean
}

function CategorySection({
  category, nodes, color, allCategories, allSkills,
  onEdit, onDelete, editingId, onSaveEdit, onCancelEdit, saving,
}: CategorySectionProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <Card className="!p-0 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-semibold text-gray-900 dark:text-gray-100">{category}</span>
          <Badge variant="default">{nodes.length}</Badge>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-50 dark:border-gray-700 px-3 py-2 space-y-1">
          {nodes.map((node) => (
            <SkillRow
              key={node.id}
              node={node}
              allCategories={allCategories}
              allSkills={allSkills}
              onEdit={onEdit}
              onDelete={onDelete}
              editingId={editingId}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              saving={saving}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Add Skill Modal ───────────────────────────────────────────────────────────

interface AddSkillModalProps {
  open: boolean
  onClose: () => void
  allCategories: string[]
  allSkills: SkillNode[]
  onSave: (data: SkillNodeCreatePayload) => void
  saving: boolean
}

const EMPTY_FORM: SkillNodeCreatePayload = {
  name: '',
  category: '',
  parent_id: undefined,
  aliases: [],
  description: '',
}

function AddSkillModal({ open, onClose, allCategories, allSkills, onSave, saving }: AddSkillModalProps) {
  const [form, setForm] = useState<SkillNodeCreatePayload>(EMPTY_FORM)
  const [aliasesStr, setAliasesStr] = useState('')

  function handleSave() {
    if (!form.name.trim()) { toast('error', 'Name is required.'); return }
    if (!form.category.trim()) { toast('error', 'Category is required.'); return }
    onSave({
      ...form,
      aliases: aliasesStr.split(',').map((a) => a.trim()).filter(Boolean),
    })
    setForm(EMPTY_FORM)
    setAliasesStr('')
  }

  function handleClose() {
    setForm(EMPTY_FORM)
    setAliasesStr('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Skill" size="lg">
      <div className="space-y-4">
        <Input
          label="Skill Name *"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. TypeScript"
        />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category *</label>
          <input
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            list="add-category-list"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Select or type a new category"
          />
          <datalist id="add-category-list">
            {allCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <Select
          label="Parent Skill (optional)"
          value={form.parent_id ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value || undefined }))}
        >
          <option value="">— No parent —</option>
          {allSkills.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Input
          label="Aliases (comma-separated)"
          value={aliasesStr}
          onChange={(e) => setAliasesStr(e.target.value)}
          placeholder="e.g. TS, TypeScript 5"
        />
        <Input
          label="Description"
          value={form.description ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Optional description"
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Add Skill</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────

interface DeleteModalProps {
  node: SkillNode | null
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}

function DeleteModal({ node, onConfirm, onCancel, deleting }: DeleteModalProps) {
  return (
    <Modal open={!!node} onClose={onCancel} title="Delete Skill" size="sm">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Are you sure you want to delete <strong>{node?.name}</strong>?
        This action cannot be undone.
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" loading={deleting} onClick={onConfirm}>Delete</Button>
      </div>
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SkillsOntologyPage() {
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteNode, setDeleteNode] = useState<SkillNode | null>(null)

  const { data: allNodes, isLoading } = useSkillOntology()
  const { data: treeData } = useSkillOntologyTree()
  const createMutation = useCreateSkillNode()
  const updateMutation = useUpdateSkillNode()
  const deleteMutation = useDeleteSkillNode()

  const nodes: SkillNode[] = allNodes ?? []

  const allCategories = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.category).filter(Boolean) as string[])).sort(),
    [nodes]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return nodes
    return nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.category ?? '').toLowerCase().includes(q) ||
        (n.aliases ?? []).some((a) => a.toLowerCase().includes(q))
    )
  }, [nodes, search])

  const grouped = useMemo(() => {
    const map: Record<string, SkillNode[]> = {}
    filtered.forEach((n) => {
      const cat = n.category ?? 'Uncategorized'
      if (!map[cat]) map[cat] = []
      map[cat].push(n)
    })
    return map
  }, [filtered])

  async function handleCreate(data: SkillNodeCreatePayload) {
    await createMutation.mutateAsync(data)
    setAddOpen(false)
    toast('success', `Skill "${data.name}" added.`)
  }

  async function handleUpdate(data: SkillNodeUpdatePayload) {
    if (!editingId) return
    await updateMutation.mutateAsync({ nodeId: editingId, data })
    setEditingId(null)
    toast('success', 'Skill updated.')
  }

  async function handleDelete() {
    if (!deleteNode) return
    await deleteMutation.mutateAsync(deleteNode.id)
    setDeleteNode(null)
    toast('success', `Skill "${deleteNode.name}" deleted.`)
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Skills Ontology</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage the organization's skill taxonomy</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ Add Skill</Button>
      </div>

      {/* Search + Category Legend */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((cat) => {
            const color = categoryColor(cat, allCategories)
            const count = nodes.filter((n) => n.category === cat).length
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-600 dark:text-gray-400">{cat}</span>
                <span className="text-xs text-gray-400">({count})</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-[10px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">🧠</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">No skills in the ontology yet.</p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}>Add First Skill</Button>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-400">No skills match your search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catNodes]) => (
            <CategorySection
              key={cat}
              category={cat}
              nodes={catNodes}
              color={categoryColor(cat, allCategories)}
              allCategories={allCategories}
              allSkills={nodes}
              onEdit={(node) => setEditingId(node.id)}
              onDelete={(node) => setDeleteNode(node)}
              editingId={editingId}
              onSaveEdit={handleUpdate}
              onCancelEdit={() => setEditingId(null)}
              saving={updateMutation.isPending}
            />
          ))}
        </div>
      )}

      <AddSkillModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        allCategories={allCategories}
        allSkills={nodes}
        onSave={handleCreate}
        saving={createMutation.isPending}
      />

      <DeleteModal
        node={deleteNode}
        onConfirm={handleDelete}
        onCancel={() => setDeleteNode(null)}
        deleting={deleteMutation.isPending}
      />
    </div>
  )
}
