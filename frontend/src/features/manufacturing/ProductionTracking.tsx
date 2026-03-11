import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn, Button, Badge, Card, Spinner } from '../../components/ui'
import apiClient from '../../api/client'
import {
  type WorkOrder,
  type ManufacturingStats,
} from '../../api/manufacturing'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '-'
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : new Date()
  const diffMs = endDate.getTime() - startDate.getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes}m`
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'High', color: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'Low', color: 'bg-green-100 text-green-700' },
}

export default function ProductionTracking() {
  const navigate = useNavigate()

  // Fetch in-progress work orders with auto-refresh every 30 seconds
  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['manufacturing', 'work-orders', { status: 'in_progress', limit: 50 }],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; work_orders: WorkOrder[] }>(
        '/manufacturing/work-orders',
        { params: { status: 'in_progress', limit: 50 } }
      )
      return data
    },
    refetchInterval: 30000,
  })

  // Also fetch planned orders with auto-refresh
  const { data: plannedData } = useQuery({
    queryKey: ['manufacturing', 'work-orders', { status: 'planned', limit: 20 }],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; work_orders: WorkOrder[] }>(
        '/manufacturing/work-orders',
        { params: { status: 'planned', limit: 20 } }
      )
      return data
    },
    refetchInterval: 30000,
  })

  // Stats with auto-refresh every 30s
  const { isLoading: statsLoading } = useQuery({
    queryKey: ['manufacturing', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<ManufacturingStats>('/manufacturing/dashboard/stats')
      return data
    },
    refetchInterval: 30000,
  })

  const activeOrders = activeData?.work_orders ?? []
  const plannedOrders = plannedData?.work_orders ?? []
  const totalActive = activeOrders.length

  // Calculate aggregates
  const totalPlannedQty = activeOrders.reduce((s, wo) => s + wo.planned_quantity, 0)
  const totalCompletedQty = activeOrders.reduce((s, wo) => s + wo.completed_quantity, 0)
  const overallCompletion = totalPlannedQty > 0 ? Math.round((totalCompletedQty / totalPlannedQty) * 100) : 0

  if (activeLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Production Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time view of work orders in progress
            <span className="ml-2 text-xs text-gray-400">(auto-refreshes every 30s)</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/manufacturing')}>
            Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/manufacturing/work-orders')}>
            All Work Orders
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-orange-50 text-orange-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Active Orders</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalActive}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-blue-50 text-blue-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Overall Progress</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{overallCompletion}%</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-green-50 text-green-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Units Completed</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalCompletedQty} / {totalPlannedQty}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-purple-50 text-purple-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Queued (Planned)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{plannedOrders.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Overall Progress Bar */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Production Completion</h2>
          <span className="text-sm font-bold text-primary">{overallCompletion}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-[#6fd943] rounded-full transition-all duration-500"
            style={{ width: `${overallCompletion}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>{totalCompletedQty} completed</span>
          <span>{totalPlannedQty - totalCompletedQty} remaining</span>
        </div>
      </Card>

      {/* Active Work Orders Grid */}
      {activeOrders.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">In-Progress Work Orders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeOrders.map((wo) => (
              <WorkOrderCard key={wo.id} workOrder={wo} onClick={() => navigate(`/manufacturing/work-orders/${wo.id}`)} />
            ))}
          </div>
        </div>
      ) : (
        <Card className="text-center py-12">
          <svg className="h-12 w-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
          <p className="text-gray-500">No work orders currently in progress</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/manufacturing/work-orders')}>
            View All Work Orders
          </Button>
        </Card>
      )}

      {/* Planned Queue */}
      {plannedOrders.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Up Next (Planned)</h2>
          <Card padding={false}>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {plannedOrders.slice(0, 5).map((wo) => (
                <div
                  key={wo.id}
                  onClick={() => navigate(`/manufacturing/work-orders/${wo.id}`)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-primary">{wo.wo_number}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{wo.finished_item_name ?? '-'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">Qty: {wo.planned_quantity}</span>
                    <Badge variant={PRIORITY_CONFIG[wo.priority] ? (wo.priority === 'high' ? 'danger' : wo.priority === 'medium' ? 'warning' : 'default') : 'default'}>
                      {wo.priority}
                    </Badge>
                    {wo.planned_start && (
                      <span className="text-xs text-gray-400">Start: {formatDate(wo.planned_start)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── WorkOrderCard ───────────────────────────────────────────────────────────

function WorkOrderCard({ workOrder: wo, onClick }: { workOrder: WorkOrder; onClick: () => void }) {
  const completion = wo.planned_quantity > 0
    ? Math.round((wo.completed_quantity / wo.planned_quantity) * 100)
    : 0

  const elapsed = formatDuration(wo.actual_start, null)
  const plannedDuration = formatDuration(wo.planned_start, wo.planned_end)
  const priority = PRIORITY_CONFIG[wo.priority] ?? PRIORITY_CONFIG.medium

  // Check if behind schedule
  const isBehindSchedule = wo.planned_end && new Date(wo.planned_end) < new Date()

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-[10px] border shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden',
        isBehindSchedule ? 'border-red-200' : 'border-gray-100 dark:border-gray-700'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary">{wo.wo_number}</span>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', priority.color)}>
            {priority.label}
          </span>
        </div>
        {isBehindSchedule && (
          <Badge variant="danger" className="text-[9px]">Overdue</Badge>
        )}
      </div>

      {/* Product */}
      <div className="px-4 pb-2">
        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">{wo.finished_item_name ?? 'Unknown Product'}</p>
        {wo.bom_name && <p className="text-xs text-gray-400 truncate">BOM: {wo.bom_name}</p>}
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">
            {wo.completed_quantity} / {wo.planned_quantity} units
          </span>
          <span className={cn('text-xs font-semibold', completion >= 80 ? 'text-green-600' : completion >= 50 ? 'text-yellow-600' : 'text-gray-600 dark:text-gray-400')}>
            {completion}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              completion >= 80 ? 'bg-green-500' : completion >= 50 ? 'bg-yellow-500' : 'bg-primary'
            )}
            style={{ width: `${Math.min(completion, 100)}%` }}
          />
        </div>
        {wo.rejected_quantity > 0 && (
          <p className="text-[10px] text-red-500 mt-0.5">{wo.rejected_quantity} rejected</p>
        )}
      </div>

      {/* Time Info */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-400">Elapsed</span>
          <p className="font-medium text-gray-700 dark:text-gray-300">{elapsed}</p>
        </div>
        <div>
          <span className="text-gray-400">Planned Duration</span>
          <p className="font-medium text-gray-700 dark:text-gray-300">{plannedDuration}</p>
        </div>
      </div>

      {/* Operator */}
      {wo.assigned_to && (
        <div className="px-4 py-2 border-t border-gray-50 dark:border-gray-700 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400">Operator: {wo.assigned_to}</span>
        </div>
      )}
    </div>
  )
}
