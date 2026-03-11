import { KPICard, BarChart, PieChart, LineChart, GaugeChart } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import { useModuleKPIs } from '../../../api/analytics_ext'
import DashboardHeader from './DashboardHeader'

function formatKSh(value: number) {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toLocaleString()}`
}

export default function InventoryDashboard() {
  const { isLoading } = useModuleKPIs('inventory')

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  // Stock levels by category
  const stockByCategory = [
    { name: 'Electronics', value: 1250 },
    { name: 'Furniture', value: 840 },
    { name: 'Office Supplies', value: 2100 },
    { name: 'Raw Materials', value: 560 },
    { name: 'Finished Goods', value: 920 },
  ]

  // Turnover trend
  const turnoverData = [
    { month: 'Oct', ratio: 4.2 }, { month: 'Nov', ratio: 3.8 },
    { month: 'Dec', ratio: 5.1 }, { month: 'Jan', ratio: 4.5 },
    { month: 'Feb', ratio: 4.0 }, { month: 'Mar', ratio: 4.3 },
  ]

  // Valuation trend
  const valuationData = [
    { month: 'Oct', value: 12500000 }, { month: 'Nov', value: 13200000 },
    { month: 'Dec', value: 11800000 }, { month: 'Jan', value: 14000000 },
    { month: 'Feb', value: 13500000 }, { month: 'Mar', value: 14200000 },
  ]

  // Top items by value
  const topItems = [
    { name: 'Laptop Pro X1', qty: 45, value: 2250000 },
    { name: 'Standing Desk', qty: 120, value: 1800000 },
    { name: 'Monitor 27"', qty: 85, value: 1700000 },
    { name: 'Chair Ergonomic', qty: 95, value: 1425000 },
    { name: 'Server Rack', qty: 8, value: 1200000 },
  ]

  // Warehouse utilization
  const warehouseData = [
    { name: 'Main Warehouse', capacity: 85 },
    { name: 'Satellite A', capacity: 62 },
    { name: 'Satellite B', capacity: 91 },
  ]

  const totalItems = stockByCategory.reduce((s, c) => s + c.value, 0)
  const totalValuation = valuationData[valuationData.length - 1]?.value ?? 0
  const avgTurnover = turnoverData.reduce((s, d) => s + d.ratio, 0) / turnoverData.length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="Inventory Dashboard" subtitle="Stock levels, turnover, valuation and warehouse analytics" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total SKUs" value={totalItems} color="#51459d" change={3.2} />
        <KPICard label="Total Valuation" value={formatKSh(totalValuation)} color="#6fd943" change={5.1} />
        <KPICard label="Avg Turnover" value={`${avgTurnover.toFixed(1)}x`} color="#3ec9d6" />
        <KPICard label="Low Stock Alerts" value={7} color="#ff3a6e" />
      </div>

      {/* Stock Distribution + Valuation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Stock by Category</h3>
          <p className="text-xs text-gray-400 mb-4">Units per category</p>
          <PieChart data={stockByCategory} innerRadius={50} height={260} />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Inventory Valuation</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly total stock value</p>
          <LineChart
            data={valuationData}
            lines={[{ dataKey: 'value', color: '#51459d', name: 'Valuation' }]}
            xKey="month"
            height={260}
            formatTooltip={(v) => formatKSh(v)}
          />
        </div>
      </div>

      {/* Turnover + Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Inventory Turnover</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly turnover ratio</p>
          <BarChart
            data={turnoverData}
            bars={[{ dataKey: 'ratio', color: '#3ec9d6', name: 'Turnover Ratio' }]}
            xKey="month"
            height={240}
            formatTooltip={(v) => `${v}x`}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Top Items by Value</h3>
          <p className="text-xs text-gray-400 mb-4">Highest value inventory items</p>
          <BarChart
            data={topItems}
            bars={[{ dataKey: 'value', color: '#ffa21d', name: 'Value' }]}
            xKey="name"
            height={240}
            formatTooltip={(v) => formatKSh(v)}
          />
        </div>
      </div>

      {/* Warehouse Utilization */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Warehouse Utilization</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {warehouseData.map((wh) => (
            <div key={wh.name} className="flex flex-col items-center">
              <GaugeChart
                value={wh.capacity}
                label={wh.name}
                thresholds={[
                  { value: 60, color: '#6fd943' },
                  { value: 85, color: '#ffa21d' },
                  { value: 100, color: '#ff3a6e' },
                ]}
                size={160}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
