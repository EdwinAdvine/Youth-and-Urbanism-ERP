import { useState } from 'react'
import { Card, Select, Spinner } from '../../components/ui'
import { useSalesReport, useTopProducts, useConversionFunnel } from '../../api/ecommerce_ext'

export default function SalesReportPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const { data: salesData, isLoading: salesLoading } = useSalesReport({ period })
  const { data: topProducts, isLoading: productsLoading } = useTopProducts({ limit: 10 })
  const { data: funnel, isLoading: funnelLoading } = useConversionFunnel()

  const totals = (salesData ?? []).reduce(
    (acc, d) => ({
      orders: acc.orders + d.orders_count,
      revenue: acc.revenue + d.revenue,
      units: acc.units + d.units_sold,
    }),
    { orders: 0, revenue: 0, units: 0 }
  )

  const avgOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
          <p className="text-sm text-gray-500 mt-1">E-commerce sales analytics and insights</p>
        </div>
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value as typeof period)}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `$${totals.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: 'text-primary' },
          { label: 'Total Orders', value: totals.orders.toLocaleString(), color: 'text-blue-600' },
          { label: 'Avg Order Value', value: `$${avgOrderValue.toFixed(2)}`, color: 'text-green-600' },
          { label: 'Units Sold', value: totals.units.toLocaleString(), color: 'text-orange-600' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <p className="text-sm text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Sales Chart */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Over Time</h2>
        {salesLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !salesData || salesData.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No sales data available</p>
        ) : (
          <div className="space-y-2">
            {salesData.map((d) => {
              const maxRevenue = Math.max(...salesData.map((s) => s.revenue), 1)
              const pct = (d.revenue / maxRevenue) * 100
              return (
                <div key={d.period} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-24 shrink-0 text-right">{d.period}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-28 text-right">
                    ${d.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-gray-400 w-16 text-right">{d.orders_count} orders</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
          {productsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !topProducts || topProducts.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No product data</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.product_id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < 3 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.product_name}</p>
                    <p className="text-xs text-gray-500">{p.units_sold} units sold</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    ${p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h2>
          {funnelLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !funnel || funnel.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No funnel data</p>
          ) : (
            <div className="space-y-4">
              {funnel.map((step, i) => (
                <div key={step.step}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{step.step}</span>
                    <span className="text-gray-500">{step.count.toLocaleString()} ({step.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-primary to-primary/60 h-full rounded-full transition-all duration-500"
                      style={{ width: `${step.percentage}%` }}
                    />
                  </div>
                  {i < funnel.length - 1 && (
                    <div className="flex justify-center my-1">
                      <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
