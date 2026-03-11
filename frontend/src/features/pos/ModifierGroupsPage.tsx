import { useState } from 'react'
import { Button, Card, Badge, Spinner, Modal, Input, Select, Table, toast } from '../../components/ui'
import {
  useModifierGroups,
  useCreateModifierGroup,
  useUpdateModifierGroup,
  useDeleteModifierGroup,
  type ModifierGroupData,
  type ModifierGroupPayload,
  type ModifierPayload,
} from '../../api/pos-bundles'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModifierRow {
  name: string
  price_adjustment: number
  is_active: boolean
}

const EMPTY_MODIFIER: ModifierRow = { name: '', price_adjustment: 0, is_active: true }

const SELECTION_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'multi', label: 'Multi' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function ModifierGroupsPage() {
  const { data: groups, isLoading } = useModifierGroups()
  const createGroup = useCreateModifierGroup()
  const updateGroup = useUpdateModifierGroup()
  const deleteGroup = useDeleteModifierGroup()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ModifierGroupData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ModifierGroupData | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [selectionType, setSelectionType] = useState('single')
  const [isRequired, setIsRequired] = useState(false)
  const [minSelections, setMinSelections] = useState(0)
  const [maxSelections, setMaxSelections] = useState(1)
  const [modifiers, setModifiers] = useState<ModifierRow[]>([{ ...EMPTY_MODIFIER }])

  function resetForm() {
    setName('')
    setSelectionType('single')
    setIsRequired(false)
    setMinSelections(0)
    setMaxSelections(1)
    setModifiers([{ ...EMPTY_MODIFIER }])
    setEditing(null)
  }

  function openCreate() {
    resetForm()
    setModalOpen(true)
  }

  function openEdit(group: ModifierGroupData) {
    setEditing(group)
    setName(group.name)
    setSelectionType(group.selection_type)
    setIsRequired(group.is_required)
    setMinSelections(group.min_selections)
    setMaxSelections(group.max_selections)
    setModifiers(
      group.modifiers.length > 0
        ? group.modifiers.map((m) => ({
            name: m.name,
            price_adjustment: parseFloat(m.price_adjustment) || 0,
            is_active: m.is_active,
          }))
        : [{ ...EMPTY_MODIFIER }]
    )
    setModalOpen(true)
  }

  function addModifierRow() {
    setModifiers((prev) => [...prev, { ...EMPTY_MODIFIER }])
  }

  function removeModifierRow(idx: number) {
    setModifiers((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateModifierRow(idx: number, field: keyof ModifierRow, value: string | number | boolean) {
    setModifiers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    )
  }

  async function handleSave() {
    if (!name.trim()) {
      toast('warning', 'Group name is required')
      return
    }

    const validModifiers: ModifierPayload[] = modifiers
      .filter((m) => m.name.trim())
      .map((m) => ({
        name: m.name.trim(),
        price_adjustment: m.price_adjustment,
        is_active: m.is_active,
      }))

    const payload: ModifierGroupPayload = {
      name: name.trim(),
      selection_type: selectionType,
      is_required: isRequired,
      min_selections: minSelections,
      max_selections: maxSelections,
      modifiers: validModifiers,
    }

    try {
      if (editing) {
        await updateGroup.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Modifier group updated')
      } else {
        await createGroup.mutateAsync(payload)
        toast('success', 'Modifier group created')
      }
      setModalOpen(false)
      resetForm()
    } catch {
      toast('error', 'Failed to save modifier group')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteGroup.mutateAsync(deleteTarget.id)
      toast('success', 'Modifier group deleted')
      setDeleteTarget(null)
    } catch {
      toast('error', 'Failed to delete modifier group')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Group Name',
      render: (g: ModifierGroupData) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{g.name}</span>
      ),
    },
    {
      key: 'selection_type',
      label: 'Selection',
      render: (g: ModifierGroupData) => (
        <Badge variant="primary">{g.selection_type}</Badge>
      ),
    },
    {
      key: 'is_required',
      label: 'Required',
      render: (g: ModifierGroupData) => (
        <Badge variant={g.is_required ? 'warning' : 'default'}>
          {g.is_required ? 'Required' : 'Optional'}
        </Badge>
      ),
    },
    {
      key: 'modifiers',
      label: 'Modifiers',
      render: (g: ModifierGroupData) => (
        <div className="flex flex-wrap gap-1">
          {g.modifiers.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300"
            >
              {m.name}
              {parseFloat(m.price_adjustment) !== 0 && (
                <span className="text-primary font-medium">
                  {parseFloat(m.price_adjustment) > 0 ? '+' : ''}
                  {parseFloat(m.price_adjustment).toFixed(2)}
                </span>
              )}
            </span>
          ))}
          {g.modifiers.length === 0 && (
            <span className="text-xs text-gray-400">No modifiers</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (g: ModifierGroupData) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(g)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Modifier Groups</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage product modifier groups like Size, Add-ons, and Toppings.
          </p>
        </div>
        <Button onClick={openCreate}>New Modifier Group</Button>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table
          columns={columns}
          data={groups ?? []}
          keyExtractor={(g) => g.id}
          emptyText="No modifier groups yet. Create one to get started."
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm() }}
        title={editing ? 'Edit Modifier Group' : 'New Modifier Group'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Group Name"
            placeholder="e.g. Size, Toppings, Add-ons"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Selection Type"
              value={selectionType}
              onChange={(e) => setSelectionType(e.target.value)}
              options={SELECTION_OPTIONS}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Required?</label>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Customer must choose</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Selections"
              type="number"
              value={String(minSelections)}
              onChange={(e) => setMinSelections(parseInt(e.target.value) || 0)}
            />
            <Input
              label="Max Selections"
              type="number"
              value={String(maxSelections)}
              onChange={(e) => setMaxSelections(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Modifier rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Modifiers</label>
              <Button size="sm" variant="ghost" onClick={addModifierRow}>+ Add Modifier</Button>
            </div>
            {modifiers.map((mod, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
                    placeholder="Modifier name"
                    value={mod.name}
                    onChange={(e) => updateModifierRow(idx, 'name', e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <input
                    className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
                    placeholder="Price adj."
                    type="number"
                    step="0.01"
                    value={mod.price_adjustment || ''}
                    onChange={(e) => updateModifierRow(idx, 'price_adjustment', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={modifiers.length <= 1}
                  onClick={() => removeModifierRow(idx)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setModalOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={createGroup.isPending || updateGroup.isPending}
            >
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Modifier Group"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also remove all
            modifiers in this group. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteGroup.isPending}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
