import { useState } from 'react'
import { Card, Select, Badge } from '../../components/ui'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface IoTDataPoint {
  id: string
  workstation_id: string | null
  metric_name: string
  metric_value: number
  unit: string | null
  source: string | null
  timestamp: string
}

function useIoTData(metricName?: string, hours = 1) {
  return useQuery({
    queryKey: ['iot-data', metricName, hours],
    queryFn: () =>
      apiClient
        .get<IoTDataPoint[]>('/manufacturing/iot/data', { params: { metric_name: metricName, hours } })
        .then(r => r.data),
    refetchInterval: 10000, // refresh every 10s
  })
}

function MiniChart({ points }: { points: IoTDataPoint[] }) {
  if (points.length < 2) return <div className="text-gray-400 text-xs">Not enough data</div>

  const values = points.map(p => Number(p.metric_value))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const width = 200
  const height = 50
  const pts = points.slice(-40).map((p, i) => {
    const x = (i / (Math.min(points.length, 40) - 1)) * width
    const y = height - ((Number(p.metric_value) - min) / range) * height
    return `${x},${y}`
  })

  const latest = values[values.length - 1]
  const trend = values.length > 1 ? (values[values.length - 1] > values[values.length - 2] ? '↑' : values[values.length - 1] < values[values.length - 2] ? '↓' : '→') : '→'

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} className="overflow-visible">
        <polyline points={pts.join(' ')} fill="none" stroke="#51459d" strokeWidth="1.5" />
        <circle cx={pts[pts.length - 1]?.split(',')[0]} cy={pts[pts.length - 1]?.split(',')[1]} r="3" fill="#51459d" />
      </svg>
      <div className="text-right">
        <div className="text-lg font-bold">{latest.toFixed(2)}</div>
        <div className="text-xs text-gray-500">{trend}</div>
      </div>
    </div>
  )
}

export default function IoTDashboard() {
  const [hours, setHours] = useState(1)
  const { data: points, isLoading } = useIoTData(undefined, hours)

  // Group by metric_name
  const byMetric: Record<string, IoTDataPoint[]> = {}
  points?.forEach(p => {
    byMetric[p.metric_name] = byMetric[p.metric_name] || []
    byMetric[p.metric_name].push(p)
  })

  const metrics = Object.keys(byMetric)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IoT Dashboard</h1>
          <div className="text-xs text-gray-400">Auto-refreshes every 10s</div>
        </div>
        <Select value={String(hours)} onChange={e => setHours(Number(e.target.value))} className="w-36">
          <option value="1">Last Hour</option>
          <option value="4">Last 4 Hours</option>
          <option value="8">Last 8 Hours</option>
          <option value="24">Last 24 Hours</option>
        </Select>
      </div>

      {isLoading && <Card className="p-8 text-center">Loading sensor data...</Card>}

      {!isLoading && metrics.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          No IoT data received. Use the POST /manufacturing/iot/ingest endpoint to push sensor data.
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {metrics.map(metric => {
          const metricPoints = byMetric[metric]
          const latest = metricPoints[metricPoints.length - 1]
          const sources = [...new Set(metricPoints.map(p => p.source).filter(Boolean))]

          return (
            <Card key={metric} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{metric}</div>
                  <div className="text-xs text-gray-400">{metricPoints.length} data points</div>
                </div>
                <div className="text-right">
                  {latest?.unit && <Badge variant="default" className="text-xs">{latest.unit}</Badge>}
                  {sources.length > 0 && <div className="text-xs text-gray-400 mt-1">{sources.join(', ')}</div>}
                </div>
              </div>
              <MiniChart points={metricPoints} />
              <div className="text-xs text-gray-400">
                Last: {latest ? new Date(latest.timestamp).toLocaleTimeString() : '—'}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
