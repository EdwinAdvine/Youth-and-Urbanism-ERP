import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import { useHRDashboard } from '../../../api/analytics_dashboards'
import DashboardHeader from './DashboardHeader'

export default function HRDashboard() {
  const { data, isLoading } = useHRDashboard()
  if (isLoading || !data) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  const { headcount_data, attrition_data, dept_distribution, attendance_data, leave_data, kpis } = data
  const exportSections = [
    { title: 'Headcount Trend', data: headcount_data },
    { title: 'Attrition Rate', data: attrition_data },
    { title: 'Department Distribution', data: dept_distribution },
    { title: 'Attendance Breakdown', data: attendance_data },
    { title: 'Leave Utilization', data: leave_data },
  ]
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="HR Dashboard" subtitle="Headcount, attrition, attendance and leave analytics" exportSections={exportSections} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Active Employees" value={kpis.active_employees} color="#51459d" />
        <KPICard label="Attrition Rate" value={`${kpis.attrition_rate}%`} color="#ff3a6e" />
        <KPICard label="Attendance Rate" value={`${kpis.attendance_rate}%`} color="#6fd943" />
        <KPICard label="Leave Utilization" value={`${kpis.leave_utilization}%`} color="#ffa21d" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Headcount Trend</h3><p className="text-xs text-gray-400 mb-4">Monthly employee count</p>
          <ChartRenderer type="line" data={headcount_data} config={{xKey:'month',yKeys:['headcount'],colors:['#51459d'],showGrid:true,showLegend:false,smooth:true}} height={240} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Attrition Rate</h3><p className="text-xs text-gray-400 mb-4">Monthly turnover percentage</p>
          <ChartRenderer type="line" data={attrition_data} config={{xKey:'month',yKeys:['rate'],colors:['#ff3a6e'],showGrid:true,showLegend:false,smooth:true}} height={240} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Department Distribution</h3><p className="text-xs text-gray-400 mb-4">Employees by department</p>
          <ChartRenderer type="donut" data={dept_distribution} config={{nameKey:'name',valueKey:'value',colors:['#51459d','#6fd943','#3ec9d6','#ffa21d','#ff3a6e','#a78bfa'],showLegend:true}} height={260} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Attendance Breakdown</h3><p className="text-xs text-gray-400 mb-4">Present vs Remote vs Absent (%)</p>
          <ChartRenderer type="bar" data={attendance_data} config={{xKey:'month',yKeys:['present','remote','absent'],colors:['#6fd943','#3ec9d6','#ff3a6e'],showGrid:true,showLegend:true,stacked:true}} height={260} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Leave Utilization</h3><p className="text-xs text-gray-400 mb-4">Requests by type (used vs total)</p>
          <ChartRenderer type="bar" data={leave_data} config={{xKey:'type',yKeys:['used','total'],colors:['#51459d','#e5e7eb'],showGrid:true,showLegend:true}} height={240} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Overall Leave Usage</h3>
          <ChartRenderer type="gauge" data={[{name:'Leave Utilization',value:kpis.leave_utilization}]} config={{nameKey:'name',valueKey:'value',colors:['#6fd943','#ffa21d','#ff3a6e']}} height={200} />
        </div>
      </div>
    </div>
  )
}
