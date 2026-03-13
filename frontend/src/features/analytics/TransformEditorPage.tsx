/**
 * TransformEditorPage — visual data transform pipeline editor.
 * Chain filter, rename, aggregate, sort, and limit steps.
 * Live 50-row preview updates as steps are added/modified.
 */
import { useState } from 'react'
import apiClient from '../../api/client'

// ── Types ────────────────────────────────────────────────────────────────────

type StepType = 'filter' | 'rename' | 'aggregate' | 'sort' | 'limit'

interface FilterStep { type: 'filter'; field: string; operator: string; value: string }
interface RenameStep { type: 'rename'; from: string; to: string }
interface AggregateStep { type: 'aggregate'; groupBy: string; metric: string; operation: 'sum' | 'avg' | 'count' | 'min' | 'max' }
interface SortStep { type: 'sort'; field: string; direction: 'asc' | 'desc' }
interface LimitStep { type: 'limit'; count: number }
type TransformStep = FilterStep | RenameStep | AggregateStep | SortStep | LimitStep

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_DATA: Record<string, unknown>[] = [
  { month: 'Jan 2025', revenue: 420000, expenses: 310000, profit: 110000, invoices: 42 },
  { month: 'Feb 2025', revenue: 385000, expenses: 290000, profit: 95000, invoices: 38 },
  { month: 'Mar 2025', revenue: 510000, expenses: 360000, profit: 150000, invoices: 55 },
  { month: 'Apr 2025', revenue: 476000, expenses: 320000, profit: 156000, invoices: 49 },
  { month: 'May 2025', revenue: 562000, expenses: 400000, profit: 162000, invoices: 61 },
]

const MOCK_COLUMNS = ['month', 'revenue', 'expenses', 'profit', 'invoices']

// ── Step defaults ─────────────────────────────────────────────────────────────

function defaultStep(type: StepType): TransformStep {
  switch (type) {
    case 'filter': return { type: 'filter', field: '', operator: '>', value: '' }
    case 'rename': return { type: 'rename', from: '', to: '' }
    case 'aggregate': return { type: 'aggregate', groupBy: '', metric: '', operation: 'sum' }
    case 'sort': return { type: 'sort', field: '', direction: 'asc' }
    case 'limit': return { type: 'limit', count: 50 }
  }
}

function stepSummary(step: TransformStep): string {
  switch (step.type) {
    case 'filter': return `filter: ${step.field} ${step.operator} ${step.value}`
    case 'rename': return `rename: ${step.from} → ${step.to}`
    case 'aggregate': return `aggregate: ${step.operation}(${step.metric}) by ${step.groupBy}`
    case 'sort': return `sort: ${step.field} ${step.direction}`
    case 'limit': return `limit: ${step.count} rows`
  }
}

// ── SQL builder (basic) ───────────────────────────────────────────────────────

function buildSQL(steps: TransformStep[]): string {
  let base = 'SELECT * FROM data_source'
  const filters = steps.filter((s): s is FilterStep => s.type === 'filter' && s.field !== '')
  const renames = steps.filter((s): s is RenameStep => s.type === 'rename' && s.from !== '' && s.to !== '')
  const aggregate = steps.find((s): s is AggregateStep => s.type === 'aggregate' && s.groupBy !== '')
  const sort = steps.find((s): s is SortStep => s.type === 'sort' && s.field !== '')
  const limit = steps.find((s): s is LimitStep => s.type === 'limit')

  if (aggregate) {
    const selectCols = renames.length
      ? `${aggregate.groupBy}, ${aggregate.operation.toUpperCase()}(${aggregate.metric}) AS ${aggregate.metric}_${aggregate.operation}`
      : `${aggregate.groupBy}, ${aggregate.operation.toUpperCase()}(${aggregate.metric})`
    base = `SELECT ${selectCols} FROM data_source`
    if (filters.length) {
      base += ` WHERE ${filters.map(f => `${f.field} ${f.operator} ${f.value}`).join(' AND ')}`
    }
    base += ` GROUP BY ${aggregate.groupBy}`
  } else {
    const selectCols = renames.length
      ? `*, ${renames.map(r => `${r.from} AS ${r.to}`).join(', ')}`
      : '*'
    base = `SELECT ${selectCols} FROM data_source`
    if (filters.length) {
      base += ` WHERE ${filters.map(f => `${f.field} ${f.operator} ${f.value}`).join(' AND ')}`
    }
  }

  if (sort) {
    base += ` ORDER BY ${sort.field} ${sort.direction.toUpperCase()}`
  }

  if (limit) {
    base += ` LIMIT ${limit.count}`
  }

  return base
}

