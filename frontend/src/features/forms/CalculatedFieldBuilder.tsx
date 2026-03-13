import { useState, useRef } from 'react'

interface FieldDef {
  id: string
  label: string
  field_type: string
}

interface CalculatedFieldBuilderProps {
  fields: FieldDef[]
  formula: string
  onFormulaChange: (formula: string) => void
}

const NUMERIC_TYPES = ['number', 'rating', 'slider', 'nps']
const OPERATORS = ['+', '-', '*', '/', '(', ')']

function buildPreview(formula: string, fields: FieldDef[]): string {
  let preview = formula
  // Replace all {field_id} tokens with field labels
  const tokenRegex = /\{([^}]+)\}/g
  preview = preview.replace(tokenRegex, (match, id) => {
    const field = fields.find((f) => f.id === id)
    return field ? `[${field.label}]` : match
  })
  return preview
}

export default function CalculatedFieldBuilder({
  fields,
  formula,
  onFormulaChange,
}: CalculatedFieldBuilderProps) {
  const [showFieldPicker, setShowFieldPicker] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const numericFields = fields.filter((f) => NUMERIC_TYPES.includes(f.field_type))

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current
    if (!el) {
      onFormulaChange(formula + text)
      return
    }
    const start = el.selectionStart ?? formula.length
    const end = el.selectionEnd ?? formula.length
    const newValue = formula.slice(0, start) + text + formula.slice(end)
    onFormulaChange(newValue)

    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      el.focus()
      const newCursor = start + text.length
      el.setSelectionRange(newCursor, newCursor)
    })
  }

  const insertField = (fieldId: string) => {
    insertAtCursor(`{${fieldId}}`)
    setShowFieldPicker(false)
  }

  const insertOperator = (op: string) => {
    insertAtCursor(` ${op} `)
  }

  const preview = buildPreview(formula, fields)

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4"
      style={{ fontFamily: 'Open Sans, sans-serif', borderRadius: 10 }}
    >
      {/* Title row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Formula Builder
        </h3>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
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
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Syntax help
        </button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div
          className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-xs text-blue-800 dark:text-blue-300 space-y-1"
          style={{ borderRadius: 10 }}
        >
          <p className="font-semibold">Formula syntax</p>
          <p>Use <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{field_id}'}</code> to reference a numeric field.</p>
          <p>Supports operators: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">+ - * / ( )</code></p>
          <p className="italic text-blue-600 dark:text-blue-400">Example: <code>{'{price}'} * {'{quantity}'}</code></p>
        </div>
      )}

      {/* Formula textarea */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Formula
        </label>
        <textarea
          ref={textareaRef}
          value={formula}
          onChange={(e) => onFormulaChange(e.target.value)}
          rows={2}
          placeholder="e.g. {price} * {quantity}"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d] resize-none font-mono"
          style={{ borderRadius: 10 }}
          spellCheck={false}
        />
      </div>

      {/* Operator buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Operators:</span>
        {OPERATORS.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => insertOperator(op)}
            className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-mono text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            style={{ borderRadius: 8 }}
          >
            {op}
          </button>
        ))}
      </div>

      {/* Insert field */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Numeric fields:
          </span>
          {numericFields.length === 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 italic">
              No numeric fields in this form yet.
            </span>
          )}
        </div>
        {numericFields.length > 0 && (
          <div className="relative">
            <div className="flex flex-wrap gap-2">
              {numericFields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => insertField(f.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white transition-opacity hover:opacity-85"
                  style={{ backgroundColor: '#51459d', borderRadius: 20 }}
                  title={`Insert {${f.id}}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {f.label}
                  <span className="opacity-60 text-[10px]">({f.field_type})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div
        className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700"
        style={{ borderRadius: 10 }}
      >
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Preview formula
        </p>
        {formula.trim() ? (
          <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
            {preview || <span className="italic text-gray-400">Enter a formula above</span>}
          </p>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            Enter a formula above to see the preview.
          </p>
        )}
      </div>
    </div>
  )
}
