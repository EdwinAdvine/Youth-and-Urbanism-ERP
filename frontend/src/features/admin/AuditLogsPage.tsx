import { useState } from 'react'
import { useAuditLogs } from '../../api/admin'
import { Card, Input, Badge, Table, Pagination } from '../../components/ui'
import type { AuditLog } from '../../types'
import { formatDistanceToNow } from 'date-fns'

const ACTION_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  create: 'success',
  delete: 'danger',
  update: 'warning',
  login: 'info',
  logout: 'default',
  view: 'default',
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const { data, isLoading } = useAuditLogs(page, {
    user_id: userFilter || undefined,
    action: actionFilter || undefined,
  })

  const columns = [
    {
      key: 'created_at',
      label: 'Time',
      render: (log: AuditLog) => (
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {new Date(log.created_at).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </p>
        </div>
      ),
    },
    {
      key: 'user_email',
      label: 'User',
      render: (log: AuditLog) => (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{log.user_email}</p>
          {log.ip_address && (
            <p className="text-xs text-gray-400">{log.ip_address}</p>
          )}
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (log: AuditLog) => (
        <Badge variant={ACTION_COLORS[log.action] ?? 'default'} className="capitalize">
          {log.action}
        </Badge>
      ),
    },
    {
      key: 'resource',
      label: 'Resource',
      render: (log: AuditLog) => (
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{log.resource}</p>
          {log.resource_id && (
            <p className="text-xs text-gray-400">ID: {log.resource_id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'details',
      label: 'Details',
      render: (log: AuditLog) => (
        log.details ? (
          <pre className="text-xs text-gray-500 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
            {JSON.stringify(log.details)}
          </pre>
        ) : <span className="text-gray-400 text-xs">—</span>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Logs</h1>
        <p className="text-gray-500 text-sm mt-0.5">Full history of system activity and changes</p>
      </div>

      {/* Filters */}
      <Card padding={false}>
        <div className="p-4 flex gap-3 border-b border-gray-100 dark:border-gray-800 flex-wrap">
          <Input
            placeholder="Filter by user email…"
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}
            className="max-w-xs"
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
            className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>
          {(userFilter || actionFilter) && (
            <button
              onClick={() => { setUserFilter(''); setActionFilter(''); setPage(1) }}
              className="text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto text-sm text-gray-500 self-center">
            {data && `${data.total} entries`}
          </div>
        </div>

        <Table
          columns={columns}
          data={data?.items ?? []}
          loading={isLoading}
          keyExtractor={(log) => log.id}
          emptyText="No audit log entries found"
        />

        <Pagination
          page={page}
          pages={data?.pages ?? 1}
          total={data?.total ?? 0}
          onChange={setPage}
        />
      </Card>
    </div>
  )
}
