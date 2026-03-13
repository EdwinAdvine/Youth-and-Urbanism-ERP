import { useSupportMetrics } from '../../../api/analytics'
import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import DashboardHeader from './DashboardHeader'

export default function SupportDashboard() {
  const { data: supportData, isLoading } = useSupportMetrics()

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  const support = supportData?.data ?? { open: 0, resolved: 0, closed: 0, total: 0 }

  // Ticket volume trend
  const volumeData = [
    { month: 'Oct', new: 45, resolved: 42 }, { month: 'Nov', new: 52, resolved: 48 },
    { month: 'Dec', new: 68, resolved: 55 }, { month: 'Jan', new: 41, resolved: 45 },
    { month: 'Feb', new: 38, resolved: 40 }, { month: 'Mar', new: 44, resolved: 39 },
  ]

  // Resolution time trend
  const resolutionData = [
    { month: 'Oct', hours: 18.5 }, { month: 'Nov', hours: 16.2 },
    { month: 'Dec', hours: 22.1 }, { month: 'Jan', hours: 14.8 },
    { month: 'Feb', hours: 12.5 }, { month: 'Mar', hours: 13.2 },
  ]

  // Ticket categories
  const categories = [
    { name: 'Technical', value: 125 },
    { name: 'Billing', value: 85 },
    { name: 'Account', value: 45 },
    { name: 'Feature Request', value: 35 },
    { name: 'Bug Report', value: 28 },
    { name: 'Other', value: 15 },
  ]

  // Priority breakdown
  const priorities = [
    { name: 'Critical', value: 8 },
    { name: 'High', value: 22 },
    { name: 'Medium', value: 45 },
    { name: 'Low', value: 30 },
  ]

  // CSAT trend
  const csatData = [
    { month: 'Oct', score: 82 }, { month: 'Nov', score: 85 },
    { month: 'Dec', score: 78 }, { month: 'Jan', score: 88 },
    { month: 'Feb', score: 91 }, { month: 'Mar', score: 87 },
  ]

  const currentCSAT = csatData[csatData.length - 1]?.score ?? 0
  const avgResolution = resolutionData.reduce((s, d) => s + d.hours, 0) / resolutionData.length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="Support Dashboard" subtitle="Ticket volume, resolution time and customer satisfaction" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Open Tickets" value={support.open} color="#ff3a6e" />
        <KPICard label="Resolved" value={support.resolved} color="#6fd943" />
        <KPICard label="Avg Resolution" value={`${avgResolution.toFixed(1)}h`} color="#3ec9d6" change={-8.5} />
        <KPICard label="CSAT Score" value={`${currentCSAT}%`} color="#51459d" change={2.1} />
      </div>

      {/* Volume + Resolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Ticket Volume</h3>
          <p className="text-xs text-gray-400 mb-4">New vs Resolved tickets</p>
          <ChartRenderer
            type="bar"
            data={volumeData}
            config={{
              xKey: 'month',
              yKeys: ['new', 'resolved'],
              colors: ['#ff3a6e', '#6fd943'],
              showGrid: true,
              showLegend: true,
            }}
            height={240}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Resolution Time</h3>
          <p className="text-xs text-gray-400 mb-4">Average hours to resolve</p>
          <ChartRenderer
            type="line"
            data={resolutionData}
            config={{
              xKey: 'month',
              yKeys: ['hours'],
              colors: ['#3ec9d6'],
              showGrid: true,
              showLegend: false,
              smooth: true,
            }}
            height={240}
          />
        </div>
      </div>

      {/* Categories + Priorities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Ticket Categories</h3>
          <p className="text-xs text-gray-400 mb-4">Distribution by type</p>
          <ChartRenderer
            type="donut"
            data={categories}
            config={{
              nameKey: 'name',
              valueKey: 'value',
              colors: ['#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e', '#a78bfa'],
              showLegend: true,
            }}
            height={260}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Priority Breakdown</h3>
          <p className="text-xs text-gray-400 mb-4">Tickets by priority level</p>
          <ChartRenderer
            type="bar"
            data={priorities}
            config={{
              xKey: 'name',
              yKeys: ['value'],
              colors: ['#ff3a6e', '#ffa21d', '#3ec9d6', '#6fd943'],
              showGrid: true,
              showLegend: false,
            }}
            height={260}
          />
        </div>
      </div>

      {/* CSAT + SLA Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Customer Satisfaction</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly CSAT score trend</p>
          <ChartRenderer
            type="line"
            data={csatData}
            config={{
              xKey: 'month',
              yKeys: ['score'],
              colors: ['#6fd943'],
              showGrid: true,
              showLegend: false,
              smooth: true,
            }}
            height={240}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">SLA Compliance</h3>
          <ChartRenderer
            type="gauge"
            data={[{ name: 'SLA Met', value: 92 }]}
            config={{
              nameKey: 'name',
              valueKey: 'value',
              colors: ['#ff3a6e', '#ffa21d', '#6fd943'],
            }}
            height={200}
          />
        </div>
      </div>
    </div>
  )
}
