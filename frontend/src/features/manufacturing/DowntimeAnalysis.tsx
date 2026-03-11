import { useState } from 'react'
import { Card, Select } from '../../components/ui'
import { useDowntimePareto } from '../../api/manufacturing_equipment'

export default function DowntimeAnalysis() {
  const [days, setDays] = useState(30)
  const { data: pareto, isLoading } = useDowntimePareto(undefined, days)

  const maxMinutes = pareto?.[0]?.total_minutes || 1

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Downtime Analysis (Pareto)</h1>
        <Select value={String(days)} onChange={e => setDays(Number(e.target.value))} className="w-36">
          <option value="7">7 Days</option>
          <option value="30">30 Days</option>
          <option value="90">90 Days</option>
        </Select>
      </div>

      {isLoading && <Card className="p-8 text-center">Loading analysis...</Card>}

      {!isLoading && (!pareto || pareto.length === 0) && (
        <Card className="p-8 text-center text-gray-500">No downtime data for this period.</Card>
      )}

      {pareto && pareto.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pareto Table */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold">By Category</div>
            <div className="divide-y">
              {pareto.map((row, i) => (
                <div key={row.category} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-6 text-gray-400 text-xs font-mono">{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium capitalize">{row.category}</div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${(row.total_minutes / maxMinutes) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-medium">{row.total_minutes}min</div>
                    <div className="text-gray-500">{row.percent}%</div>
                  </div>
                  <div className="text-xs text-gray-400">{row.occurrences}×</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Cumulative Chart */}
          <Card className="p-4 space-y-4">
            <div className="font-semibold">Cumulative Impact</div>
            <div className="space-y-2">
              {pareto.map(row => (
                <div key={row.category} className="flex items-center gap-3">
                  <div className="text-xs w-24 capitalize truncate">{row.category}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                    <div
                      className="bg-blue-500 h-4 rounded-full opacity-80"
                      style={{ width: `${row.cumulative_percent}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 w-10">{row.cumulative_percent}%</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-400 pt-2">
              Cumulative downtime percentage — top categories driving 80% of downtime
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
