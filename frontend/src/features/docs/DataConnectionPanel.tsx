import { useState } from 'react'
import { useCreateDataConnection, useERPFormulas, useEvaluateFormula, useRefreshDataConnection, useDataConnections } from '../../api/docs'

const MODULES = [
  { value: 'finance', label: 'Finance', icon: '$' },
  { value: 'hr', label: 'Human Resources', icon: 'HR' },
  { value: 'crm', label: 'CRM', icon: 'CRM' },
  { value: 'inventory', label: 'Inventory', icon: 'INV' },
  { value: 'projects', label: 'Projects', icon: 'P' },
  { value: 'support', label: 'Support', icon: 'S' },
  { value: 'pos', label: 'Point of Sale', icon: 'POS' },
]

interface DataConnectionPanelProps {
  fileId: string | null
  onClose: () => void
}

export default function DataConnectionPanel({ fileId, onClose }: DataConnectionPanelProps) {
  const { data: connections, isLoading } = useDataConnections(fileId || '')
  const { data: formulasData } = useERPFormulas()
  const createConn = useCreateDataConnection()
  const refreshConn = useRefreshDataConnection()
  const evalFormula = useEvaluateFormula()

  const [tab, setTab] = useState<'connections' | 'formulas' | 'evaluate'>('connections')
  const [newConn, setNewConn] = useState({ source_module: 'finance', query_type: 'revenue', target_range: 'A1', refresh_interval_minutes: 0 })
  const [evalInput, setEvalInput] = useState('')
  const [evalResult, setEvalResult] = useState<Record<string, unknown> | null>(null)

  if (!fileId) return null

  const handleCreate = async () => {
    await createConn.mutateAsync({
      file_id: fileId,
      source_module: newConn.source_module,
      query_type: newConn.query_type,
      query_params: {},
      target_range: newConn.target_range,
      refresh_interval_minutes: newConn.refresh_interval_minutes,
    })
    setNewConn({ source_module: 'finance', query_type: 'revenue', target_range: 'A1', refresh_interval_minutes: 0 })
  }

  const handleEvaluate = async () => {
    if (!evalInput.trim()) return
    const result = await evalFormula.mutateAsync({
      file_id: fileId,
      formulas: [{ formula: evalInput, cell: 'A1' }],
    })
    setEvalResult(result.results?.[0] || null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[6px] bg-green-100 flex items-center justify-center">
            <svg className="h-3.5 w-3.5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M12 4v16" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">ERP Data</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px]">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0">
        {(['connections', 'formulas', 'evaluate'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t ? 'text-[#51459d] border-b-2 border-[#51459d]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === 'connections' && (
          <>
            {/* New connection form */}
            <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-950 rounded-[8px]">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">New Connection</p>
              <select
                value={newConn.source_module}
                onChange={(e) => setNewConn({ ...newConn, source_module: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800"
              >
                {MODULES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <input
                value={newConn.query_type}
                onChange={(e) => setNewConn({ ...newConn, query_type: e.target.value })}
                placeholder="Query type (e.g. revenue)"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px]"
              />
              <div className="flex gap-2">
                <input
                  value={newConn.target_range}
                  onChange={(e) => setNewConn({ ...newConn, target_range: e.target.value })}
                  placeholder="Cell range"
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px]"
                />
                <input
                  type="number"
                  value={newConn.refresh_interval_minutes}
                  onChange={(e) => setNewConn({ ...newConn, refresh_interval_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="Refresh (min)"
                  className="w-20 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px]"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={createConn.isPending}
                className="w-full py-1.5 text-xs bg-[#51459d] text-white rounded-[6px] hover:bg-[#3d3480] disabled:opacity-50"
              >
                {createConn.isPending ? 'Creating...' : 'Add Connection'}
              </button>
            </div>

            {/* Existing connections */}
            {isLoading ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
            ) : (
              (connections?.connections || []).map((conn) => (
                <div key={conn.id} className="p-3 border border-gray-100 dark:border-gray-700 rounded-[8px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                      {conn.source_module}.{conn.query_type}
                    </span>
                    <button
                      onClick={() => refreshConn.mutate({ file_id: fileId, connection_id: conn.id })}
                      className="text-[10px] text-[#51459d] hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Range: {conn.target_range} | Auto-refresh: {conn.refresh_interval_minutes > 0 ? `${conn.refresh_interval_minutes}min` : 'Manual'}
                  </p>
                  {conn.last_refreshed && (
                    <p className="text-[10px] text-gray-400">Last: {new Date(conn.last_refreshed).toLocaleString()}</p>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {tab === 'formulas' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">Available ERP formulas for spreadsheets:</p>
            {(formulasData?.formulas || []).map((f) => (
              <div key={f.name} className="p-2 bg-gray-50 dark:bg-gray-950 rounded-[6px]">
                <code className="text-xs font-mono text-[#51459d]">{f.name}</code>
                <p className="text-[10px] text-gray-400 mt-0.5">{f.description}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'evaluate' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Test an ERP formula:</p>
            <input
              value={evalInput}
              onChange={(e) => setEvalInput(e.target.value)}
              placeholder="ERP.REVENUE"
              className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
            <button
              onClick={handleEvaluate}
              disabled={evalFormula.isPending}
              className="w-full py-2 text-xs bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
            >
              {evalFormula.isPending ? 'Evaluating...' : 'Evaluate'}
            </button>
            {evalResult && (
              <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-[8px]">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                  Result: {String((evalResult as Record<string, unknown>).value ?? 'N/A')}
                </p>
                <p className="text-[10px] text-green-600 dark:text-green-500 mt-1">
                  {(evalResult as Record<string, unknown>).label as string}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
