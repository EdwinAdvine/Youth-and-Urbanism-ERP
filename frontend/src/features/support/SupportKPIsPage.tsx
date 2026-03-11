import { Card, Spinner } from '../../components/ui'
import { useSupportKPIs, useResponseTimesReport } from '../../api/support_ext'

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Card>
  )
}

export default function SupportKPIsPage() {
  const { data: kpis, isLoading: kpisLoading } = useSupportKPIs()
  const { data: responseTimes, isLoading: rtLoading } = useResponseTimesReport({ period: 'weekly' })

  if (kpisLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Key performance indicators for support operations</p>
      </div>

      {kpis && (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Open Tickets" value={kpis.total_open_tickets.toString()} color="text-primary" />
            <KPICard label="Tickets Today" value={kpis.tickets_today.toString()} sub={`${kpis.resolved_today} resolved`} color="text-blue-600" />
            <KPICard label="Avg First Response" value={`${kpis.avg_first_response_hours.toFixed(1)}h`} color="text-orange-600" />
            <KPICard label="Avg Resolution" value={`${kpis.avg_resolution_hours.toFixed(1)}h`} color="text-green-600" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="SLA Compliance" value={`${kpis.sla_compliance_rate.toFixed(1)}%`} color={kpis.sla_compliance_rate >= 90 ? 'text-green-600' : 'text-red-600'} />
            <KPICard label="Customer Satisfaction" value={`${kpis.customer_satisfaction_avg.toFixed(1)}/5`} color="text-yellow-600" />
            <KPICard label="Unassigned" value={kpis.unassigned_tickets.toString()} color="text-red-600" />
            <KPICard label="Overdue" value={kpis.overdue_tickets.toString()} color="text-danger" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Categories */}
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h2>
              {kpis.top_categories.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No category data</p>
              ) : (
                <div className="space-y-3">
                  {kpis.top_categories.map((cat) => {
                    const maxCount = Math.max(...kpis.top_categories.map((c) => c.count), 1)
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-32 shrink-0 truncate">{cat.name}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${(cat.count / maxCount) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium w-10 text-right">{cat.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Agent Performance */}
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Performance</h2>
              {kpis.agent_performance.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No agent data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Agent</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Resolved</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Avg Response</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.agent_performance.map((a) => (
                        <tr key={a.name} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-2 px-3 font-medium text-gray-900">{a.name}</td>
                          <td className="py-2 px-3 text-right">{a.resolved}</td>
                          <td className="py-2 px-3 text-right">{a.avg_response_hours.toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Response Times Trend */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">SLA Compliance Trend</h2>
        {rtLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !responseTimes || responseTimes.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No response time data</p>
        ) : (
          <div className="space-y-3">
            {responseTimes.map((r) => (
              <div key={r.period} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-24 shrink-0 text-right">{r.period}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4">
                  <div
                    className={`h-full rounded-full ${r.sla_compliance_rate >= 90 ? 'bg-green-500' : r.sla_compliance_rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${r.sla_compliance_rate}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-16 text-right">{r.sla_compliance_rate.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
