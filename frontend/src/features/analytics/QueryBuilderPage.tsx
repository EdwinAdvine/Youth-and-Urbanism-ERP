import { useState } from 'react'
import { Button, Card, Input, Select, Badge, Table, Spinner, toast } from '../../components/ui'
import { useExecuteQuery, useSavedQueries, useCreateSavedQuery, useDeleteSavedQuery, type QueryResult } from '../../api/analytics_ext'

const MODULE_OPTIONS = [
  { value: '', label: 'Select Module...' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'crm', label: 'CRM' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'support', label: 'Support' },
  { value: 'projects', label: 'Projects' },
]

const TABLE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  finance: [
    { value: 'invoices', label: 'Invoices' },
    { value: 'payments', label: 'Payments' },
    { value: 'accounts', label: 'Accounts' },
    { value: 'journal_entries', label: 'Journal Entries' },
  ],
  hr: [
    { value: 'employees', label: 'Employees' },
    { value: 'departments', label: 'Departments' },
    { value: 'leave_requests', label: 'Leave Requests' },
    { value: 'payslips', label: 'Payslips' },
  ],
  crm: [
    { value: 'contacts', label: 'Contacts' },
    { value: 'leads', label: 'Leads' },
    { value: 'deals', label: 'Deals' },
  ],
  inventory: [
    { value: 'items', label: 'Items' },
    { value: 'stock_movements', label: 'Stock Movements' },
    { value: 'purchase_orders', label: 'Purchase Orders' },
  ],
  support: [
    { value: 'tickets', label: 'Tickets' },
    { value: 'kb_articles', label: 'KB Articles' },
  ],
  projects: [
    { value: 'projects', label: 'Projects' },
    { value: 'tasks', label: 'Tasks' },
  ],
}

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'lt', label: 'Less Than' },
  { value: 'gte', label: 'Greater or Equal' },
  { value: 'lte', label: 'Less or Equal' },
]

interface FilterRow {
  id: string
  field: string
  operator: string
  value: string
}

type TabMode = 'visual' | 'sql'

