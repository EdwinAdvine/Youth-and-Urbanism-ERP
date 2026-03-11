import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Spinner } from '../../components/ui'
import {
  useWorkStations,
  useWorkOrders,
  type WorkStation,
  type WorkOrder,
} from '../../api/manufacturing'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

// ---- Workstation Status Card ----

function WorkstationCard({
  station,
  currentOrder,
  isSelected,
  onSelect,
}: {
  station: WorkStation
  currentOrder?: WorkOrder
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-[10px] border-2 p-4 sm:p-5 transition-all active:scale-[0.98] ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-md'
          : currentOrder
            ? 'border-yellow-300 bg-yellow-50/50 hover:border-primary'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${currentOrder ? 'bg-yellow-500 animate-pulse' : station.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">{station.code}</span>
        </div>
        <Badge variant={station.is_active ? 'success' : 'default'}>
          {currentOrder ? 'Running' : station.is_active ? 'Idle' : 'Inactive'}
        </Badge>
      </div>
      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{station.name}</p>
      {station.description && (
        <p className="text-xs text-gray-500 mt-1 truncate">{station.description}</p>
      )}
      {currentOrder && (
        <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg p-2 border border-yellow-200">
          <p className="text-xs text-gray-500">Current: <span className="font-medium text-gray-900 dark:text-gray-100">{currentOrder.wo_number}</span></p>
          <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-1.5 mt-1">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (currentOrder.completed_quantity / currentOrder.planned_quantity) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </button>
  )
}

// ---- Workstation Detail Panel ----

function WorkstationDetail({
  station,
  orders,
}: {
  station: WorkStation
  orders: WorkOrder[]
}) {
  const activeOrders = orders.filter((o) => o.workstation_id === station.id)
  const inProgressOrders = activeOrders.filter((o) => o.status === 'in_progress')
  const queuedOrders = activeOrders.filter((o) => o.status === 'planned' || o.status === 'draft')

  const currentOrder = inProgressOrders[0]

  return (
    <div className="space-y-4">
      {/* Station header */}
      <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${currentOrder ? 'bg-yellow-500 animate-pulse' : station.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{station.name}</h2>
          </div>
          <span className="font-mono text-sm text-primary font-medium">{station.code}</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3">
            <p className="text-xs text-gray-500">Capacity/hr</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{station.capacity_per_hour ?? '--'}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3">
            <p className="text-xs text-gray-500">Hourly Rate</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(station.hourly_rate)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3">
            <p className="text-xs text-gray-500">Queue</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{queuedOrders.length}</p>
          </div>
        </div>
      </div>

      {/* Current work order */}
      {currentOrder ? (
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border-2 border-yellow-300 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <h3 className="text-sm font-bold text-yellow-800">CURRENTLY RUNNING</h3>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-bold text-primary">{currentOrder.wo_number}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[currentOrder.status]}`}>
              {currentOrder.status.replace('_', ' ')}
            </span>
          </div>

          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {currentOrder.finished_item_name ?? 'Product'}
          </p>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Progress</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {currentOrder.completed_quantity} / {currentOrder.planned_quantity}
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-4">
              <div
                className="h-full rounded-full bg-primary transition-all flex items-center justify-center"
                style={{ width: `${Math.min(100, (currentOrder.completed_quantity / currentOrder.planned_quantity) * 100)}%` }}
              >
                {currentOrder.planned_quantity > 0 && (
                  <span className="text-[10px] font-bold text-white">
                    {((currentOrder.completed_quantity / currentOrder.planned_quantity) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-xs text-blue-600">Planned</p>
              <p className="text-lg font-bold text-blue-900">{currentOrder.planned_quantity}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-xs text-green-600">Completed</p>
              <p className="text-lg font-bold text-green-900">{currentOrder.completed_quantity}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-xs text-red-600">Rejected</p>
              <p className="text-lg font-bold text-red-900">{currentOrder.rejected_quantity}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-2">
              <p className="text-xs text-gray-500">Remaining</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {currentOrder.planned_quantity - currentOrder.completed_quantity}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
            <div>
              <p>Started: {formatDateTime(currentOrder.actual_start)}</p>
            </div>
            <div>
              <p>Material Cost: {formatCurrency(currentOrder.total_material_cost)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-8 text-center">
          <svg className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-gray-500 font-medium">No active work order</p>
          <p className="text-gray-400 text-sm mt-1">This workstation is currently idle</p>
        </div>
      )}

      {/* Queued orders */}
      {queuedOrders.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Queue ({queuedOrders.length})</h3>
          <div className="space-y-2">
            {queuedOrders.map((wo, idx) => (
              <div key={wo.id} className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-500 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{wo.wo_number}</p>
                  <p className="text-xs text-gray-500 truncate">{wo.finished_item_name ?? 'Product'}</p>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{wo.planned_quantity} units</span>
                <Badge variant={wo.priority === 'high' ? 'danger' : wo.priority === 'medium' ? 'warning' : 'default'}>
                  {wo.priority}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Main Component ----

export default function WorkstationTablet() {
  const navigate = useNavigate()
  const { data: workstations, isLoading: wsLoading, refetch: refetchWS } = useWorkStations()
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useWorkOrders({ limit: 200 })

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      refetchWS()
      refetchOrders()
      setLastRefresh(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [refetchWS, refetchOrders])

  const allOrders = ordersData?.work_orders ?? []
  const selectedStation = (workstations ?? []).find((ws) => ws.id === selectedStationId) ?? null

  // Find current order per station
  const getStationCurrentOrder = (stationId: string) => {
    return allOrders.find((o) => o.workstation_id === stationId && o.status === 'in_progress')
  }

  const isLoading = wsLoading || ordersLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/manufacturing/workstations')}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-[10px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Workstation Dashboard</h1>
            <p className="text-xs text-gray-400">
              Auto-refreshes every 30s | Last: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={() => { refetchWS(); refetchOrders(); setLastRefresh(new Date()) }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Content: Side-by-side on tablet, stacked on phone */}
      <div className="flex flex-col md:flex-row h-[calc(100vh-64px)]">
        {/* Station list */}
        <div className={`${selectedStation ? 'hidden md:block' : ''} md:w-80 lg:w-96 overflow-auto p-4 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}>
          <p className="text-sm text-gray-500 font-medium mb-3">
            {(workstations ?? []).length} workstation(s)
          </p>
          <div className="space-y-3">
            {(workstations ?? []).map((ws) => (
              <WorkstationCard
                key={ws.id}
                station={ws}
                currentOrder={getStationCurrentOrder(ws.id)}
                isSelected={selectedStationId === ws.id}
                onSelect={() => setSelectedStationId(ws.id)}
              />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-auto p-4">
          {selectedStation ? (
            <>
              {/* Back button on mobile */}
              <button
                onClick={() => setSelectedStationId(null)}
                className="md:hidden flex items-center gap-2 text-sm text-primary font-medium mb-4 min-h-[44px]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                All Workstations
              </button>
              <WorkstationDetail station={selectedStation} orders={allOrders} />
            </>
          ) : (
            <div className="hidden md:flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <svg className="h-16 w-16 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
                <p className="font-medium">Select a workstation</p>
                <p className="text-sm mt-1">Choose a workstation from the left panel to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
