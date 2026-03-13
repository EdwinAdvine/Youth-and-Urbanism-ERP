/**
 * CopilotPanel — Natural language Q&A panel for analytics dashboards.
 *
 * Sits at the top of any dashboard page. Users type questions like
 * "Show me revenue by month" and get back data + chart + AI narrative.
 */
import { useState, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import ChartRenderer, { type ChartType } from '@/components/charts/ChartRenderer'

interface CopilotResult {
  question: string
  sql: string
  columns: string[]
  data: Record<string, unknown>[]
  total_rows: number
  execution_time_ms: number
  narrative: string
  suggested_visuals: { type: string; title: string; confidence: number }[]
  error?: string
}

interface CopilotPanelProps {
  module?: string
  className?: string
}

async function askCopilot(question: string, module?: string): Promise<CopilotResult> {
  const token = localStorage.getItem('access_token')
  const res = await fetch('/api/v1/analytics/copilot/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, module }),
  })
  if (!res.ok) throw new Error(`Copilot error: ${res.status}`)
  return res.json()
}

export default function CopilotPanel({ module, className = '' }: CopilotPanelProps) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<CopilotResult | null>(null)
  const [selectedChart, setSelectedChart] = useState<string>('bar')
  const [showSQL, setShowSQL] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: (q: string) => askCopilot(q, module),
    onSuccess: (data) => {
      setResult(data)
      if (data.suggested_visuals?.length > 0) {
        setSelectedChart(data.suggested_visuals[0].type)
      }
    },
  })

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return
    mutation.mutate(question.trim())
  }, [question, mutation])

  const handleSuggestion = useCallback((q: string) => {
    setQuestion(q)
    mutation.mutate(q)
  }, [mutation])

  const suggestions = [
    'Show me revenue by month',
    'Top 10 customers by total purchases',
    'Employee headcount by department',
    'Open support tickets by priority',
    'Inventory items below reorder point',
    'Deal pipeline by stage',
  ]

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l-4-4m0 0l4-4m-4 4h16" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask anything about your data... (e.g., 'Show me revenue by month')"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d] focus:border-transparent dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending || !question.trim()}
            className="px-5 py-2.5 bg-[#51459d] text-white rounded-lg text-sm font-medium hover:bg-[#433b82] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {mutation.isPending ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
            Ask
          </button>
        </div>

        {/* Quick suggestions */}
        {!result && (
          <div className="flex flex-wrap gap-2 mt-3">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => handleSuggestion(s)}
                className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-[#51459d] hover:text-white transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Results */}
      {result && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Narrative */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#51459d]/5 to-transparent">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {result.narrative}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span>{result.total_rows} rows</span>
              <span>{result.execution_time_ms}ms</span>
              <button
                onClick={() => setShowSQL(!showSQL)}
                className="text-[#51459d] hover:underline"
              >
                {showSQL ? 'Hide SQL' : 'Show SQL'}
              </button>
            </div>
            {showSQL && (
              <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded-lg overflow-x-auto font-mono">
                {result.sql}
              </pre>
            )}
          </div>

          {/* Chart type selector */}
          {result.data.length > 0 && (
            <>
              <div className="px-4 py-2 flex gap-1 border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
                {(result.suggested_visuals?.length > 0
                  ? result.suggested_visuals.map(v => v.type)
                  : ['bar', 'line', 'pie', 'table']
                ).map(chartType => (
                  <button
                    key={chartType}
                    onClick={() => setSelectedChart(chartType)}
                    className={`px-3 py-1.5 text-xs rounded-md capitalize whitespace-nowrap transition-colors ${
                      selectedChart === chartType
                        ? 'bg-[#51459d] text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {chartType}
                  </button>
                ))}
              </div>

              {/* Chart */}
              {selectedChart === 'table' ? (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        {result.columns.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-medium text-gray-500 uppercase">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          {result.columns.map(col => (
                            <td key={col} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.total_rows > 20 && (
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      Showing 20 of {result.total_rows} rows
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4">
                  <ChartRenderer
                    type={selectedChart as ChartType}
                    data={result.data}
                    config={{
                      xKey: result.columns[0],
                      yKeys: result.columns.slice(1),
                      nameKey: result.columns[0],
                      valueKey: result.columns[1],
                      showToolbox: true,
                    }}
                    height={320}
                  />
                </div>
              )}
            </>
          )}

          {/* Error state */}
          {result.error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
