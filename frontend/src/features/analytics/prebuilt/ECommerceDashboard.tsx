import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import { useECommerceDashboard } from '../../../api/analytics_dashboards'
import DashboardHeader from './DashboardHeader'

function formatKSh(value: number) {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toLocaleString()}`
}

export default function ECommerceDashboard() {
  const { data, isLoading } = useECommerceDashboard()
  if (isLoading || !data) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  const { order_data, order_status, revenue_data, top_products, kpis } = data
  const exportSections = [
    { title: 'Revenue Trend', data: revenue_data },
    { title: 'Order Volume', data: order_data },
    { title: 'Order Status', data: order_status },
    { title: 'Top Products', data: top_products },
  ]
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="E-Commerce Dashboard" subtitle="Orders, revenue, products and channel performance" exportSections={exportSections} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={formatKSh(kpis.total_revenue)} color="#51459d" />
        <KPICard label="Total Orders" value={kpis.total_orders} color="#6fd943" />
        <KPICard label="Avg Order Value" value={formatKSh(kpis.avg_order_value)} color="#3ec9d6" />
        <KPICard label="Products Sold" value={top_products.reduce((s, p) => s + p.units_sold, 0)} color="#ffa21d" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Revenue Trend</h3><p className="text-xs text-gray-400 mb-4">Monthly e-commerce revenue</p>
          <ChartRenderer type="line" data={revenue_data} config={{xKey:'month',yKeys:['Revenue'],colors:['#51459d'],showGrid:true,showLegend:false,smooth:true,areaFill:true}} height={240} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Order Volume</h3><p className="text-xs text-gray-400 mb-4">Monthly order count</p>
          <ChartRenderer type="bar" data={order_data} config={{xKey:'month',yKeys:['orders'],colors:['#6fd943'],showGrid:true,showLegend:false}} height={240} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Order Status</h3><p className="text-xs text-gray-400 mb-4">Distribution of order statuses</p>
          <ChartRenderer type="donut" data={order_status} config={{nameKey:'name',valueKey:'value',colors:['#6fd943','#3ec9d6','#51459d','#ff3a6e','#ffa21d'],showLegend:true}} height={260} />
        </div>
        {top_products.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Top Products</h3><p className="text-xs text-gray-400 mb-4">Best selling products by revenue</p>
            <ChartRenderer type="bar" data={top_products} config={{xKey:'name',yKeys:['revenue'],colors:['#51459d'],showGrid:true,showLegend:false,horizontal:true}} height={260} />
          </div>
        )}
      </div>
    </div>
  )
}
