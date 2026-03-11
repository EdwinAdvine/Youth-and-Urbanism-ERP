import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table } from '../../components/ui'
import {
  useManufacturingStats,
  useWorkOrders,
  type WorkOrder,
} from '../../api/manufacturing'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'default' | 'success' | 'danger' | 'info' | 'warning'> = {
  draft: 'default',
  planned: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

const PRIORITY_BADGE: Record<string, 'default' | 'success' | 'danger' | 'warning'> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
}

export default function ManufacturingDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useManufacturingStats()
  const { data: activeWOs, isLoading: wosLoading } = useWorkOrders({ status: 'in_progress', limit: 10 })

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Active BOMs',
      value: String(stats?.total_boms ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      color: 'text-primary bg-primary/10',
    },
    {
      label: 'In Progress',
      value: String(stats?.wo_in_progress ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: (stats?.wo_in_progress ?? 0) > 0 ? 'text-orange-600 bg-orange-50' : 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950',
    },
    {
      label: 'Material Cost (WIP)',
      value: formatCurrency(stats?.in_progress_material_cost ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Defect Rate',
      value: `${stats?.defect_rate_percent ?? 0}%`,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: (stats?.defect_rate_percent ?? 0) > 5 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50',
    },
  ]

  const woColumns = [
    {
      key: 'wo_number',
      label: 'WO #',
      render: (row: WorkOrder) => <span className="font-medium text-primary">{row.wo_number}</span>,
    },
    {
      key: 'finished_item_name',
      label: 'Product',
      render: (row: WorkOrder) => <span className="text-gray-700 dark:text-gray-300">{row.finished_item_name ?? '-'}</span>,
    },
    {
      key: 'planned_quantity',
      label: 'Qty',
      render: (row: WorkOrder) => (
        <span>
          {row.completed_quantity}/{row.planned_quantity}
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row: WorkOrder) => <Badge variant={PRIORITY_BADGE[row.priority] ?? 'default'}>{row.priority}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: WorkOrder) => <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>{row.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: WorkOrder) => formatDate(row.created_at),
    },
  ]

  // Summary counts row
  const woCounts = [
    { label: 'Draft', count: stats?.wo_draft ?? 0, color: 'text-gray-600' },
    { label: 'Planned', count: stats?.wo_planned ?? 0, color: 'text-blue-600' },
    { label: 'In Progress', count: stats?.wo_in_progress ?? 0, color: 'text-orange-600' },
    { label: 'Completed', count: stats?.wo_completed ?? 0, color: 'text-green-600' },
    { label: 'Cancelled', count: stats?.wo_cancelled ?? 0, color: 'text-red-600' },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manufacturing</h1>
          <p className="text-sm text-gray-500 mt-1">Production planning, BOMs, and work orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/manufacturing/bom')}>
            BOMs
          </Button>
          <Button onClick={() => navigate('/manufacturing/work-orders')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Work Order
          </Button>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'Bills of Materials', path: '/manufacturing/bom' },
          { label: 'Work Stations', path: '/manufacturing/workstations' },
          { label: 'Work Orders', path: '/manufacturing/work-orders' },
          { label: 'Production Tracking', path: '/manufacturing/production-tracking' },
          { label: 'Quality Checks', path: '/manufacturing/quality-checks' },
        ].map((item) => (
          <Button key={item.path} variant="outline" size="sm" onClick={() => navigate(item.path)}>
            {item.label}
          </Button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-start gap-4">
              <div className={cn('p-3 rounded-[10px]', stat.color)}>
                {stat.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate mt-1">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* WO Status Summary */}
      <Card className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Work Order Summary</h2>
        <div className="flex flex-wrap gap-6">
          {woCounts.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={cn('text-2xl font-bold', item.color)}>{item.count}</span>
              <span className="text-sm text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Active Work Orders */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Active Work Orders</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/work-orders')}>
            View All
          </Button>
        </div>
        <Table<WorkOrder>
          columns={woColumns}
          data={activeWOs?.work_orders ?? []}
          loading={wosLoading}
          emptyText="No active work orders"
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  )
}
