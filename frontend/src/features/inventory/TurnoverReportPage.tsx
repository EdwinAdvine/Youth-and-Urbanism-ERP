import { useState } from 'react'
import { Card, Spinner, Input, Badge } from '../../components/ui'
import { useTurnoverReport, useAgingReport } from '../../api/inventory'

export default function TurnoverReportPage() {
  const today = new Date()
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [periodStart, setPeriodStart] = useState(ninetyDaysAgo.toISOString().split('T')[0])
  const [periodEnd, setPeriodEnd] = useState(today.toISOString().split('T')[0])

  const { data: turnover, isLoading: turnoverLoading } = useTurnoverReport({
    period_start: periodStart || undefined,
    period_end: periodEnd || undefined,
  })
  const { data: aging, isLoading: agingLoading } = useAgingReport()

  if (turnoverLoading || agingLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const agingBuckets = aging?.items?.reduce(
    (acc, item) => {
      acc[item.aging_bucket] = (acc[item.aging_bucket] ?? 0) + item.quantity
      return acc
    },
    {} as Record<string, number>
  ) ?? {}

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventory Turnover & Aging</h1>
        <p className="text-sm text-gray-500 mt-1">Track how fast inventory moves and identify slow-moving stock</p>
      </div>

      <div className="flex gap-4 items-end">
        <Input label="Period Start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-48" />
        <Input label="Period End" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-48" />
      </div>

      {/* KPI */}
      {turnover && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <p className="text-sm text-gray-600 dark:text-gray-400">Average Turnover Ratio</p>
            <p className="text-3xl font-bold text-primary mt-1">{turnover.avg_turnover_ratio.toFixed(2)}x</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Items Tracked</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{turnover.items.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Period</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
              {periodStart ? new Date(periodStart).toLocaleDateString() : 'Start'} &ndash;{' '}
              {periodEnd ? new Date(periodEnd).toLocaleDateString() : 'End'}
            </p>
          </Card>
        </div>
      )}

      {/* Aging Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['0-30', '31-60', '61-90', '90+'].map((bucket) => (
          <Card key={bucket}>
            <p className="text-sm text-gray-500">{bucket} Days</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{(agingBuckets[bucket] ?? 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400">units</p>
          </Card>
        ))}
      </div>

      {/* Turnover Table */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Turnover by Item</h3>
        {turnover?.items && turnover.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">SKU</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Avg Inventory</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Total Sold</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Turnover Ratio</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Days of Supply</th>
                </tr>
              </thead>
              <tbody>
                {turnover.items.map((item) => (
                  <tr key={item.item_id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-2 px-3 font-medium">{item.item_name}</td>
                    <td className="py-2 px-3 text-gray-500 font-mono text-xs">{item.sku}</td>
                    <td className="py-2 px-3 text-right">{item.avg_inventory.toFixed(0)}</td>
                    <td className="py-2 px-3 text-right font-medium">{item.total_sold}</td>
                    <td className="py-2 px-3 text-right">
                      <Badge variant={item.turnover_ratio >= 4 ? 'success' : item.turnover_ratio >= 2 ? 'warning' : 'danger'}>
                        {item.turnover_ratio.toFixed(2)}x
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right">{item.days_of_supply.toFixed(0)} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No turnover data available</p>
        )}
      </Card>

      {/* Aging Detail Table */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Aging Detail</h3>
        {aging?.items && aging.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">SKU</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Last Movement</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Days Since</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Bucket</th>
                </tr>
              </thead>
              <tbody>
                {aging.items.map((item) => (
                  <tr key={item.item_id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-2 px-3 font-medium">{item.item_name}</td>
                    <td className="py-2 px-3 text-gray-500 font-mono text-xs">{item.sku}</td>
                    <td className="py-2 px-3 text-right">{item.quantity}</td>
                    <td className="py-2 px-3 text-right">{new Date(item.last_movement_date).toLocaleDateString()}</td>
                    <td className="py-2 px-3 text-right">{item.days_since_movement}</td>
                    <td className="py-2 px-3 text-right">
                      <Badge variant={item.aging_bucket === '0-30' ? 'success' : item.aging_bucket === '31-60' ? 'info' : item.aging_bucket === '61-90' ? 'warning' : 'danger'}>
                        {item.aging_bucket}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No aging data available</p>
        )}
      </Card>
    </div>
  )
}
