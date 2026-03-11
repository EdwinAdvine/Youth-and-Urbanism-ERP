import { Card, Spinner } from '../../components/ui'
import { useMfgKPIs, useOEEReport } from '../../api/manufacturing_ext'

function GaugeChart({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(value, 100)
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          className="transition-all duration-700"
        />
        <text x="60" y="60" textAnchor="middle" dy="7" className="text-2xl font-bold" fill="#1f2937">
          {pct.toFixed(1)}%
        </text>
      </svg>
      <p className="text-sm font-medium text-gray-600 mt-2">{label}</p>
    </div>
  )
}

function KPICard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>
        {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}
        <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </Card>
  )
}

export default function MfgKPIsPage() {
  const { data: kpis, isLoading: kpisLoading } = useMfgKPIs()
  const { data: oeeData, isLoading: oeeLoading } = useOEEReport({ period: 'monthly' })

  if (kpisLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manufacturing KPIs</h1>
        <p className="text-sm text-gray-500 mt-1">Overall equipment effectiveness and production metrics</p>
      </div>

      {/* OEE Gauges */}
      {kpis && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">Overall Equipment Effectiveness</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 justify-items-center">
            <GaugeChart value={kpis.oee} label="OEE" color="#51459d" />
            <GaugeChart value={kpis.availability} label="Availability" color="#3ec9d6" />
            <GaugeChart value={kpis.performance} label="Performance" color="#ffa21d" />
            <GaugeChart value={kpis.quality_rate} label="Quality" color="#6fd943" />
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total Output" value={kpis.total_output} unit="units" color="text-primary" />
          <KPICard label="Defect Count" value={kpis.defect_count} unit="units" color="text-red-600" />
          <KPICard label="Scrap Cost" value={kpis.scrap_cost} unit="USD" color="text-orange-600" />
          <KPICard label="Avg Cycle Time" value={kpis.avg_cycle_time_minutes} unit="min" color="text-blue-600" />
          <KPICard label="Capacity Utilization" value={kpis.capacity_utilization} unit="%" color="text-green-600" />
          <KPICard label="MTBF" value={kpis.mtbf_hours} unit="hrs" color="text-cyan-600" />
          <KPICard label="MTTR" value={kpis.mttr_hours} unit="hrs" color="text-yellow-600" />
          <KPICard label="On-Time Completion" value={kpis.on_time_completion_rate} unit="%" color="text-primary" />
        </div>
      )}

      {/* OEE Trend */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">OEE Trend</h2>
        {oeeLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !oeeData || oeeData.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No OEE trend data available</p>
        ) : (
          <div className="space-y-3">
            {oeeData.map((d) => (
              <div key={d.period} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-24 shrink-0 text-right">{d.period}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div className="bg-primary/30 h-full rounded-full" style={{ width: `${d.availability}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-primary/60 h-full rounded-full" style={{ width: `${d.performance}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-primary h-full rounded-full" style={{ width: `${d.oee}%` }} />
                </div>
                <div className="flex gap-4 text-sm shrink-0">
                  <span className="font-bold text-primary">{d.oee.toFixed(1)}%</span>
                  <span className="text-gray-500">{d.good_output}/{d.total_output}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
