import { useState } from 'react'

interface FieldDef {
  id: string
  label: string
  field_type: string
}

interface SelectOption {
  value: string
  label: string
  parent_value?: string
}

interface CascadingSelectBuilderProps {
  fields: FieldDef[]
  parentFieldId: string | null
  onParentFieldChange: (fieldId: string | null) => void
  options: SelectOption[]
  onOptionsChange: (options: SelectOption[]) => void
}

const SELECTABLE_TYPES = ['select', 'cascading_select', 'dropdown']

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/__+/g, '_')
    .replace(/^_|_$/g, '')
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export default function CascadingSelectBuilder({
  fields,
  parentFieldId,
  onParentFieldChange,
  options,
  onOptionsChange,
}: CascadingSelectBuilderProps) {
  const [newChildLabels, setNewChildLabels] = useState<Record<string, string>>({})
  const [newStandaloneLabel, setNewStandaloneLabel] = useState('')

  const selectableFields = fields.filter((f) => SELECTABLE_TYPES.includes(f.field_type))
  const selectedParentField = selectableFields.find((f) => f.id === parentFieldId) ?? null

  // Gather unique parent values from options that lack parent_value — these are "root" options
  const rootOptions = options.filter((o) => !o.parent_value)
  const childOptions = (parentValue: string) =>
    options.filter((o) => o.parent_value === parentValue)

  const updateOption = (index: number, patch: Partial<SelectOption>) => {
    const updated = options.map((o, i) => (i === index ? { ...o, ...patch } : o))
    onOptionsChange(updated)
  }

  const removeOption = (index: number) => {
    const opt = options[index]
    // Also remove children of this option
    const filtered = options.filter(
      (o, i) => i !== index && o.parent_value !== opt.value
    )
    onOptionsChange(filtered)
  }

  const addChildOption = (parentValue: string) => {
    const label = (newChildLabels[parentValue] ?? '').trim()
    if (!label) return
    const newOpt: SelectOption = {
      value: slugify(label) || generateId(),
      label,
      parent_value: parentValue,
    }
    onOptionsChange([...options, newOpt])
    setNewChildLabels((prev) => ({ ...prev, [parentValue]: '' }))
  }

  const addStandaloneOption = () => {
    const label = newStandaloneLabel.trim()
    if (!label) return
    const newOpt: SelectOption = {
      value: slugify(label) || generateId(),
      label,
    }
    onOptionsChange([...options, newOpt])
    setNewStandaloneLabel('')
  }

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5"
      style={{ fontFamily: 'Open Sans, sans-serif', borderRadius: 10 }}
    >
      {/* Title */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Cascading Select Options
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Select a parent field to create dependent options. Each option will only appear when its
          parent value is selected.
        </p>
      </div>

      {/* Parent field selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Parent Field (optional)
        </label>
        <select
          value={parentFieldId ?? ''}
          onChange={(e) => onParentFieldChange(e.target.value || null)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
          style={{ borderRadius: 10 }}
        >
          <option value="">— None (standalone select) —</option>
          {selectableFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} ({f.field_type})
            </option>
          ))}
        </select>
        {selectableFields.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            No select/dropdown fields found in the form to use as a parent.
          </p>
        )}
      </div>

      {/* Cascaded mode — grouped by parent option */}
      {parentFieldId ? (
        <div className="space-y-4">
          {rootOptions.length === 0 && (
            <div
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-300 dark:border-gray-600 text-center text-xs text-gray-400 dark:text-gray-500"
              style={{ borderRadius: 10 }}
            >
              The parent field "{selectedParentField?.label}" has no options configured yet. Add
              options to the parent field first, then define child options here.
            </div>
          )}

          {rootOptions.map((parent, pi) => {
            const children = childOptions(parent.value)
            const parentIndex = options.indexOf(parent)

            return (
              <div
                key={parent.value}
                className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                style={{ borderRadius: 10 }}
              >
                {/* Group header */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900/40"
                >
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: '#51459d', borderRadius: 20 }}
                  >
                    {parent.label}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {children.length} child option{children.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Child option rows */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {children.map((child) => {
                    const childIndex = options.indexOf(child)
                    return (
                      <OptionRow
                        key={child.value + childIndex}
                        option={child}
                        onUpdate={(patch) => updateOption(childIndex, patch)}
                        onRemove={() => removeOption(childIndex)}
                        indented
                      />
                    )
                  })}
                </div>

                {/* Add child */}
                <div className="flex gap-2 p-3 bg-white dark:bg-gray-800">
                  <input
                    type="text"
                    placeholder={`Add option under "${parent.label}"…`}
                    value={newChildLabels[parent.value] ?? ''}
                    onChange={(e) =>
                      setNewChildLabels((prev) => ({
                        ...prev,
                        [parent.value]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addChildOption(parent.value)
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
                    style={{ borderRadius: 8 }}
                  />
                  <button
                    type="button"
                    onClick={() => addChildOption(parent.value)}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-opacity hover:opacity-90 flex items-center gap-1"
                    style={{ backgroundColor: '#51459d', borderRadius: 8 }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Standalone mode */
        <div className="space-y-2">
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden" style={{ borderRadius: 10 }}>
            {options.map((opt, i) => (
              <OptionRow
                key={opt.value + i}
                option={opt}
                onUpdate={(patch) => updateOption(i, patch)}
                onRemove={() => removeOption(i)}
              />
            ))}
            {options.length === 0 && (
              <div className="p-4 text-xs text-center text-gray-400 dark:text-gray-500 italic">
                No options yet. Add one below.
              </div>
            )}
          </div>

          {/* Add standalone option */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New option label…"
              value={newStandaloneLabel}
              onChange={(e) => setNewStandaloneLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addStandaloneOption()
                }
              }}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
              style={{ borderRadius: 10 }}
            />
            <button
              type="button"
              onClick={addStandaloneOption}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#51459d', borderRadius: 10 }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Option
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ——— Helper row component ——— */
function OptionRow({
  option,
  onUpdate,
  onRemove,
  indented,
}: {
  option: SelectOption
  onUpdate: (patch: Partial<SelectOption>) => void
  onRemove: () => void
  indented?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-800 ${indented ? 'pl-6' : ''}`}
    >
      {/* Label */}
      <input
        type="text"
        value={option.label}
        onChange={(e) => {
          const label = e.target.value
          onUpdate({
            label,
            value: slugify(label) || option.value,
          })
        }}
        placeholder="Label"
        className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
        style={{ borderRadius: 8 }}
      />
      {/* Value */}
      <input
        type="text"
        value={option.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder="value"
        className="w-28 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 font-mono focus:outline-none focus:ring-2 focus:ring-[#51459d]"
        style={{ borderRadius: 8 }}
      />
      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        style={{ borderRadius: 8 }}
        title="Remove option"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  )
}
