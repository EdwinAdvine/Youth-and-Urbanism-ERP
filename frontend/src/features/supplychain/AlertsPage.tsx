import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Pagination, Input, toast,
} from '../../components/ui'
import {
  useAlerts, useAcknowledgeAlert, useResolveAlert,
  type SCAlert,
} from '../../api/supplychain_ops'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })
}

const SEVERITY_BADGE: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [filterSeverity, setFilterSeverity] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useAlerts({
    severity: filterSeverity || undefined,
    status: filterStatus || undefined,
    alert_type: filterType || undefined,
    skip,
    limit,
  })

  const acknowledgeMutation = useAcknowledgeAlert()
  const resolveMutation = useResolveAlert()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const handleAcknowledge = async (alert: SCAlert) => {
    try {
      await acknowledgeMutation.mutateAsync(alert.id)
      toast('success', 'Alert acknowledged')
    } catch {
      toast('error', 'Failed to acknowledge alert')
    }
  }

  const handleResolve = async (alert: SCAlert) => {
    try {
      await resolveMutation.mutateAsync(alert.id)
      toast('success', 'Alert resolved')
    } catch {
      toast('error', 'Failed to resolve alert')
    }
  }

  const columns = [
    {
      key: 'severity',
      label: 'Severity',
      render: (row: SCAlert) => (
        <Badge variant={SEVERITY_BADGE[row.severity] ?? 'default'}>
          {row.severity}
        </Badge>
      ),
    },
    {
      key: 'alert_number',
      label: 'Alert #',
      render: (row: SCAlert) => (
        <span className="font-medium text-[#51459d]">{row.alert_number}</span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (row: SCAlert) => (
        <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs block">{row.title}</span>
      ),
    },
    {
      key: 'alert_type',
      label: 'Type',
      render: (row: SCAlert) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">{row.alert_type}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: SCAlert) => (
        <Badge
          variant={
            row.status === 'resolved' ? 'success'
            : row.status === 'acknowledged' ? 'info'
            : row.status === 'dismissed' ? 'default'
            : 'warning'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: SCAlert) => (
        <div>
          <span className="text-gray-500 text-xs block">{formatDate(row.created_at)}</span>
          <span className="text-gray-400 text-xs">{formatTime(row.created_at)}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: SCAlert) => (
        <div className="flex items-center gap-1">
          {row.status === 'open' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAcknowledge(row)}
              loading={acknowledgeMutation.isPending}
              className="text-[#3ec9d6] hover:text-[#2db0bd]"
            >
              Acknowledge
            </Button>
          )}
          {(row.status === 'open' || row.status === 'acknowledged') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleResolve(row)}
              loading={resolveMutation.isPending}
              className="text-[#6fd943] hover:text-[#5ec736]"
            >
              Resolve
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain/control-tower')}>
            Control Tower
          </Button>
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterSeverity}
          onChange={(e) => { setFilterSeverity(e.target.value); setPage(1) }}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <Input
          placeholder="Filter by type..."
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
          className="w-48"
        />
        <span className="text-sm text-gray-500">{data?.total ?? 0} alerts</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<SCAlert>
          columns={columns}
          data={data?.alerts ?? []}
          loading={isLoading}
          emptyText="No alerts found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>
    </div>
  )
}
