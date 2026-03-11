import { useState, useEffect } from 'react'
import {
  useCustomObject,
  useUpdateCustomObject,
  type CustomObjectField,
} from '@/api/crm_custom_objects'
import { Button, Card, Spinner, Input, Select, toast } from '@/components/ui'

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

function getDefinitionId(): string {
  const parts = window.location.pathname.split('/')
  const idx = parts.indexOf('custom-objects')
  return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : ''
}

export default function CustomObjectFormBuilder() {
  const definitionId = getDefinitionId()
  const { data: definition, isLoading } = useCustomObject(definitionId)
  const updateObject = useUpdateCustomObject()

  const [fields, setFields] = useState<CustomObjectField[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (definition?.fields) {
      setFields(definition.fields)
      setHasChanges(false)
    }
  }, [definition])

  function addField() {
    setFields((prev) => [
      ...prev,
      { name: '', label: '', type: 'text', required: false, options: [] },
    ])
    setHasChanges(true)
  }

  function updateField(index: number, updates: Partial<CustomObjectField>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    )
    setHasChanges(true)
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const updated = [...fields]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(index, 0, moved)
    setFields(updated)
    setDragIndex(index)
    setHasChanges(true)
  }

  function handleDragEnd() {
    setDragIndex(null)
  }

  async function handleSave() {
    // Validate all fields have name and label
    for (const f of fields) {
      if (!f.name.trim() || !f.label.trim()) {
        toast.error('All fields must have a name and label')
        return
      }
    }

    // Check for duplicate names
    const names = fields.map((f) => f.name)
    if (new Set(names).size !== names.length) {
      toast.error('Field names must be unique')
      return
    }

    try {
      await updateObject.mutateAsync({ id: definitionId, fields })
      toast.success('Fields saved successfully')
      setHasChanges(false)
    } catch {
      toast.error('Failed to save fields')
    }
  }

  if (!definitionId) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No custom object definition ID provided.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Form Builder: {definition?.label ?? 'Custom Object'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Drag fields to reorder. Configure each field's type and settings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-[#ffa21d] font-medium">Unsaved changes</span>
          )}
          <Button onClick={handleSave} loading={updateObject.isPending} disabled={!hasChanges}>
            Save Fields
          </Button>
        </div>
      </div>

      {/* Field Cards */}
      <div className="space-y-3">
        {fields.length === 0 && (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No fields yet. Add your first field to get started.</p>
              <Button onClick={addField}>+ Add Field</Button>
            </div>
          </Card>
        )}

        {fields.map((field, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`border rounded-[10px] p-4 bg-white dark:bg-gray-800 transition-all cursor-grab active:cursor-grabbing ${
              dragIndex === idx
                ? 'border-[#51459d] shadow-lg ring-2 ring-[#51459d]/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Drag handle */}
              <div className="flex flex-col items-center justify-center gap-0.5 pt-2 text-gray-400">
                <span className="block w-4 h-0.5 bg-current rounded" />
                <span className="block w-4 h-0.5 bg-current rounded" />
                <span className="block w-4 h-0.5 bg-current rounded" />
              </div>

              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Field Name"
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
                  <Select
                    label="Type"
                    value={field.type}
                    onChange={(val) => updateField(idx, { type: val })}
                    options={FIELD_TYPES}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={field.required ?? false}
                      onChange={(e) => updateField(idx, { required: e.target.checked })}
                      className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
                    />
                    Required
                  </label>

                  {field.type === 'select' && (
                    <div className="flex-1">
                      <Input
                        label="Options (comma-separated)"
                        value={(field.options ?? []).join(', ')}
                        onChange={(e) =>
                          updateField(idx, {
                            options: e.target.value
                              .split(',')
                              .map((o) => o.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="option1, option2, option3"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Remove button */}
              <Button
                size="sm"
                variant="ghost"
                className="text-[#ff3a6e] hover:text-[#ff3a6e] mt-1"
                onClick={() => removeField(idx)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Field Button */}
      <div className="flex justify-center">
        <Button variant="ghost" onClick={addField} className="border border-dashed border-gray-300 dark:border-gray-600 w-full py-3">
          + Add Field
        </Button>
      </div>
    </div>
  )
}
