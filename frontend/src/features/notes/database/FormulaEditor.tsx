/**
 * FormulaEditor — Simple formula editor for computed database properties.
 */
import { useState } from 'react'

const FORMULA_FUNCTIONS = [
  { name: 'concat(A, B)', desc: 'Concatenate two text values' },
  { name: 'if(condition, then, else)', desc: 'Conditional expression' },
  { name: 'length(text)', desc: 'Character count' },
  { name: 'upper(text)', desc: 'Uppercase' },
  { name: 'lower(text)', desc: 'Lowercase' },
  { name: 'add(a, b)', desc: 'Add numbers' },
  { name: 'subtract(a, b)', desc: 'Subtract' },
  { name: 'multiply(a, b)', desc: 'Multiply' },
  { name: 'divide(a, b)', desc: 'Divide' },
  { name: 'round(n, decimals)', desc: 'Round number' },
  { name: 'today()', desc: "Today's date" },
  { name: 'now()', desc: 'Current timestamp' },
  { name: 'dateDiff(d1, d2, unit)', desc: 'Days between dates' },
  { name: 'empty(value)', desc: 'Is value empty?' },
  { name: 'not(value)', desc: 'Logical NOT' },
  { name: 'and(a, b)', desc: 'Logical AND' },
  { name: 'or(a, b)', desc: 'Logical OR' },
]

interface FormulaEditorProps {
  initialFormula?: string
  propertyNames: string[]
  onSave: (formula: string) => void
  onClose: () => void
}

export default function FormulaEditor({ initialFormula = '', propertyNames, onSave, onClose }: FormulaEditorProps) {
  const [formula, setFormula] = useState(initialFormula)
  const [error, setError] = useState<string | null>(null)

  const validate = (f: string): boolean => {
    if (!f.trim()) { setError('Formula cannot be empty'); return false }
    // Simple bracket balance check
    let depth = 0
    for (const ch of f) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      if (depth < 0) { setError('Unmatched closing parenthesis'); return false }
    }
    if (depth !== 0) { setError('Unclosed parenthesis'); return false }
    setError(null)
    return true
  }

  const insert = (text: string) => {
    setFormula(f => f + text)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-[12px] shadow-xl w-[560px] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Formula Editor</h3>

        {/* Formula input */}
        <div className="mb-3">
          <label className="text-[11px] text-gray-500 mb-1 block">Formula</label>
          <textarea
            value={formula}
            onChange={e => { setFormula(e.target.value); setError(null) }}
            rows={3}
            className={`w-full font-mono text-[12px] px-3 py-2 border rounded-[8px] focus:outline-none bg-transparent resize-none ${error ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-[#51459d]'}`}
            placeholder='e.g. concat(Name, " — ", Status)'
          />
          {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
        </div>

        {/* Property references */}
        <div className="mb-3">
          <p className="text-[11px] text-gray-500 mb-1">Property references (click to insert):</p>
          <div className="flex flex-wrap gap-1">
            {propertyNames.map(p => (
              <button
                key={p}
                onClick={() => insert(`prop("${p}")`)}
                className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-[#51459d]/10 hover:text-[#51459d] transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Functions reference */}
        <div className="mb-4 max-h-40 overflow-y-auto">
          <p className="text-[11px] text-gray-500 mb-1">Functions (click to insert):</p>
          <div className="grid grid-cols-2 gap-1">
            {FORMULA_FUNCTIONS.map(fn => (
              <button
                key={fn.name}
                onClick={() => insert(fn.name)}
                className="text-left px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span className="text-[10px] font-mono text-[#51459d]">{fn.name.split('(')[0]}</span>
                <span className="text-[9px] text-gray-400 ml-1">{fn.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { if (validate(formula)) { onSave(formula); onClose() } }}
            className="flex-1 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
          >
            Save Formula
          </button>
          <button onClick={onClose} className="text-sm text-gray-400 px-4">Cancel</button>
        </div>
      </div>
    </div>
  )
}
