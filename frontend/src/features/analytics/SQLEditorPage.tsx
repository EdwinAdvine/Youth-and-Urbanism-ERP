import { useState, useCallback } from 'react'
import { Button, Card, Badge, toast } from '../../components/ui'
import { DataTable } from '../../components/charts'
import {
  useExecuteQuery,
  useSavedQueries,
  useCreateSavedQuery,
  useDeleteSavedQuery,
  type QueryResult,
} from '../../api/analytics_ext'

const EXAMPLE_QUERIES = [
  { label: 'Revenue by Month', query: "SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, SUM(total) AS revenue FROM finance_invoices GROUP BY 1 ORDER BY 1 DESC LIMIT 12" },
  { label: 'Employee Count', query: "SELECT department, COUNT(*) AS headcount FROM hr_employees WHERE is_active = true GROUP BY department ORDER BY headcount DESC" },
  { label: 'Open Tickets', query: "SELECT priority, COUNT(*) AS count FROM support_tickets WHERE status = 'open' GROUP BY priority ORDER BY count DESC" },
  { label: 'Top Inventory Items', query: "SELECT name, sku, quantity_on_hand, unit_cost FROM inventory_items ORDER BY quantity_on_hand DESC LIMIT 20" },
  { label: 'Deal Pipeline', query: "SELECT stage, COUNT(*) AS deals, SUM(value) AS total_value FROM crm_deals GROUP BY stage ORDER BY total_value DESC" },
]

export default function SQLEditorPage() {
  const [sql, setSql] = useState('')
  const [queryName, setQueryName] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)

  const executeQuery = useExecuteQuery()
  const { data: savedQueries } = useSavedQueries()
  const createSavedQuery = useCreateSavedQuery()
  const deleteSavedQuery = useDeleteSavedQuery()

  const handleExecute = useCallback(async () => {
    if (!sql.trim()) { toast('error', 'Enter a SQL query'); return }
    try {
      const res = await executeQuery.mutateAsync({
        query_text: sql,
        data_source: 'postgresql',
        limit: 500,
      })
      setResult(res)
      toast('success', `Query returned ${res.rows.length} rows in ${res.execution_time_ms}ms`)
    } catch {
      toast('error', 'Query execution failed. Check syntax and permissions.')
    }
  }, [sql, executeQuery])

  const handleSave = async () => {
    if (!queryName.trim()) { toast('error', 'Enter a name for this query'); return }
    if (!sql.trim()) { toast('error', 'Write a query first'); return }
    try {
      await createSavedQuery.mutateAsync({
        name: queryName,
        query_text: sql,
        data_source: 'postgresql',
        description: 'Saved from SQL Editor',
      })
      toast('success', 'Query saved')
      setQueryName('')
    } catch {
      toast('error', 'Failed to save query')
    }
  }

  const handleLoadQuery = (query: string) => {
    setSql(query)
    toast('info', 'Query loaded')
  }

  const handleDeleteSaved = async (id: string) => {
    try {
      await deleteSavedQuery.mutateAsync(id)
      toast('success', 'Query deleted')
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleExecute()
    }
  }

  const resultColumns = result?.columns.map((col) => ({
    key: col,
    label: col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    format: (val: unknown) => {
      if (val === null || val === undefined) return 'NULL'
      if (typeof val === 'number') return val.toLocaleString()
      return String(val)
    },
  })) ?? []

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SQL Editor</h1>
          <p className="text-sm text-gray-500 mt-1">Run custom SQL queries against the database</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExecute} loading={executeQuery.isPending}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run (Cmd+Enter)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* SQL Editor */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Query</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Query name..."
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                  className="text-xs border border-gray-200 rounded-[8px] px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 w-40"
                />
                <Button size="sm" variant="outline" onClick={handleSave} loading={createSavedQuery.isPending}>
                  Save
                </Button>
              </div>
            </div>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 min-h-[200px] bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-y"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="SELECT * FROM finance_invoices WHERE status = 'overdue' LIMIT 100"
              spellCheck={false}
            />
          </Card>

          {/* Results */}
          {result && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="success">{result.rows.length} rows</Badge>
                <span className="text-xs text-gray-400">{result.execution_time_ms}ms</span>
              </div>
              <DataTable
                columns={resultColumns}
                data={result.rows}
                pageSize={20}
                title="Query Results"
                subtitle={`${result.total_rows} total rows, ${result.execution_time_ms}ms execution time`}
                onExport={() => {
                  if (!result) return
                  const csv = [result.columns.join(','), ...result.rows.map((r) => result.columns.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'query_results.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Example Queries */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Example Queries</h3>
            <div className="space-y-1.5">
              {EXAMPLE_QUERIES.map((eq) => (
                <button
                  key={eq.label}
                  className="w-full text-left text-xs px-2.5 py-2 rounded-[8px] text-gray-600 hover:bg-gray-50 hover:text-[#51459d] transition-colors"
                  onClick={() => handleLoadQuery(eq.query)}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Saved Queries */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Saved Queries ({savedQueries?.length ?? 0})
            </h3>
            {!savedQueries || savedQueries.length === 0 ? (
              <p className="text-xs text-gray-400">No saved queries yet</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {savedQueries.map((sq) => (
                  <div key={sq.id} className="flex items-center justify-between p-2 rounded-[8px] bg-gray-50 border border-gray-100">
                    <button
                      className="text-xs text-[#51459d] hover:underline truncate flex-1 text-left"
                      onClick={() => handleLoadQuery(sq.query_text)}
                    >
                      {sq.name}
                    </button>
                    <button
                      className="text-gray-300 hover:text-red-500 ml-2 shrink-0"
                      onClick={() => handleDeleteSaved(sq.id)}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Schema Reference */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tables</h3>
            <div className="space-y-1 text-[10px] font-mono text-gray-500 max-h-48 overflow-y-auto">
              {[
                'finance_invoices', 'finance_payments', 'finance_accounts', 'finance_journal_entries',
                'hr_employees', 'hr_departments', 'hr_leave_requests', 'hr_payslips',
                'crm_contacts', 'crm_leads', 'crm_deals',
                'inventory_items', 'inventory_stock_movements', 'inventory_purchase_orders',
                'support_tickets', 'projects', 'tasks', 'users',
                'ecommerce_products', 'ecommerce_orders', 'ecommerce_order_items',
              ].map((t) => (
                <button
                  key={t}
                  className="block w-full text-left px-1.5 py-1 rounded hover:bg-gray-50 hover:text-[#51459d] transition-colors"
                  onClick={() => setSql((prev) => prev + (prev ? ' ' : '') + t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
