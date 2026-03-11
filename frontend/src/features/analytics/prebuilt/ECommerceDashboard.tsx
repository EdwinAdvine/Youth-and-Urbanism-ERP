import { useRevenueStats, useTopProducts } from '../../../api/analytics'
import { KPICard, BarChart, LineChart, PieChart, DataTable } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import DashboardHeader from './DashboardHeader'

function formatKSh(value: number) {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toLocaleString()}`
}

export default function ECommerceDashboard() {
  const { data: revenueData, isLoading: revLoading } = useRevenueStats(6)
  const { data: topProducts, isLoading: prodLoading } = useTopProducts(10)

  const isLoading = revLoading || prodLoading

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  const revenuePoints = revenueData?.data ?? []
  const totalRevenue = revenuePoints.reduce((s, r) => s + r.revenue, 0)

  // Order trend
  const orderData = [
    { month: 'Oct', orders: 145 }, { month: 'Nov', orders: 182 },
    { month: 'Dec', orders: 256 }, { month: 'Jan', orders: 198 },
    { month: 'Feb', orders: 210 }, { month: 'Mar', orders: 225 },
  ]

  // Order status
  const orderStatus = [
    { name: 'Delivered', value: 680 },
    { name: 'Processing', value: 125 },
    { name: 'Shipped', value: 95 },
    { name: 'Cancelled', value: 32 },
    { name: 'Returned', value: 18 },
  ]

  // Revenue by channel
  const channelData = [
    { name: 'Website', value: totalRevenue * 0.55 },
    { name: 'Mobile App', value: totalRevenue * 0.25 },
    { name: 'Marketplace', value: totalRevenue * 0.15 },
    { name: 'Social', value: totalRevenue * 0.05 },
  ]

  const products = topProducts?.data ?? []
  const productColumns = [
    { key: 'name', label: 'Product' },
    { key: 'units_sold', label: 'Units Sold', align: 'right' as const, format: (v: unknown) => Number(v).toLocaleString() },
    { key: 'revenue', label: 'Revenue', align: 'right' as const, format: (v: unknown) => formatKSh(Number(v)) },
  ]

  const totalOrders = orderData.reduce((s, d) => s + d.orders, 0)
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="E-Commerce Dashboard" subtitle="Orders, revenue, products and channel performance" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={formatKSh(totalRevenue)} color="#51459d" change={12.5} />
        <KPICard label="Total Orders" value={totalOrders} color="#6fd943" change={8.2} />
        <KPICard label="Avg Order Value" value={formatKSh(avgOrderValue)} color="#3ec9d6" change={3.8} />
        <KPICard label="Conversion Rate" value="3.2%" color="#ffa21d" change={-0.5} />
      </div>

      {/* Revenue + Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Revenue Trend</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly e-commerce revenue</p>
          <LineChart
            data={revenuePoints.map((r) => ({ month: r.month, Revenue: r.revenue }))}
            lines={[{ dataKey: 'Revenue', color: '#51459d' }]}
            xKey="month"
            height={240}
            formatTooltip={(v) => formatKSh(v)}
          />
        </div>

        <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Order Volume</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly order count</p>
          <BarChart
            data={orderData}
            bars={[{ dataKey: 'orders', color: '#6fd943', name: 'Orders' }]}
            xKey="month"
            height={240}
          />
        </div>
      </div>

      {/* Status + Channel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Order Status</h3>
          <p className="text-xs text-gray-400 mb-4">Distribution of order statuses</p>
          <PieChart data={orderStatus} innerRadius={50} height={260} />
        </div>

        <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Revenue by Channel</h3>
          <p className="text-xs text-gray-400 mb-4">Sales across channels</p>
          <PieChart
            data={channelData}
            innerRadius={50}
            height={260}
            formatTooltip={(v) => formatKSh(v)}
          />
        </div>
      </div>

      {/* Top Products Table */}
      {products.length > 0 && (
        <DataTable
          columns={productColumns}
          data={products as unknown as Record<string, unknown>[]}
          title="Top Products"
          subtitle="Best selling products by revenue"
          pageSize={10}
        />
      )}
    </div>
  )
}
