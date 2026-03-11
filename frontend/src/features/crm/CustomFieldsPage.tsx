import { useState } from 'react'
import {
  useCustomFields,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
  type CustomFieldDefinition,
  type CustomFieldCreatePayload,
} from '@/api/crm_v2'
import { Button, Badge, Card, Modal, Input, Select, Table, toast } from '@/components/ui'

const ENTITY_TYPES = ['contact', 'lead', 'opportunity', 'deal', 'quote']
const FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'boolean', 'url', 'email']

const EMPTY_FORM: CustomFieldCreatePayload = {
  entity_type: 'contact',
  field_name: '',
  field_label: '',
  field_type: 'text',
  is_required: false,
  default_value: null,
  sort_order: 0,
}

export default function CustomFieldsPage() {
  const [entityFilter, setEntityFilter] = useState<string | undefined>(undefined)
  const { data, isLoading } = useCustomFields(entityFilter)
  const createField = useCreateCustomField()
  const updateField = useUpdateCustomField()
  const deleteField = useDeleteCustomField()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null)
  const [form, setForm] = useState<CustomFieldCreatePayload>(EMPTY_FORM)
  const [dropdownOptions, setDropdownOptions] = useState('')

  const fields: CustomFieldDefinition[] = data?.items ?? data ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDropdownOptions('')
    setModalOpen(true)
  }

  const openEdit = (field: CustomFieldDefinition) => {
    setEditing(field)
    setForm({
      entity_type: field.entity_type,
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      is_required: field.is_required,
      default_value: field.default_value,
      sort_order: field.sort_order,
      options: field.options,
    })
    setDropdownOptions(field.options?.choices?.join(', ') ?? '')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...form }
    if (form.field_type === 'dropdown' && dropdownOptions.trim()) {
      payload.options = { choices: dropdownOptions.split(',').map((o) => o.trim()).filter(Boolean) }
    }
    try {
      if (editing) {
        await updateField.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Field updated')
      } else {
        await createField.mutateAsync(payload)
        toast('success', 'Field created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save field')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this custom field? This cannot be undone.')) return
    try {
      await deleteField.mutateAsync(id)
      toast('success', 'Field deleted')
    } catch {
      toast('error', 'Failed to delete field')
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Custom Fields
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Define custom data fields for CRM entities
          </p>
        </div>
        <Button onClick={openCreate}>+ New Field</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select
          label="Entity Type"
          value={entityFilter ?? ''}
          onChange={(e) => setEntityFilter(e.target.value || undefined)}
          options={[
            { value: '', label: 'All Entities' },
            ...ENTITY_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
          ]}
        />
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<CustomFieldDefinition>
          loading={isLoading}
          data={fields}
          keyExtractor={(f) => f.id}
          emptyText="No custom fields defined."
          columns={[
            { key: 'field_label', label: 'Label' },
            { key: 'field_name', label: 'Field Name', render: (f) => (
              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{f.field_name}</code>
            )},
            { key: 'entity_type', label: 'Entity', render: (f) => (
              <Badge variant="primary">{f.entity_type}</Badge>
            )},
            { key: 'field_type', label: 'Type', render: (f) => (
              <Badge variant="info">{f.field_type}</Badge>
            )},
            { key: 'is_required', label: 'Required', render: (f) => (
              f.is_required
                ? <Badge variant="warning">Required</Badge>
                : <span className="text-gray-400 text-xs">Optional</span>
            )},
            { key: 'sort_order', label: 'Order' },
            { key: 'actions', label: '', render: (f) => (
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => openEdit(f)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(f.id)}>Delete</Button>
              </div>
            )},
          ]}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Custom Field' : 'New Custom Field'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Entity Type"
            required
            value={form.entity_type}
            onChange={(e) => setForm((f) => ({ ...f, entity_type: e.target.value }))}
            options={ENTITY_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Field Name"
              required
              placeholder="e.g. industry"
              value={form.field_name}
              onChange={(e) => setForm((f) => ({ ...f, field_name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
            />
            <Input
              label="Field Label"
              required
              placeholder="e.g. Industry"
              value={form.field_label}
              onChange={(e) => setForm((f) => ({ ...f, field_label: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Field Type"
              required
              value={form.field_type}
              onChange={(e) => setForm((f) => ({ ...f, field_type: e.target.value }))}
              options={FIELD_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
            />
            <Input
              label="Sort Order"
              type="number"
              value={form.sort_order ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
            />
          </div>
          {form.field_type === 'dropdown' && (
            <Input
              label="Dropdown Options (comma-separated)"
              placeholder="Option A, Option B, Option C"
              value={dropdownOptions}
              onChange={(e) => setDropdownOptions(e.target.value)}
            />
          )}
          <Input
            label="Default Value"
            value={form.default_value ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, default_value: e.target.value || null }))}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.is_required ?? false}
              onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))}
              className="rounded"
            />
            Required field
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createField.isPending || updateField.isPending}>
              {editing ? 'Save Changes' : 'Create Field'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
