import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import { useSupportDashboard } from '../../../api/analytics_dashboards'
import DashboardHeader from './DashboardHeader'

export default function SupportDashboard() {
  const { data, isLoading } = useSupportDashboard()
  if (isLoading || !data) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  const { volume_data, resolution_data, categories, priorities, csat_data, kpis } = data
  const exportSections = [
    { title: 'Ticket Volume', data: volume_data },
    { title: 'Resolution Time', data: resolution_data },
    { title: 'Ticket Categories', data: categories },
    { title: 'Priority Breakdown', data: priorities },
    { title: 'Customer Satisfaction', data: csat_data },
  ]
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="Support Dashboard" subtitle="Ticket volume, resolution time and customer satisfaction" exportSections={exportSections} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Open Tickets" value={kpis.open_tickets} color="#ff3a6e" />
        <KPICard label="Resolved" value={kpis.resolved} color="#6fd943" />
        <KPICard label="Avg Resolution" value={`${kpis.avg_resolution}h`} color="#3ec9d6" />
        <KPICard label="CSAT Score" value={`${kpis.csat_score}%`} color="#51459d" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Ticket Volume</h3><p className="text-xs text-gray-400 mb-4">New vs Resolved tickets</p>
          <ChartRenderer type="bar" data={volume_data} config={{xKey:'month',yKeys:['new','resolved'],colors:['#ff3a6e','#6fd943'],showGrid:true,showLegend:true}} height={240} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Resolution Time</h3><p className="text-xs text-gray-400 mb-4">Average hours to resolve</p>
          <ChartRenderer type="line" data={resolution_data} config={{xKey:'month',yKeys:['hours'],colors:['#3ec9d6'],showGrid:true,showLegend:false,smooth:true}} height={240} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Ticket Categories</h3><p className="text-xs text-gray-400 mb-4">Distribution by type</p>
          <ChartRenderer type="donut" data={categories} config={{nameKey:'name',valueKey:'value',colors:['#51459d','#6fd943','#3ec9d6','#ffa21d','#ff3a6e','#a78bfa'],showLegend:true}} height={260} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Priority Breakdown</h3><p className="text-xs text-gray-400 mb-4">Tickets by priority level</p>
          <ChartRenderer type="bar" data={priorities} config={{xKey:'name',yKeys:['value'],colors:['#ff3a6e','#ffa21d','#3ec9d6','#6fd943'],showGrid:true,showLegend:false}} height={260} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Customer Satisfaction</h3><p className="text-xs text-gray-400 mb-4">Monthly CSAT score trend</p>
          <ChartRenderer type="line" data={csat_data} config={{xKey:'month',yKeys:['score'],colors:['#6fd943'],showGrid:true,showLegend:false,smooth:true}} height={240} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">SLA Compliance</h3>
          <ChartRenderer type="gauge" data={[{name:'SLA Met',value:kpis.sla_compliance}]} config={{nameKey:'name',valueKey:'value',colors:['#ff3a6e','#ffa21d','#6fd943']}} height={200} />
        </div>
      </div>
    </div>
  )
}
