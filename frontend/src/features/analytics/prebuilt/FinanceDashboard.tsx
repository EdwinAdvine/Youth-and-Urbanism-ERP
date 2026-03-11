import { useRevenueStats, useExpenseStats, useDashboardStats } from '../../../api/analytics'
import { LineChart, BarChart, KPICard, PieChart } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import DashboardHeader from './DashboardHeader'

function formatKSh(value: number) {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toLocaleString()}`
}

export default function FinanceDashboard() {
  const { data: revenueData, isLoading: revLoading } = useRevenueStats(12)
  const { data: expenseData, isLoading: expLoading } = useExpenseStats(12)
  const { data: stats, isLoading: statsLoading } = useDashboardStats()

  const isLoading = revLoading || expLoading || statsLoading

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  const s = stats ?? { revenue_mtd: 0, revenue_prev: 0, open_invoices: 0, active_employees: 0, active_projects: 0, deals_pipeline: 0 }
  const revChange = s.revenue_prev ? Math.round(((s.revenue_mtd - s.revenue_prev) / s.revenue_prev) * 100) : 0

  // P&L trend data
  const revenuePoints = revenueData?.data ?? []
  const expensePoints = expenseData?.data ?? []

  const pnlData = revenuePoints.map((r) => {
    const exp = expensePoints.find((e) => e.month === r.month)
    return {
      month: r.month,
      Revenue: r.revenue,
      Expenses: exp?.expenses ?? 0,
      Profit: r.revenue - (exp?.expenses ?? 0),
    }
  })

  // Cash flow (simulated from revenue - expenses)
  let cumulativeCash = 0
  const cashFlowData = pnlData.map((d) => {
    cumulativeCash += d.Profit
    return { month: d.month, 'Cash Flow': cumulativeCash }
  })

  // Expense distribution
  const totalExpenses = expensePoints.reduce((sum, e) => sum + e.expenses, 0)
  const expenseDistribution = [
    { name: 'Salaries', value: totalExpenses * 0.45 },
    { name: 'Operations', value: totalExpenses * 0.20 },
    { name: 'Marketing', value: totalExpenses * 0.15 },
    { name: 'Technology', value: totalExpenses * 0.12 },
    { name: 'Other', value: totalExpenses * 0.08 },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="Finance Dashboard" subtitle="Revenue, expenses, P&L and cash flow overview" />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Revenue MTD" value={formatKSh(s.revenue_mtd)} change={revChange} color="#51459d" />
        <KPICard label="Open Invoices" value={s.open_invoices} color="#ffa21d" />
        <KPICard
          label="Total Expenses"
          value={formatKSh(totalExpenses)}
          color="#ff3a6e"
        />
        <KPICard
          label="Net Profit"
          value={formatKSh(s.revenue_mtd - totalExpenses / (revenuePoints.length || 1))}
          color="#6fd943"
        />
      </div>

      {/* Revenue & Expense Trend */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Revenue vs Expenses</h3>
        <p className="text-xs text-gray-400 mb-4">Monthly P&L trend</p>
        <BarChart
          data={pnlData}
          bars={[
            { dataKey: 'Revenue', color: '#51459d', name: 'Revenue' },
            { dataKey: 'Expenses', color: '#ff3a6e', name: 'Expenses' },
          ]}
          xKey="month"
          height={280}
          formatTooltip={(v) => formatKSh(v)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* P&L Trend Line */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Profit Trend</h3>
          <p className="text-xs text-gray-400 mb-4">Net profit over time</p>
          <LineChart
            data={pnlData}
            lines={[{ dataKey: 'Profit', color: '#6fd943', name: 'Net Profit' }]}
            xKey="month"
            height={240}
            formatTooltip={(v) => formatKSh(v)}
          />
        </div>

        {/* Cash Flow */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Cash Flow</h3>
          <p className="text-xs text-gray-400 mb-4">Cumulative cash position</p>
          <LineChart
            data={cashFlowData}
            lines={[{ dataKey: 'Cash Flow', color: '#3ec9d6', name: 'Cash Flow' }]}
            xKey="month"
            height={240}
            formatTooltip={(v) => formatKSh(v)}
          />
        </div>
      </div>

      {/* Expense Distribution */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Expense Distribution</h3>
        <p className="text-xs text-gray-400 mb-4">Breakdown by category</p>
        <PieChart
          data={expenseDistribution}
          innerRadius={60}
          height={280}
          formatTooltip={(v) => formatKSh(v)}
        />
      </div>
    </div>
  )
}
