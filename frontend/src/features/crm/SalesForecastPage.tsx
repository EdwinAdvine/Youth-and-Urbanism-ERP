import { useState } from 'react'
import { Card, Spinner, Select } from '../../components/ui'
import { useSalesForecast } from '../../api/crm'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function SalesForecastPage() {
  const [months, setMonths] = useState(6)
  const { data: forecast, isLoading } = useSalesForecast({ months })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const maxValue = forecast?.monthly_forecast
    ? Math.max(...forecast.monthly_forecast.map((m) => m.expected_value), 1)
    : 1

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sales Forecast</h1>
          <p className="text-sm text-gray-500 mt-1">Revenue projections based on pipeline data</p>
        </div>
        <Select
          options={[
            { value: '3', label: '3 Months' },
            { value: '6', label: '6 Months' },
            { value: '12', label: '12 Months' },
          ]}
          value={String(months)}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="w-36"
        />
      </div>

      {forecast ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <p className="text-sm text-gray-500">Total Expected Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(forecast.total_expected)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Weighted Forecast</p>
              <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(forecast.total_weighted)}</p>
              <p className="text-xs text-gray-400 mt-1">Adjusted by probability</p>
            </Card>
          </div>

          {/* Monthly Forecast Bar Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Monthly Forecast</h3>
            {forecast.monthly_forecast && forecast.monthly_forecast.length > 0 ? (
              <div className="space-y-1">
                {/* Chart */}
                <div className="flex items-end gap-3 h-64 px-4">
                  {forecast.monthly_forecast.map((m) => {
                    const expectedPct = (m.expected_value / maxValue) * 100
                    const weightedPct = (m.weighted_value / maxValue) * 100
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-1 items-end justify-center h-48">
                          <div
                            className="w-5 bg-gray-200 rounded-t transition-all"
                            style={{ height: `${expectedPct}%` }}
                            title={`Expected: ${formatCurrency(m.expected_value)}`}
                          />
                          <div
                            className="w-5 bg-primary rounded-t transition-all"
                            style={{ height: `${weightedPct}%` }}
                            title={`Weighted: ${formatCurrency(m.weighted_value)}`}
                          />
                        </div>
                        <span className="text-xs text-gray-500 mt-1">{m.month}</span>
                        <span className="text-[10px] text-gray-400">{m.deal_count} deals</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-200 rounded" />
                    <span className="text-xs text-gray-500">Expected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded" />
                    <span className="text-xs text-gray-500">Weighted</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No forecast data available</p>
            )}
          </Card>

          {/* Quarterly Forecast */}
          {forecast.quarterly_forecast && forecast.quarterly_forecast.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quarterly Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Quarter</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Expected</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Weighted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.quarterly_forecast.map((q) => (
                      <tr key={q.quarter} className="border-b border-gray-50 dark:border-gray-800">
                        <td className="py-2 px-3 font-medium">{q.quarter}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(q.expected_value)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-primary">{formatCurrency(q.weighted_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Monthly Detail Table */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Detail</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Month</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Deals</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Expected</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Weighted</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.monthly_forecast.map((m) => (
                    <tr key={m.month} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-2 px-3 font-medium">{m.month}</td>
                      <td className="py-2 px-3 text-right">{m.deal_count}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(m.expected_value)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{formatCurrency(m.weighted_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-400">No forecast data available</div>
        </Card>
      )}
    </div>
  )
}
