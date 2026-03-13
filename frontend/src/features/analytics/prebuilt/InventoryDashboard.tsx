import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import { useInventoryDashboard } from '../../../api/analytics_dashboards'
import DashboardHeader from './DashboardHeader'

function formatKSh(value: number) {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toLocaleString()}`
}

export default function InventoryDashboard() {
  const { data, isLoading } = useInventoryDashboard()
  if (isLoading || !data) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  const { stock_by_category, turnover_data, valuation_data, top_items, warehouse_data, kpis } = data
  const exportSections = [
    { title: 'Stock by Category', data: stock_by_category },
    { title: 'Inventory Turnover', data: turnover_data },
    { title: 'Inventory Valuation', data: valuation_data },
    { title: 'Top Items by Value', data: top_items },
    { title: 'Warehouse Utilization', data: warehouse_data },
  ]
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="Inventory Dashboard" subtitle="Stock levels, turnover, valuation and warehouse analytics" exportSections={exportSections} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total SKUs" value={kpis.total_skus} color="#51459d" />
        <KPICard label="Total Valuation" value={formatKSh(kpis.total_valuation)} color="#6fd943" />
        <KPICard label="Avg Turnover" value={`${kpis.avg_turnover}x`} color="#3ec9d6" />
        <KPICard label="Low Stock Alerts" value={kpis.low_stock_alerts} color="#ff3a6e" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Stock by Category</h3><p className="text-xs text-gray-400 mb-4">Units per category</p>
          <ChartRenderer type="donut" data={stock_by_category} config={{nameKey:'name',valueKey:'value',colors:['#51459d','#6fd943','#3ec9d6','#ffa21d','#ff3a6e'],showLegend:true}} height={260} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Inventory Valuation</h3><p className="text-xs text-gray-400 mb-4">Monthly total stock value</p>
          <ChartRenderer type="line" data={valuation_data} config={{xKey:'month',yKeys:['value'],colors:['#51459d'],showGrid:true,showLegend:false,smooth:true,areaFill:true}} height={260} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Inventory Turnover</h3><p className="text-xs text-gray-400 mb-4">Monthly turnover ratio</p>
          <ChartRenderer type="bar" data={turnover_data} config={{xKey:'month',yKeys:['ratio'],colors:['#3ec9d6'],showGrid:true,showLegend:false}} height={240} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Top Items by Value</h3><p className="text-xs text-gray-400 mb-4">Highest value inventory items</p>
          <ChartRenderer type="bar" data={top_items} config={{xKey:'name',yKeys:['value'],colors:['#ffa21d'],showGrid:true,showLegend:false,horizontal:true}} height={240} />
        </div>
      </div>
      {warehouse_data.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Warehouse Utilization</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {warehouse_data.map((wh) => (
              <div key={wh.name} className="flex flex-col items-center">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 text-center">{wh.name}</p>
                <ChartRenderer type="gauge" data={[{name:wh.name,value:wh.capacity}]} config={{nameKey:'name',valueKey:'value',colors:['#6fd943','#ffa21d','#ff3a6e']}} height={160} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
