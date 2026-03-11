import { useState } from 'react'
import { Card, Button, Input } from '../../components/ui'
import { useOEEReport } from '../../api/manufacturing_equipment'

function OEEGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const strokeWidth = 8
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const dashoffset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center -mt-14">
        <div className="text-xl font-bold" style={{ color }}>{value}%</div>
      </div>
      <div className="text-xs text-gray-500 text-center mt-10">{label}</div>
    </div>
  )
}

export default function OEEDetailedReport() {
  const [workstationId, setWorkstationId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { data: oee, isLoading } = useOEEReport(
    submitted ? workstationId : '',
    dateFrom || undefined,
    dateTo || undefined
  )

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">OEE Detailed Report</h1>

      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="text-sm font-medium">Workstation ID</label>
            <input
              className="mt-1 block w-full border rounded px-3 py-2 text-sm"
              value={workstationId}
              onChange={e => setWorkstationId(e.target.value)}
              placeholder="Workstation UUID"
            />
          </div>
          <div>
            <label className="text-sm font-medium">From</label>
            <input type="date" className="mt-1 block border rounded px-3 py-2 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">To</label>
            <input type="date" className="mt-1 block border rounded px-3 py-2 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <Button onClick={() => setSubmitted(true)} disabled={!workstationId}>Generate</Button>
        </div>
      </Card>

      {isLoading && <Card className="p-8 text-center">Calculating OEE...</Card>}

      {oee && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6 flex flex-col items-center">
              <OEEGauge label="OEE" value={oee.oee} color="#51459d" />
            </Card>
            <Card className="p-6 flex flex-col items-center">
              <OEEGauge label="Availability" value={oee.availability} color="#3ec9d6" />
            </Card>
            <Card className="p-6 flex flex-col items-center">
              <OEEGauge label="Performance" value={oee.performance} color="#6fd943" />
            </Card>
            <Card className="p-6 flex flex-col items-center">
              <OEEGauge label="Quality" value={oee.quality} color="#ffa21d" />
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-xs text-gray-500">Planned Time</div>
              <div className="text-xl font-bold">{Math.round(oee.planned_minutes / 60)}h</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-gray-500">Downtime</div>
              <div className="text-xl font-bold text-red-600">{Math.round(oee.downtime_minutes / 60)}h</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-gray-500">Units Inspected</div>
              <div className="text-xl font-bold">{Math.round(oee.total_inspected)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-gray-500">Units Passed</div>
              <div className="text-xl font-bold text-green-600">{Math.round(oee.total_passed)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-gray-500">Planned Qty</div>
              <div className="text-xl font-bold">{Math.round(oee.planned_qty)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-gray-500">Completed Qty</div>
              <div className="text-xl font-bold text-blue-600">{Math.round(oee.completed_qty)}</div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
