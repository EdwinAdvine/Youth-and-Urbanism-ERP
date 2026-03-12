import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useCustomFields,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
  type CustomField,
  type CustomFieldType,
} from '@/api/projects_enhanced'

interface CustomFieldsManagerProps {
  projectId?: string
}

const fieldTypeLabels: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  dropdown: 'Dropdown',
  date: 'Date',
  formula: 'Formula',
}

export default function CustomFieldsManager({ projectId: propProjectId }: CustomFieldsManagerProps) {
  const { id: routeId } = useParams<{ id: string }>()
  const projectId = propProjectId ?? routeId ?? ''
  const { data: fields, isLoading } = useCustomFields(projectId)
  const createField = useCreateCustomField()
  const updateField = useUpdateCustomField()
  const deleteField = useDeleteCustomField()

  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CustomFieldType>('text')
  const [newRequired, setNewRequired] = useState(false)
  const [dropdownChoices, setDropdownChoices] = useState('')

  const handleCreate = () => {
    if (!newName.trim()) return
    const options = newType === 'dropdown' ? { choices: dropdownChoices.split(',').map((c) => c.trim()).filter(Boolean) } : undefined

    createField.mutate(
      {
        project_id: projectId,
        name: newName.trim(),
        field_type: newType,
        options: options || undefined,
        is_required: newRequired,
        order: (fields?.length || 0),
      },
      {
        onSuccess: () => {
          setNewName('')
          setNewType('text')
          setNewRequired(false)
          setDropdownChoices('')
          setShowAdd(false)
        },
      }
    )
  }

  const handleDelete = (fieldId: string) => {
    if (!confirm('Delete this custom field? All task values for this field will be lost.')) return
    deleteField.mutate({ project_id: projectId, field_id: fieldId })
  }

  const handleToggleRequired = (field: CustomField) => {
    updateField.mutate({
      project_id: projectId,
      field_id: field.id,
      is_required: !field.is_required,
    })
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-4">Loading custom fields...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Custom Fields</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-3 py-1.5 bg-[#51459d] text-white rounded-[10px] hover:bg-[#51459d]/90"
        >
          + Add Field
        </button>
      </div>

      {(!fields || fields.length === 0) && !showAdd && (
        <p className="text-sm text-gray-400 text-center py-6">
          No custom fields yet. Add fields to track project-specific data on tasks.
        </p>
      )}

      <div className="space-y-2">
        {fields?.map((field) => (
          <div
            key={field.id}
            className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-[10px]"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{field.name}</span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                  {fieldTypeLabels[field.field_type as CustomFieldType] || field.field_type}
                </span>
                {field.is_required && (
                  <span className="text-xs text-red-400">Required</span>
                )}
              </div>
              {field.field_type === 'dropdown' && field.options && (
                <div className="text-xs text-gray-400 mt-0.5">
                  Options: {(field.options as { choices?: string[] }).choices?.join(', ')}
                </div>
              )}
            </div>
            <button
              onClick={() => handleToggleRequired(field)}
              className="text-xs text-gray-400 hover:text-[#51459d]"
            >
              {field.is_required ? 'Optional' : 'Required'}
            </button>
            <button
              onClick={() => handleDelete(field.id)}
              className="text-gray-400 hover:text-red-500"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-[10px] border border-gray-200">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Field name..."
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            autoFocus
          />
          <div className="flex gap-3">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as CustomFieldType)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            >
              {Object.entries(fieldTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="rounded"
              />
              Required
            </label>
          </div>
          {newType === 'dropdown' && (
            <input
              type="text"
              value={dropdownChoices}
              onChange={(e) => setDropdownChoices(e.target.value)}
              placeholder="Choices (comma-separated): Option 1, Option 2, Option 3"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={createField.isPending || !newName.trim()}
              className="text-sm px-4 py-2 bg-[#51459d] text-white rounded-lg hover:bg-[#51459d]/90 disabled:opacity-50"
            >
              Create Field
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