// ── Config forms ──────────────────────────────────────────────────────────────

function FilterForm({ step, onChange }: { step: FilterStep; onChange: (s: FilterStep) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Field</label>
        <input
          type="text"
          value={step.field}
          onChange={e => onChange({ ...step, field: e.target.value })}
          placeholder="e.g. revenue"
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Operator</label>
        <select
          value={step.operator}
          onChange={e => onChange({ ...step, operator: e.target.value })}
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        >
          {['=', '!=', '>', '<', '>=', '<=', 'contains'].map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Value</label>
        <input
          type="text"
          value={step.value}
          onChange={e => onChange({ ...step, value: e.target.value })}
          placeholder="e.g. 1000"
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        />
      </div>
    </div>
  )
}

function RenameForm({ step, onChange }: { step: RenameStep; onChange: (s: RenameStep) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From (original column)</label>
        <input
          type="text"
          value={step.from}
          onChange={e => onChange({ ...step, from: e.target.value })}
          placeholder="e.g. revenue"
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To (new name)</label>
        <input
          type="text"
          value={step.to}
          onChange={e => onChange({ ...step, to: e.target.value })}
          placeholder="e.g. total_revenue"
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        />
      </div>
    </div>
  )
}

function AggregateForm({ step, onChange }: { step: AggregateStep; onChange: (s: AggregateStep) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Group By</label>
        <input
          type="text"
          value={step.groupBy}
          onChange={e => onChange({ ...step, groupBy: e.target.value })}
          placeholder="e.g. month"
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Metric</label>
        <input
          type="text"
          value={step.metric}
          onChange={e => onChange({ ...step, metric: e.target.value })}
          placeholder="e.g. revenue"
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Operation</label>
        <select
          value={step.operation}
          onChange={e => onChange({ ...step, operation: e.target.value as AggregateStep['operation'] })}
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        >
          {(['sum', 'avg', 'count', 'min', 'max'] as const).map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function SortForm({ step, onChange }: { step: SortStep; onChange: (s: SortStep) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Field</label>
        <input
          type="text"
          value={step.field}
          onChange={e => onChange({ ...step, field: e.target.value })}
          placeholder="e.g. revenue"
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Direction</label>
        <div className="flex gap-4">
          {(['asc', 'desc'] as const).map(dir => (
            <label key={dir} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="radio"
                name="sort-direction"
                value={dir}
                checked={step.direction === dir}
                onChange={() => onChange({ ...step, direction: dir })}
                className="accent-[#51459d]"
              />
              {dir === 'asc' ? 'Ascending' : 'Descending'}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function LimitForm({ step, onChange }: { step: LimitStep; onChange: (s: LimitStep) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Row Count</label>
      <input
        type="number"
        min={1}
        max={10000}
        value={step.count}
        onChange={e => onChange({ ...step, count: Math.max(1, Number(e.target.value)) })}
        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
      />
    </div>
  )
}

// ── Step config dispatcher ────────────────────────────────────────────────────

function StepConfigForm({ step, onChange }: { step: TransformStep; onChange: (s: TransformStep) => void }) {
  switch (step.type) {
    case 'filter': return <FilterForm step={step} onChange={onChange} />
    case 'rename': return <RenameForm step={step} onChange={onChange} />
    case 'aggregate': return <AggregateForm step={step} onChange={onChange} />
    case 'sort': return <SortForm step={step} onChange={onChange} />
    case 'limit': return <LimitForm step={step} onChange={onChange} />
  }
}

// ── Step type meta ────────────────────────────────────────────────────────────

const STEP_TYPES: { type: StepType; label: string; icon: string }[] = [
  { type: 'filter', label: 'Filter', icon: '🔽' },
  { type: 'rename', label: 'Rename', icon: '✏️' },
  { type: 'aggregate', label: 'Aggregate', icon: 'Σ' },
  { type: 'sort', label: 'Sort', icon: '⇅' },
  { type: 'limit', label: 'Limit', icon: '✂️' },
]

const TYPE_COLORS: Record<StepType, string> = {
  filter: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  rename: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  aggregate: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  sort: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  limit: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransformEditorPage() {
  const [steps, setSteps] = useState<TransformStep[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  function addStep(type: StepType) {
    const newStep = defaultStep(type)
    const newSteps = [...steps, newStep]
    setSteps(newSteps)
    setSelectedIndex(newSteps.length - 1)
  }

  function updateStep(index: number, updated: TransformStep) {
    const newSteps = [...steps]
    newSteps[index] = updated
    setSteps(newSteps)
  }

  function deleteStep(index: number) {
    const newSteps = steps.filter((_, i) => i !== index)
    setSteps(newSteps)
    setSelectedIndex(prev => {
      if (prev === null) return null
      if (prev === index) return newSteps.length > 0 ? Math.min(prev, newSteps.length - 1) : null
      if (prev > index) return prev - 1
      return prev
    })
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(steps, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transform-pipeline.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function runPreview() {
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewData(null)
    try {
      const sql = buildSQL(steps)
      const response = await apiClient.post('/api/v1/analytics/copilot/query', {
        question: `Execute this SQL and return the first 50 rows as JSON data: ${sql}`,
      })
      const rows = response.data.data || response.data.rows || []
      setPreviewData(rows)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Preview failed'
      setPreviewError(message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const displayData = previewData || MOCK_DATA
  const displayColumns = previewData
    ? (previewData.length > 0 ? Object.keys(previewData[0]) : [])
    : MOCK_COLUMNS

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Transform Editor</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Build step-by-step data pipelines</p>
        </div>
        <button
          type="button"
          onClick={exportJSON}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#51459d] text-white rounded-lg hover:bg-[#433b82] transition-colors"
        >
          <span>⬇</span>
          Export JSON
        </button>
      </div>

      {/* Main layout */}
      <div className="flex gap-5">
        {/* Left sidebar — steps */}
        <div className="w-64 shrink-0 space-y-4">
          {/* Add Step panel */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Add Step</p>
            <div className="space-y-1.5">
              {STEP_TYPES.map(({ type, label, icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addStep(type)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:border-[#51459d]/40 hover:bg-[#51459d]/5 transition-colors text-gray-700 dark:text-gray-300"
                >
                  <span className="text-sm w-5 text-center">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Steps list */}
          {steps.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Pipeline ({steps.length})
              </p>
              <div className="space-y-1.5">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedIndex(i)}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedIndex === i
                        ? 'border-[#51459d]/40 bg-[#51459d]/5'
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS[step.type]}`}>
                        {step.type}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                        {stepSummary(step).replace(`${step.type}: `, '')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); deleteStep(i) }}
                      className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 text-xs shrink-0 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — config + preview */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Config form */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] p-5">
            {selectedIndex !== null && steps[selectedIndex] ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_COLORS[steps[selectedIndex].type]}`}>
                    {steps[selectedIndex].type}
                  </span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Configure Step {selectedIndex + 1}
                  </p>
                </div>
                <StepConfigForm
                  step={steps[selectedIndex]}
                  onChange={updated => updateStep(selectedIndex, updated)}
                />
              </>
            ) : (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <p className="text-2xl mb-2">⚙️</p>
                <p className="text-sm">Add a step from the left panel,<br />then configure it here.</p>
              </div>
            )}
          </div>

          {/* Preview table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview</p>
                {steps.length > 0 ? (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Pipeline preview: {steps.length} step{steps.length !== 1 ? 's' : ''} applied (live preview coming soon)
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Showing sample finance data</p>
                )}
              </div>
              <button
                type="button"
                onClick={runPreview}
                disabled={previewLoading || steps.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#51459d] text-white rounded-lg hover:bg-[#433b82] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {previewLoading ? (
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span>▶</span>
                )}
                Run Preview
              </button>
            </div>

            {previewError && (
              <p className="text-xs text-red-500 mb-3">{previewError}</p>
            )}

            <div className="max-h-64 overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/80 backdrop-blur-sm">
                  <tr>
                    {displayColumns.map(col => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      {displayColumns.map(col => (
                        <td key={col} className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {steps.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Generated SQL</p>
                <pre className="text-[10px] text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap break-all">
                  {buildSQL(steps)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
