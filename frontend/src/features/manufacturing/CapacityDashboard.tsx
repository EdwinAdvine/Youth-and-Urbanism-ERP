import { useState } from 'react'
import { Card, Select, Badge } from '../../components/ui'
import { useRoughCutCapacity } from '../../api/manufacturing_planning'

function UtilizationBar({ percent }: { percent: number }) {
  const color = percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-400' : 'bg-green-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  )
}

export default function CapacityDashboard() {
  const [weeks, setWeeks] = useState(4)
  const { data: rows, isLoading } = useRoughCutCapacity(weeks)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Capacity Dashboard</h1>
        <Select value={String(weeks)} onChange={e => setWeeks(Number(e.target.value))} className="w-36">
          <option value="2">2 Weeks</option>
          <option value="4">4 Weeks</option>
          <option value="8">8 Weeks</option>
          <option value="12">12 Weeks</option>
        </Select>
      </div>

      {isLoading && <Card className="p-8 text-center">Loading capacity data...</Card>}

      {!isLoading && (!rows || rows.length === 0) && (
        <Card className="p-8 text-center text-gray-500">
          No capacity slots defined. Add capacity slots per workstation to see utilization.
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows?.map(row => {
          const utilization = row.capacity_minutes > 0
            ? Math.round(row.allocated_minutes / row.capacity_minutes * 100)
            : 0
          return (
            <Card key={row.workstation_id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium truncate">{row.workstation_id.slice(0, 8)}...</div>
                {row.overloaded && (
                  <Badge variant="red" className="text-xs">Overloaded</Badge>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Utilization</span>
                  <span>{utilization}%</span>
                </div>
                <UtilizationBar percent={utilization} />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div>
                  <div className="font-semibold">{Math.round(row.capacity_minutes / 60)}h</div>
                  <div className="text-gray-500">Capacity</div>
                </div>
                <div>
                  <div className="font-semibold">{Math.round(row.allocated_minutes / 60)}h</div>
                  <div className="text-gray-500">Allocated</div>
                </div>
                <div>
                  <div className={`font-semibold ${row.overloaded ? 'text-red-600' : 'text-green-600'}`}>
                    {Math.round(row.demand_minutes / 60)}h
                  </div>
                  <div className="text-gray-500">Demand</div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
