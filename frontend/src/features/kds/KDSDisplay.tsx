import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Badge, Select, Spinner } from '@/components/ui'
import {
  useKDSStations,
  useKDSOrders,
  useStartKDSOrder,
  useReadyKDSOrder,
  useServedKDSOrder,
  useCancelKDSOrder,
  type KDSOrder,
} from '@/api/kds'
import KDSOrderCard from './KDSOrderCard'

type FilterTab = 'all' | 'new' | 'in_progress' | 'ready'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'ready', label: 'Ready' },
]

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.3
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
    // Play a second beep after a short pause
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.value = 1100
    gain2.gain.value = 0.3
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(ctx.currentTime + 0.2)
    osc2.stop(ctx.currentTime + 0.35)
    setTimeout(() => ctx.close(), 500)
  } catch {
    // AudioContext not available — silently ignore
  }
}

function computeAvgCompletionMinutes(orders: KDSOrder[]): string {
  const completed = orders.filter((o) => o.completed_at && o.started_at)
  if (completed.length === 0) return '--'
  const totalMs = completed.reduce((sum, o) => {
    return sum + (new Date(o.completed_at!).getTime() - new Date(o.started_at!).getTime())
  }, 0)
  const avgMin = totalMs / completed.length / 60000
  return `${avgMin.toFixed(1)}m`
}

export default function KDSDisplay() {
  const [selectedStationId, setSelectedStationId] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const prevOrderCountRef = useRef<number | null>(null)

  const { data: stations, isLoading: stationsLoading } = useKDSStations()
  const { data: orders } = useKDSOrders(selectedStationId)

  const startOrder = useStartKDSOrder()
  const readyOrder = useReadyKDSOrder()
  const servedOrder = useServedKDSOrder()
  const cancelOrder = useCancelKDSOrder()

  // Auto-select first station
  useEffect(() => {
    if (!selectedStationId && stations && stations.length > 0) {
      const active = stations.find((s) => s.is_active)
      if (active) setSelectedStationId(active.id)
    }
  }, [stations, selectedStationId])

  // Audio notification on new orders
  useEffect(() => {
    if (!orders) return
    const activeCount = orders.filter((o) => o.status === 'new').length
    if (prevOrderCountRef.current !== null && activeCount > prevOrderCountRef.current) {
      playBeep()
    }
    prevOrderCountRef.current = activeCount
  }, [orders])

  // Sort and filter
  const filteredOrders = useMemo(() => {
    if (!orders) return []
    let list = [...orders]
    if (filter !== 'all') {
      list = list.filter((o) => o.status === filter)
    }
    list.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    return list
  }, [orders, filter])

  const activeOrders = useMemo(
    () => (orders ?? []).filter((o) => o.status !== 'served' && o.status !== 'cancelled'),
    [orders]
  )

  const selectedStation = stations?.find((s) => s.id === selectedStationId)

  const handleStart = useCallback((id: string) => startOrder.mutate(id), [startOrder])
  const handleReady = useCallback((id: string) => readyOrder.mutate(id), [readyOrder])
  const handleServed = useCallback((id: string) => servedOrder.mutate(id), [servedOrder])
  const handleCancel = useCallback((id: string) => cancelOrder.mutate(id), [cancelOrder])

  const stationOptions = (stations ?? [])
    .filter((s) => s.is_active)
    .map((s) => ({ value: s.id, label: s.name }))

  if (stationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kitchen Display</h1>
          <div className="w-56">
            <Select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              options={[{ value: '', label: 'Select station...' }, ...stationOptions]}
            />
          </div>
        </div>

        {selectedStation && (
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-gray-100">{selectedStation.name}</span>
              {' '}&middot;{' '}
              <span className="capitalize">{selectedStation.station_type}</span>
            </div>
            <Badge variant="primary">{activeOrders.length} active</Badge>
            <Badge variant="default">Avg {computeAvgCompletionMinutes(orders ?? [])}</Badge>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      {selectedStationId && (
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? (orders ?? []).length
                : (orders ?? []).filter((o) => o.status === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  filter === tab.key
                    ? 'border-[#51459d] text-[#51459d]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs text-gray-400">({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Order grid */}
      {!selectedStationId ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-gray-400">
          <svg className="h-16 w-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Select a station to view orders</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-gray-400">
          <p className="text-sm">No orders to display</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredOrders.map((order) => (
            <KDSOrderCard
              key={order.id}
              order={order}
              onStart={handleStart}
              onReady={handleReady}
              onServed={handleServed}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}
