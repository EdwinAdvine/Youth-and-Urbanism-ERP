import { useState } from 'react'
import {
  useAuditLog,
  useAuditStats,
  type AuditLogEntry,
} from '@/api/crm_collaboration'
import { Badge, Card, Spinner, Input, Select, Table } from '@/components/ui'

const ACTION_VARIANTS: Record<string, string> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  view: 'default',
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'view', label: 'View' },
]

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Entity Types' },
  { value: 'contact', label: 'Contact' },
  { value: 'deal', label: 'Deal' },
  { value: 'lead', label: 'Lead' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'quote', label: 'Quote' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'custom_object', label: 'Custom Object' },
]

const ACTION_COLORS: Record<string, string> = {
  create: '#6fd943',
  update: '#3ec9d6',
  delete: '#ff3a6e',
  view: '#9ca3af',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

export default function AuditLogPage() {
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const queryParams: Record<string, unknown> = {}
  if (entityTypeFilter) queryParams.entity_type = entityTypeFilter
  if (actionFilter) queryParams.action = actionFilter
  if (userIdFilter) queryParams.user_id = userIdFilter
  if (startDate) queryParams.start_date = startDate
  if (endDate) queryParams.end_date = endDate

  const { data: logData, isLoading } = useAuditLog(queryParams)
  const { data: statsData } = useAuditStats(queryParams)

  const entries: AuditLogEntry[] = logData?.items ?? logData ?? []
  const stats: Record<string, number> = statsData ?? {}

  // Compute total for stats bar
  const statTotal = Object.values(stats).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)

  const columns = [
    {
      key: 'entity_type',
      label: 'Entity Type',
      render: (row: AuditLogEntry) => (
        <button
          className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize hover:text-[#51459d] cursor-pointer"
          onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
        >
          {row.entity_type}
        </button>
      ),
    },
    {
      key: 'entity_id',
      label: 'Entity ID',
      render: (row: AuditLogEntry) => (
        <span className="text-xs text-gray-500 font-mono" title={row.entity_id}>
          {row.entity_id.slice(0, 12)}...
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row: AuditLogEntry) => (
        <Badge variant={(ACTION_VARIANTS[row.action] ?? 'default') as 'primary' | 'danger' | 'default' | 'success' | 'warning' | 'info'}>
          {row.action}
        </Badge>
      ),
    },
    {
      key: 'user_id',
      label: 'User',
      render: (row: AuditLogEntry) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
          {row.user_id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Timestamp',
      render: (row: AuditLogEntry) => (
        <span className="text-sm text-gray-500">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (row: AuditLogEntry) => (
        <span className="text-xs text-gray-400">{row.ip_address ?? '---'}</span>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Track all changes and actions across CRM records</p>
      </div>

      {/* Stats Bar */}
      {statTotal > 0 && (
        <Card>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Action Distribution
          </h3>
          <div className="flex items-center gap-1 h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
            {Object.entries(stats).map(([action, count]) => {
              if (typeof count !== 'number' || count === 0) return null
              const pct = (count / statTotal) * 100
              return (
                <div
                  key={action}
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: ACTION_COLORS[action] ?? '#9ca3af',
                    minWidth: pct > 0 ? '2px' : '0',
                  }}
                  title={`${action}: ${count}`}
                />
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-2">
            {Object.entries(stats).map(([action, count]) => {
              if (typeof count !== 'number') return null
              return (
                <div key={action} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: ACTION_COLORS[action] ?? '#9ca3af' }}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                    {action}
                  </span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Filter Bar */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Select
            label="Entity Type"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            options={ENTITY_TYPE_OPTIONS}
          />
          <Select
            label="Action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            options={ACTION_OPTIONS}
          />
          <Input
            label="User ID"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            placeholder="Filter by user..."
          />
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={entries}
              loading={isLoading}
              emptyText="No audit log entries found"
              keyExtractor={(row) => row.id}
            />

            {/* Expanded changes detail */}
            {expandedId && (() => {
              const entry = entries.find((e) => e.id === expandedId)
              if (!entry?.changes) return null

              const changes = entry.changes as Record<string, { old?: unknown; new?: unknown }>
              const changeKeys = Object.keys(changes)

              return (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    Changes Detail
                  </h4>
                  {changeKeys.length === 0 ? (
                    <pre className="text-xs bg-white dark:bg-gray-800 rounded-[10px] p-3 overflow-auto max-h-40 border border-gray-200 dark:border-gray-700">
                      {JSON.stringify(entry.changes, null, 2)}
                    </pre>
                  ) : (
                    <div className="space-y-2">
                      {changeKeys.map((field) => {
                        const change = changes[field]
                        return (
                          <div
                            key={field}
                            className="flex items-start gap-3 text-sm bg-white dark:bg-gray-800 rounded-[10px] p-3 border border-gray-200 dark:border-gray-700"
                          >
                            <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[120px]">
                              {field}
                            </span>
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-[#ff3a6e] line-through text-xs">
                                {change?.old != null ? JSON.stringify(change.old) : 'null'}
                              </span>
                              <span className="text-gray-400">&rarr;</span>
                              <span className="text-[#6fd943] text-xs">
                                {change?.new != null ? JSON.stringify(change.new) : 'null'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {entry.user_agent && (
                    <p className="text-xs text-gray-400 mt-2">
                      User Agent: {entry.user_agent}
                    </p>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </Card>
    </div>
  )
}
