import { useState, useEffect } from 'react'
import { useTaskCustomFieldValues, useSetCustomFieldValues } from '@/api/projects_enhanced'

interface CustomFieldsEditorProps {
  projectId: string
  taskId: string
}

export default function CustomFieldsEditor({ projectId, taskId }: CustomFieldsEditorProps) {
  const { data: fields, isLoading } = useTaskCustomFieldValues(projectId, taskId)
  const setValues = useSetCustomFieldValues()
  const [localValues, setLocalValues] = useState<Record<string, { text?: string; number?: number; date?: string }>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!fields) return
    const vals: typeof localValues = {}
    for (const f of fields) {
      vals[f.field_id] = {
        text: f.value_text || '',
        number: f.value_number ?? undefined,
        date: f.value_date ? f.value_date.split('T')[0] : '',
      }
    }
    setLocalValues(vals)
    setDirty(false)
  }, [fields])

  const handleChange = (fieldId: string, key: 'text' | 'number' | 'date', value: string | number) => {
    setLocalValues((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], [key]: value },
    }))
    setDirty(true)
  }

  const handleSave = () => {
    if (!fields) return
    const values = fields.map((f) => {
      const local = localValues[f.field_id] || {}
      return {
        field_id: f.field_id,
        value_text: f.field_type === 'text' || f.field_type === 'dropdown' ? (local.text || null) : null,
        value_number: f.field_type === 'number' ? (local.number ?? null) : null,
        value_date: f.field_type === 'date' ? (local.date ? new Date(local.date).toISOString() : null) : null,
      }
    })
    setValues.mutate(
      { project_id: projectId, task_id: taskId, values },
      { onSuccess: () => setDirty(false) }
    )
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-2">Loading custom fields...</div>
  }

  if (!fields || fields.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No custom fields defined for this project</p>
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const local = localValues[field.field_id] || {}
        return (
          <div key={field.field_id} className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              {field.field_name}
              {field.is_required && <span className="text-red-400 ml-0.5">*</span>}
            </label>

            {field.field_type === 'text' && (
              <input
                type="text"
                value={local.text || ''}
                onChange={(e) => handleChange(field.field_id, 'text', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              />
            )}

            {field.field_type === 'number' && (
              <input
                type="number"
                value={local.number ?? ''}
                onChange={(e) => handleChange(field.field_id, 'number', parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              />
            )}

            {field.field_type === 'date' && (
              <input
                type="date"
                value={local.date || ''}
                onChange={(e) => handleChange(field.field_id, 'date', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              />
            )}

            {field.field_type === 'dropdown' && (
              <select
                value={local.text || ''}
                onChange={(e) => handleChange(field.field_id, 'text', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              >
                <option value="">Select...</option>
                {(field.options as { choices?: string[] } | null)?.choices?.map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.field_type === 'formula' && (
              <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
                {local.text || 'Computed field'}
              </div>
            )}
          </div>
        )
      })}

      {dirty && (
        <button
          onClick={handleSave}
          disabled={setValues.isPending}
          className="w-full text-sm py-2 bg-[#51459d] text-white rounded-lg hover:bg-[#51459d]/90 disabled:opacity-50"
        >
          {setValues.isPending ? 'Saving...' : 'Save Custom Fields'}
        </button>
      )}
    </div>
  )
}
