import { useState } from 'react'
import { Card, Badge, Select } from '../../components/ui'
import { useBottleneckAnalysis } from '../../api/manufacturing_ai'

export default function BottleneckAnalysis() {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useBottleneckAnalysis(days)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bottleneck Analysis</h1>
        <Select value={String(days)} onChange={e => setDays(Number(e.target.value))} className="w-36">
          <option value="7">7 Days</option>
          <option value="30">30 Days</option>
          <option value="90">90 Days</option>
        </Select>
      </div>

      {isLoading && <Card className="p-8 text-center">Analyzing production bottlenecks...</Card>}

      {data && data.bottlenecks.length === 0 && (
        <Card className="p-8 text-center text-gray-500">No bottleneck data available for this period.</Card>
      )}

      {data && data.bottlenecks.length > 0 && (
        <div className="space-y-4">
          {data.bottlenecks.map((b, i) => (
            <Card key={b.workstation_id} className={`p-4 ${b.is_critical ? 'border-red-300' : ''}`}>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-gray-300 w-8">{i + 1}</div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Workstation</div>
                    <div className="font-mono text-sm">{b.workstation_id.slice(0, 8)}...</div>
                    {b.is_critical && <Badge variant="danger" className="text-xs mt-1">Critical</Badge>}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Utilization</div>
                    <div className={`text-xl font-bold ${b.utilization_percent >= 85 ? 'text-red-600' : b.utilization_percent >= 70 ? 'text-yellow-500' : 'text-green-600'}`}>
                      {b.utilization_percent}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Avg Queue</div>
                    <div className="text-xl font-bold">{b.avg_queue_minutes}min</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Downtime Events</div>
                    <div className="text-xl font-bold text-orange-500">{b.downtime_events}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Bottleneck Score</div>
                    <div className={`text-xl font-bold ${b.bottleneck_score > 50 ? 'text-red-600' : b.bottleneck_score > 25 ? 'text-yellow-500' : 'text-green-600'}`}>
                      {b.bottleneck_score}
                    </div>
                  </div>
                </div>
              </div>
              {/* Utilization bar */}
              <div className="mt-3">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${b.utilization_percent >= 85 ? 'bg-red-500' : b.utilization_percent >= 70 ? 'bg-yellow-400' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(b.utilization_percent, 100)}%` }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
