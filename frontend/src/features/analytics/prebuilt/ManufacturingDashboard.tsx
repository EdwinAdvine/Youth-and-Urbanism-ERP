import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import { useManufacturingDashboard } from '../../../api/analytics_dashboards'
import DashboardHeader from './DashboardHeader'

export default function ManufacturingDashboard() {
  const { data, isLoading } = useManufacturingDashboard()
  if (isLoading || !data) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  const { production_data, defect_data, wo_status, workstations, oee, kpis } = data
  const exportSections = [
    { title: 'Production Output', data: production_data },
    { title: 'Defect Rate', data: defect_data },
    { title: 'Work Order Status', data: wo_status },
    { title: 'Workstation Utilization', data: workstations },
  ]
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="Manufacturing Dashboard" subtitle="OEE, production output, defect rates and workstation utilization" exportSections={exportSections} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="OEE" value={`${kpis.oee}%`} color="#51459d" />
        <KPICard label="Monthly Output" value={kpis.monthly_output} color="#6fd943" />
        <KPICard label="Defect Rate" value={`${kpis.defect_rate}%`} color="#ff3a6e" />
        <KPICard label="Active Work Orders" value={kpis.active_work_orders} color="#3ec9d6" />
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Overall Equipment Effectiveness (OEE)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[{label:'OEE Score',value:oee.score},{label:'Availability',value:oee.availability},{label:'Performance',value:oee.performance},{label:'Quality',value:oee.quality}].map((g) => (
            <div key={g.label} className="flex flex-col items-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{g.label}</p>
              <ChartRenderer type="gauge" data={[{name:g.label,value:g.value}]} config={{nameKey:'name',valueKey:'value',colors:['#ff3a6e','#ffa21d','#6fd943']}} height={150} />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Production Output</h3>
          <p className="text-xs text-gray-400 mb-4">Actual vs target</p>
          <ChartRenderer type="bar" data={production_data} config={{xKey:'month',yKeys:['output','target'],colors:['#51459d','#e5e7eb'],showGrid:true,showLegend:true}} height={240} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Defect Rate</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly defect percentage</p>
          <ChartRenderer type="line" data={defect_data} config={{xKey:'month',yKeys:['rate'],colors:['#ff3a6e'],showGrid:true,showLegend:false,smooth:true}} height={240} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Work Order Status</h3>
          <p className="text-xs text-gray-400 mb-4">Current work order distribution</p>
          <ChartRenderer type="donut" data={wo_status} config={{nameKey:'name',valueKey:'value',colors:['#6fd943','#51459d','#3ec9d6','#ffa21d','#ff3a6e'],showLegend:true}} height={260} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Workstation Utilization</h3>
          <p className="text-xs text-gray-400 mb-4">Current capacity usage (%)</p>
          <ChartRenderer type="bar" data={workstations} config={{xKey:'name',yKeys:['utilization'],colors:['#3ec9d6'],showGrid:true,showLegend:false,horizontal:true}} height={260} />
        </div>
      </div>
    </div>
  )
}