export default function QueryBuilderPage() {
  const [tab, setTab] = useState<TabMode>('visual')
  const [module, setModule] = useState('')
  const [table, setTable] = useState('')
  const [filters, setFilters] = useState<FilterRow[]>([])
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [limitVal, setLimitVal] = useState('100')
  const [sqlQuery, setSqlQuery] = useState('')
  const [queryName, setQueryName] = useState('')

  const [result, setResult] = useState<QueryResult | null>(null)

  const executeQuery = useExecuteQuery()
  const { data: savedQueries, isLoading: savedLoading } = useSavedQueries()
  const createSavedQuery = useCreateSavedQuery()
  const deleteSavedQuery = useDeleteSavedQuery()

  const availableTables = module ? TABLE_OPTIONS[module] ?? [] : []

  const addFilter = () => {
    setFilters((prev) => [...prev, { id: Math.random().toString(36).slice(2), field: '', operator: 'equals', value: '' }])
  }

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }

  const updateFilter = (id: string, key: keyof FilterRow, value: string) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)))
  }

  const buildQuery = (): string => {
    if (tab === 'sql') return sqlQuery
    if (!module || !table) return ''
    let q = `SELECT * FROM ${module}.${table}`
    const validFilters = filters.filter((f) => f.field && f.value)
    if (validFilters.length > 0) {
      const clauses = validFilters.map((f) => {
        const op = f.operator === 'equals' ? '=' : f.operator === 'not_equals' ? '!='
          : f.operator === 'contains' ? 'LIKE' : f.operator === 'gt' ? '>'
          : f.operator === 'lt' ? '<' : f.operator === 'gte' ? '>=' : '<='
        const val = f.operator === 'contains' ? `'%${f.value}%'` : isNaN(Number(f.value)) ? `'${f.value}'` : f.value
        return `${f.field} ${op} ${val}`
      })
      q += ` WHERE ${clauses.join(' AND ')}`
    }
    if (sortField) q += ` ORDER BY ${sortField} ${sortDir}`
    if (limitVal) q += ` LIMIT ${limitVal}`
    return q
  }

  const handleRun = async () => {
    const query = buildQuery()
    if (!query.trim()) {
      toast('error', tab === 'visual' ? 'Please select a module and table' : 'Enter a SQL query')
      return
    }
    try {
      const res = await executeQuery.mutateAsync({ query_text: query, data_source: module || 'default' })
      setResult(res)
      toast('success', `Query returned ${res.rows.length} rows in ${res.execution_time_ms}ms`)
    } catch {
      toast('error', 'Query execution failed')
    }
  }

  const handleSaveQuery = async () => {
    const query = buildQuery()
    if (!queryName.trim()) { toast('error', 'Enter a name for this query'); return }
    if (!query.trim()) { toast('error', 'Build a query first'); return }
    try {
      await createSavedQuery.mutateAsync({ name: queryName, query_text: query, data_source: module || 'default', description: `${module}.${table}` })
      toast('success', 'Query saved')
      setQueryName('')
    } catch {
      toast('error', 'Failed to save query')
    }
  }

  const handleLoadQuery = (query: string) => {
    setSqlQuery(query)
    setTab('sql')
    toast('info', 'Query loaded into SQL editor')
  }

  const handleDeleteSaved = async (id: string) => {
    try {
      await deleteSavedQuery.mutateAsync(id)
      toast('success', 'Query deleted')
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  const handleReset = () => {
    setModule('')
    setTable('')
    setFilters([])
    setSortField('')
    setSortDir('asc')
    setLimitVal('100')
    setSqlQuery('')
    setResult(null)
  }

  const resultColumns = result && result.columns.length > 0
    ? result.columns.map((col) => ({
        key: col,
        label: col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        render: (row: Record<string, unknown>) => {
          const val = row[col]
          if (val === null || val === undefined) return <span className="text-gray-300">null</span>
          if (typeof val === 'number') return <span className="font-medium text-gray-700 dark:text-gray-300">{val.toLocaleString()}</span>
          const str = String(val)
          if (['status', 'state', 'priority'].includes(col.toLowerCase())) {
            return <Badge variant="primary">{str}</Badge>
          }
          return <span className="text-gray-600 dark:text-gray-400">{str}</span>
        },
      }))
    : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Query Builder</h1>
          <p className="text-sm text-gray-500 mt-1">Build and run custom queries across your data</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>Reset</Button>
          <Button onClick={handleRun} loading={executeQuery.isPending}>Run Query</Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-[10px] p-1 w-fit">
        {(['visual', 'sql'] as TabMode[]).map((t) => (
          <button
            key={t}
            className={`px-4 py-1.5 text-sm rounded-[8px] transition-colors ${ tab === t ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700' }`}
            onClick={() => setTab(t)}
          >
            {t === 'visual' ? 'Visual Builder' : 'SQL Editor'}
          </button>
        ))}
      </div>

      {tab === 'visual' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Data Source */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Data Source</h3>
            <div className="space-y-3">
              <Select
                label="Module"
                options={MODULE_OPTIONS}
                value={module}
                onChange={(e) => { setModule(e.target.value); setTable(''); setFilters([]) }}
              />
              <Select
                label="Table"
                options={[{ value: '', label: 'Select Table...' }, ...availableTables]}
                value={table}
                onChange={(e) => setTable(e.target.value)}
              />
            </div>
          </Card>

          {/* Filters */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</h3>
              <Button size="sm" variant="ghost" onClick={addFilter}>+ Add</Button>
            </div>
            <div className="space-y-3">
              {filters.map((filter) => (
                <div key={filter.id} className="space-y-2 p-2 rounded-[8px] bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
                  <Input
                    placeholder="Field name..."
                    value={filter.field}
                    onChange={(e) => updateFilter(filter.id, 'field', e.target.value)}
                  />
                  <Select
                    options={OPERATOR_OPTIONS}
                    value={filter.operator}
                    onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Value..."
                      value={filter.value}
                      onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                    />
                    <Button size="sm" variant="ghost" className="text-red-500 shrink-0" onClick={() => removeFilter(filter.id)}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
              {filters.length === 0 && <p className="text-xs text-gray-400">No filters added</p>}
            </div>
          </Card>

          {/* Sort & Limit */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Sort & Limit</h3>
            <div className="space-y-3">
              <Input label="Sort By" value={sortField} onChange={(e) => setSortField(e.target.value)} placeholder="Field name" />
              <Select
                label="Direction"
                options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]}
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value)}
              />
              <Input label="Limit" value={limitVal} onChange={(e) => setLimitVal(e.target.value)} placeholder="100" />
            </div>
          </Card>

          {/* Save Query */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Save Query</h3>
            <div className="space-y-3">
              <Input
                label="Query Name"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="My custom query"
              />
              <Button className="w-full" size="sm" variant="outline" onClick={handleSaveQuery} loading={createSavedQuery.isPending}>
                Save Query
              </Button>
            </div>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-3">Saved Queries</h3>
            {savedLoading ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : !savedQueries || savedQueries.length === 0 ? (
              <p className="text-xs text-gray-400">No saved queries</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedQueries.map((sq) => (
                  <div key={sq.id} className="flex items-center justify-between p-2 rounded-[8px] bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
                    <button className="text-xs text-primary hover:underline truncate flex-1 text-left" onClick={() => handleLoadQuery(sq.query_text)}>
                      {sq.name}
                    </button>
                    <button className="text-gray-300 hover:text-red-500 ml-2 shrink-0" onClick={() => handleDeleteSaved(sq.id)}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* SQL Editor */
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">SQL Query</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Query name..."
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                className="w-48"
              />
              <Button size="sm" variant="outline" onClick={handleSaveQuery} loading={createSavedQuery.isPending}>Save</Button>
            </div>
          </div>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[200px] bg-gray-50 dark:bg-gray-950"
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            placeholder="SELECT * FROM finance.invoices WHERE status = 'overdue' LIMIT 100"
            spellCheck={false}
          />
        </Card>
      )}

      {/* Generated Query Preview */}
      {tab === 'visual' && (module || table) && (
        <Card>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Generated Query</h3>
          <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 rounded-[8px] p-3 overflow-x-auto font-mono">{buildQuery()}</pre>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Query Results</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {result.rows.length} rows returned in {result.execution_time_ms}ms
              </p>
            </div>
            <Badge variant="success">{result.rows.length} rows</Badge>
          </div>
          {result.rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-400 text-sm">No results returned</p>
            </div>
          ) : (
            <Table<Record<string, unknown>>
              columns={resultColumns}
              data={result.rows}
              emptyText="No results"
              keyExtractor={(row) => String(row['id'] ?? JSON.stringify(row).slice(0, 64))}
            />
          )}
        </Card>
      )}
    </div>
  )
}
