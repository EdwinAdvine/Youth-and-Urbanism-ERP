import { Card, Button, Badge } from '../../components/ui'
import { useExecutiveSummary, useExecutiveDashboard } from '../../api/manufacturing_ai'

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${color || ''}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </Card>
  )
}

export default function ExecutiveSummary() {
  const { data: summary, isLoading: summaryLoading, refetch } = useExecutiveSummary()
  const { data: dash, isLoading: dashLoading } = useExecutiveDashboard()

  const isLoading = summaryLoading || dashLoading

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manufacturing Executive Summary</h1>
        <Button variant="outline" onClick={() => refetch()}>Regenerate</Button>
      </div>

      {isLoading && <Card className="p-8 text-center">Generating AI summary...</Card>}

      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Active Work Orders" value={dash.work_orders.active} color="text-blue-600" />
          <KPICard label="Completed This Month" value={dash.work_orders.completed_this_month} color="text-green-600" />
          <KPICard label="Units Produced" value={dash.output.units_produced.toLocaleString()} />
          <KPICard
            label="Manufacturing Cost"
            value={`$${dash.output.manufacturing_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub={dash.output.units_produced > 0 ? `$${dash.output.cost_per_unit.toFixed(2)}/unit` : undefined}
          />
          <KPICard
            label="Open NCRs"
            value={dash.quality.total_open_ncrs}
            color={dash.quality.total_open_ncrs > 5 ? 'text-red-600' : 'text-green-600'}
          />
          <KPICard
            label="Critical NCRs"
            value={dash.quality.ncr_by_severity['critical'] || 0}
            color={(dash.quality.ncr_by_severity['critical'] || 0) > 0 ? 'text-red-600' : ''}
          />
          <KPICard
            label="Downtime (Month)"
            value={`${dash.equipment.downtime_hours_this_month}h`}
            color={dash.equipment.downtime_hours_this_month > 40 ? 'text-red-600' : ''}
          />
          <KPICard label="Total Work Orders" value={dash.work_orders.total} />
        </div>
      )}

      {summary && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <h2 className="font-semibold">AI-Generated Summary</h2>
            <Badge variant="primary" className="text-xs">AI</Badge>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
            {summary.summary}
          </div>
          <div className="text-xs text-gray-400">
            Generated at {new Date(summary.generated_at).toLocaleString()}
          </div>
        </Card>
      )}

      {dash && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Work Order Status Breakdown</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dash.work_orders.by_status).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded">
                <span className="text-sm font-medium capitalize">{status.replace('_', ' ')}</span>
                <Badge variant="default" className="text-xs">{count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
