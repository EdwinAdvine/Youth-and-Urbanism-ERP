import { useState } from 'react'
import {
  useCustomObjects,
  useCreateCustomObject,
  useUpdateCustomObject,
  useDeleteCustomObject,
  type CustomObjectDefinition,
  type CustomObjectField,
} from '@/api/crm_custom_objects'
import { Button, Badge, Card, Spinner, Modal, Input, Select, toast } from '@/components/ui'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
]

interface FormState {
  name: string
  label: string
  plural_label: string
  description: string
  icon: string
  is_active: boolean
  fields: CustomObjectField[]
}

const emptyForm: FormState = {
  name: '',
  label: '',
  plural_label: '',
  description: '',
  icon: '',
  is_active: true,
  fields: [],
}

const emptyField: CustomObjectField = {
  name: '',
  label: '',
  type: 'text',
  required: false,
  options: [],
}

export default function CustomObjectListPage() {
  const { data: objectsData, isLoading } = useCustomObjects()
  const createObject = useCreateCustomObject()
  const updateObject = useUpdateCustomObject()
  const deleteObject = useDeleteCustomObject()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const objects: CustomObjectDefinition[] = objectsData?.items ?? objectsData ?? []

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(obj: CustomObjectDefinition) {
    setEditingId(obj.id)
    setForm({
      name: obj.name,
      label: obj.label,
      plural_label: obj.plural_label,
      description: obj.description ?? '',
      icon: obj.icon ?? '',
      is_active: obj.is_active,
      fields: obj.fields ?? [],
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.label.trim()) {
      toast('error', 'Name and label are required')
      return
    }

    const payload = {
      name: form.name,
      label: form.label,
      plural_label: form.plural_label || form.label + 's',
      description: form.description || null,
      icon: form.icon || null,
      is_active: form.is_active,
      fields: form.fields,
    }

    try {
      if (editingId) {
        await updateObject.mutateAsync({ id: editingId, ...payload })
        toast('success', 'Custom object updated')
      } else {
        await createObject.mutateAsync(payload)
        toast('success', 'Custom object created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save custom object')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this custom object definition? All records will also be deleted.')) return
    try {
      await deleteObject.mutateAsync(id)
      toast('success', 'Custom object deleted')
    } catch {
      toast('error', 'Failed to delete custom object')
    }
  }

  function addField() {
    setForm((f) => ({ ...f, fields: [...f.fields, { ...emptyField }] }))
  }

  function updateField(index: number, updates: Partial<CustomObjectField>) {
    setForm((f) => ({
      ...f,
      fields: f.fields.map((field, i) => (i === index ? { ...field, ...updates } : field)),
    }))
  }

  function removeField(index: number) {
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== index) }))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Custom Objects</h1>
          <p className="text-sm text-gray-500 mt-1">Define and manage custom CRM object types</p>
        </div>
        <Button onClick={openCreate}>+ New Object</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : objects.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">No custom objects defined yet.</p>
            <Button className="mt-4" onClick={openCreate}>
              Create Your First Object
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {objects.map((obj) => (
            <Card key={obj.id} className="relative group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {obj.icon && (
                    <span className="text-2xl">{obj.icon}</span>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{obj.label}</h3>
                    <p className="text-xs text-gray-500">{obj.name}</p>
                  </div>
                </div>
                <Badge variant={obj.is_active ? 'success' : 'default'}>
                  {obj.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {obj.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{obj.description}</p>
              )}

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-500">
                  {obj.fields?.length ?? 0} field{(obj.fields?.length ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" variant="ghost" onClick={() => openEdit(obj)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    (window.location.href = `/crm/custom-objects/${obj.id}/records`)
                  }
                >
                  View Records
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[#ff3a6e] hover:text-[#ff3a6e]"
                  onClick={() => handleDelete(obj.id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Custom Object' : 'Create Custom Object'}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <Input
            label="Name (machine key)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="product_feedback"
          />
          <Input
            label="Label"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Product Feedback"
          />
          <Input
            label="Plural Label"
            value={form.plural_label}
            onChange={(e) => setForm((f) => ({ ...f, plural_label: e.target.value }))}
            placeholder="Product Feedbacks"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Track customer product feedback"
          />
          <Input
            label="Icon (emoji or text)"
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            placeholder="e.g. box, star"
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
              Active
            </label>
          </div>

          {/* Manage Fields */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fields</h4>
              <Button size="sm" variant="ghost" onClick={addField}>
                + Add Field
              </Button>
            </div>
            {form.fields.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-3">No fields added yet.</p>
            )}
            <div className="space-y-3">
              {form.fields.map((field, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 dark:border-gray-700 rounded-[10px] p-3 space-y-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Name"
                      value={field.name}
                      onChange={(e) => updateField(idx, { name: e.target.value })}
                      placeholder="field_name"
                    />
                    <Input
                      label="Label"
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      placeholder="Field Label"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label="Type"
                      value={field.type}
                      onChange={(e) => updateField(idx, { type: e.target.value })}
                      options={FIELD_TYPES}
                    />
                    <div className="flex items-end gap-2 pb-1">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={field.required ?? false}
                          onChange={(e) => updateField(idx, { required: e.target.checked })}
                          className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
                        />
                        Required
                      </label>
                    </div>
                  </div>
                  {field.type === 'select' && (
                    <Input
                      label="Options (comma-separated)"
                      value={(field.options ?? []).join(', ')}
                      onChange={(e) =>
                        updateField(idx, {
                          options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                        })
                      }
                      placeholder="option1, option2, option3"
                    />
                  )}
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#ff3a6e] hover:text-[#ff3a6e]"
                      onClick={() => removeField(idx)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={createObject.isPending || updateObject.isPending}
            >
              {editingId ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
