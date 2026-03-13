import { useState } from 'react'
import { Card, Spinner, Input, Badge } from '../../components/ui'
import { usePipelineReport } from '../../api/crm'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function PipelineAnalyticsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const { data: report, isLoading } = usePipelineReport({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pipeline Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Win rates, deal velocity, and pipeline health</p>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-48" />
        <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-48" />
      </div>

      {report ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <p className="text-sm text-gray-500">Pipeline Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(report.total_pipeline_value)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Win Rate</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{report.win_rate.toFixed(1)}%</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Avg Deal Size</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(report.avg_deal_size)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Avg Days to Close</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{report.avg_days_to_close}</p>
            </Card>
          </div>

          {/* Stage Breakdown */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline by Stage</h3>
            {report.stage_breakdown && report.stage_breakdown.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  const maxValue = Math.max(...report.stage_breakdown.map((s) => s.value), 1)
                  return report.stage_breakdown.map((stage) => (
                    <div key={stage.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 capitalize">{stage.stage.replace(/_/g, ' ')}</span>
                          <Badge variant="default">{stage.count} deals</Badge>
                        </div>
                        <span className="font-semibold">{formatCurrency(stage.value)}</span>
                      </div>
                      <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(stage.value / maxValue) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400">Avg probability: {(stage.avg_probability * 100).toFixed(0)}%</p>
                    </div>
                  ))
                })()}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No stage data</p>
            )}
          </Card>

          {/* Monthly Trend */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Win/Loss Trend</h3>
            {report.monthly_trend && report.monthly_trend.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Month</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Won</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Lost</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Value</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthly_trend.map((row) => {
                      const total = row.won + row.lost
                      const winRate = total > 0 ? (row.won / total) * 100 : 0
                      return (
                        <tr key={row.month} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-2 px-3 font-medium">{row.month}</td>
                          <td className="py-2 px-3 text-right">
                            <Badge variant="success">{row.won}</Badge>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Badge variant="danger">{row.lost}</Badge>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold">{formatCurrency(row.value)}</td>
                          <td className="py-2 px-3 text-right">{winRate.toFixed(0)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No trend data</p>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-400">No pipeline data available</div>
        </Card>
      )}
    </div>
  )
}
