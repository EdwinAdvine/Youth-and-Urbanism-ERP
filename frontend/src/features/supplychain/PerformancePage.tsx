import { useState } from 'react'
import { Card, Input, Spinner } from '../../components/ui'
import { useSupplierPerformanceReport, useLeadTimeReport } from '../../api/supplychain_ext'

export default function PerformancePage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: performance, isLoading: perfLoading } = useSupplierPerformanceReport({ start_date: startDate || undefined, end_date: endDate || undefined })
  const { data: leadTimes, isLoading: leadLoading } = useLeadTimeReport({ start_date: startDate || undefined, end_date: endDate || undefined })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Supplier Performance</h1>
          <p className="text-sm text-gray-500 mt-1">Analytics on supplier reliability and efficiency</p>
        </div>
        <div className="flex gap-3 items-end">
          <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* Performance Table */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Supplier Performance Scores</h2>
        {perfLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !performance || performance.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No performance data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Overall</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Quality</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Delivery</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Price</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Orders</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Total Value</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">On-Time %</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Defect %</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((p) => {
                  const scoreColor = (s: number) => s >= 4 ? 'text-green-600' : s >= 3 ? 'text-yellow-600' : 'text-red-600'
                  return (
                    <tr key={p.supplier_id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{p.supplier_name}</td>
                      <td className={`py-3 px-4 text-center font-bold ${scoreColor(p.overall_score)}`}>{p.overall_score.toFixed(1)}</td>
                      <td className={`py-3 px-4 text-center ${scoreColor(p.quality_score)}`}>{p.quality_score.toFixed(1)}</td>
                      <td className={`py-3 px-4 text-center ${scoreColor(p.delivery_score)}`}>{p.delivery_score.toFixed(1)}</td>
                      <td className={`py-3 px-4 text-center ${scoreColor(p.price_score)}`}>{p.price_score.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right">{p.total_orders}</td>
                      <td className="py-3 px-4 text-right">${p.total_value.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={p.on_time_percentage >= 90 ? 'text-green-600' : p.on_time_percentage >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                          {p.on_time_percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={p.defect_rate <= 2 ? 'text-green-600' : p.defect_rate <= 5 ? 'text-yellow-600' : 'text-red-600'}>
                          {p.defect_rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Lead Times */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Lead Time Analysis</h2>
        {leadLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !leadTimes || leadTimes.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No lead time data available</p>
        ) : (
          <div className="space-y-4">
            {leadTimes.map((lt) => {
              const maxDays = Math.max(...leadTimes.map((l) => l.max_lead_time_days), 1)
              return (
                <div key={lt.supplier_id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{lt.supplier_name}</span>
                    <span className="text-gray-500">{lt.order_count} orders</span>
                  </div>
                  <div className="relative h-6 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                    {/* Min-max range */}
                    <div
                      className="absolute h-full bg-blue-100 rounded-full"
                      style={{
                        left: `${(lt.min_lead_time_days / maxDays) * 100}%`,
                        width: `${((lt.max_lead_time_days - lt.min_lead_time_days) / maxDays) * 100}%`,
                      }}
                    />
                    {/* Average marker */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-primary rounded-full"
                      style={{ left: `${(lt.avg_lead_time_days / maxDays) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Min: {lt.min_lead_time_days}d</span>
                    <span>Avg: {lt.avg_lead_time_days.toFixed(1)}d</span>
                    <span>Max: {lt.max_lead_time_days}d</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
