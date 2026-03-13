import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Badge, Select, Input, Spinner, toast } from '../../components/ui'
import apiClient from '@/api/client'

interface ProductionSchedule {
  id: string
  product_name: string
  sku: string
  work_center: string
  planned_qty: number
  produced_qty: number
  scheduled_start: string
  scheduled_end: string
  status: string
  priority: number
}

const statusVariant: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  planned: 'default',
  released: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
  on_hold: 'warning',
}

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'released', label: 'Released' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
]

function getDateRange(schedules: ProductionSchedule[]): { min: Date; max: Date } {
  const dates = schedules.flatMap((s) => [new Date(s.scheduled_start), new Date(s.scheduled_end)])
  return {
    min: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date(),
    max: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date(),
  }
}

function GanttBar({ schedule, min, totalMs }: { schedule: ProductionSchedule; min: Date; totalMs: number }) {
  const start = new Date(schedule.scheduled_start)
  const end = new Date(schedule.scheduled_end)
  const leftPct = totalMs > 0 ? ((start.getTime() - min.getTime()) / totalMs) * 100 : 0
  const widthPct = totalMs > 0 ? ((end.getTime() - start.getTime()) / totalMs) * 100 : 5
  const progressPct = schedule.planned_qty > 0 ? (schedule.produced_qty / schedule.planned_qty) * 100 : 0

  return (
    <div className="relative h-5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
      <div
        className="absolute h-full bg-primary/30 rounded"
        style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.max(2, widthPct)}%` }}
      >
        <div
          className="absolute left-0 top-0 h-full bg-primary rounded transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}

export default function ProductionSchedulePage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [workCenterFilter, setWorkCenterFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sc', 'production-schedules', statusFilter, workCenterFilter, dateFrom],
    queryFn: () =>
      apiClient
        .get('/supply-chain/mrp/production-schedules', {
          params: {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(workCenterFilter ? { work_center: workCenterFilter } : {}),
            ...(dateFrom ? { date_from: dateFrom } : {}),
          },
        })
        .then((r) => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/supply-chain/mrp/production-schedules/${id}`, { status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sc', 'production-schedules'] })
      toast('success', 'Status updated')
      setUpdatingId(null)
    },
    onError: () => toast('error', 'Failed to update status'),
  })

  const schedules: ProductionSchedule[] = data?.items ?? data ?? []
  const { min, max } = getDateRange(schedules)
  const totalMs = max.getTime() - min.getTime() || 1

  const workCenters = Array.from(new Set(schedules.map((s) => s.work_center))).sort()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Production Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-1">Timeline view of production orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[{ value: '', label: 'All Statuses' }, ...STATUS_OPTIONS]}
        />
        <Select
          value={workCenterFilter}
          onChange={(e) => setWorkCenterFilter(e.target.value)}
          options={[
            { value: '', label: 'All Work Centers' },
            ...workCenters.map((wc) => ({ value: wc, label: wc })),
          ]}
        />
        <Input
          type="date"
          label="From"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : schedules.length === 0 ? (
        <Card>
          <p className="text-center text-gray-400 py-8">No production schedules found</p>
        </Card>
      ) : (
        <Card padding={false}>
          {/* Date Range Header */}
          {schedules.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between text-xs text-gray-500">
              <span>{min.toLocaleDateString()}</span>
              <span className="font-medium text-gray-600 dark:text-gray-400">Timeline</span>
              <span>{max.toLocaleDateString()}</span>
            </div>
          )}

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {schedules.map((s) => (
              <div key={s.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="grid grid-cols-12 gap-3 items-center">
                  {/* Product Info */}
                  <div className="col-span-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {s.product_name}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{s.sku}</p>
                  </div>

                  {/* Work Center */}
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Work Center</p>
                    <p className="text-sm font-medium truncate">{s.work_center}</p>
                  </div>

                  {/* Qty */}
                  <div className="col-span-1 text-center">
                    <p className="text-xs text-gray-500">Qty</p>
                    <p className="text-sm font-medium">
                      {s.produced_qty}/{s.planned_qty}
                    </p>
                  </div>

                  {/* Gantt */}
                  <div className="col-span-4">
                    <GanttBar schedule={s} min={min} totalMs={totalMs} />
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>{new Date(s.scheduled_start).toLocaleDateString()}</span>
                      <span>{new Date(s.scheduled_end).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    {updatingId === s.id ? (
                      <Select
                        value={s.status}
                        onChange={(e) => {
                          updateStatus.mutate({ id: s.id, status: e.target.value })
                        }}
                        options={STATUS_OPTIONS}
                      />
                    ) : (
                      <button
                        onClick={() => setUpdatingId(s.id)}
                        className="w-full text-left"
                        title="Click to change status"
                      >
                        <Badge variant={statusVariant[s.status] ?? 'default'}>
                          {s.status.replace(/_/g, ' ')}
                        </Badge>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Legend */}
      <div className="flex gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-2 rounded bg-primary/30" />
          <span>Scheduled range</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-2 rounded bg-primary" />
          <span>Completed portion</span>
        </div>
      </div>
    </div>
  )
}
