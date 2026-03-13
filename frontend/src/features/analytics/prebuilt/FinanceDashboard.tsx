import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import { useFinanceDashboard } from '../../../api/analytics_dashboards'
import DashboardHeader from './DashboardHeader'

function formatKSh(value: number) {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toLocaleString()}`
}

export default function FinanceDashboard() {
  const { data, isLoading } = useFinanceDashboard()
  if (isLoading || !data) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  const { pnl_data, cash_flow_data, expense_distribution, kpis } = data
  const exportSections = [
    { title: 'Revenue vs Expenses (P&L)', data: pnl_data },
    { title: 'Cash Flow', data: cash_flow_data },
    { title: 'Expense Distribution', data: expense_distribution },
  ]
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="Finance Dashboard" subtitle="Revenue, expenses, P&L and cash flow overview" exportSections={exportSections} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Revenue MTD" value={formatKSh(kpis.revenue_mtd)} color="#51459d" />
        <KPICard label="Open Invoices" value={kpis.open_invoices} color="#ffa21d" />
        <KPICard label="Total Expenses" value={formatKSh(kpis.total_expenses)} color="#ff3a6e" />
        <KPICard label="Net Profit" value={formatKSh(kpis.net_profit)} color="#6fd943" />
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Revenue vs Expenses</h3><p className="text-xs text-gray-400 mb-4">Monthly P&L trend</p>
        <ChartRenderer type="bar" data={pnl_data} config={{xKey:'month',yKeys:['Revenue','Expenses'],colors:['#51459d','#ff3a6e'],showGrid:true,showLegend:true}} height={280} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Profit Trend</h3><p className="text-xs text-gray-400 mb-4">Net profit over time</p>
          <ChartRenderer type="area" data={pnl_data} config={{xKey:'month',yKeys:['Profit'],colors:['#6fd943'],smooth:true,areaFill:true,showGrid:true}} height={240} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Cash Flow</h3><p className="text-xs text-gray-400 mb-4">Cumulative cash position</p>
          <ChartRenderer type="area" data={cash_flow_data} config={{xKey:'month',yKeys:['Cash Flow'],colors:['#3ec9d6'],smooth:true,areaFill:true}} height={240} />
        </div>
      </div>
      {expense_distribution.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Expense Distribution</h3><p className="text-xs text-gray-400 mb-4">Breakdown by account</p>
          <ChartRenderer type="donut" data={expense_distribution} config={{nameKey:'name',valueKey:'value',showLegend:true}} height={280} />
        </div>
      )}
    </div>
  )
}
