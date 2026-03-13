import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import { useModuleKPIs } from '../../../api/analytics_ext'
import DashboardHeader from './DashboardHeader'

export default function ManufacturingDashboard() {
  const { isLoading } = useModuleKPIs('manufacturing')

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  // Production output trend
  const productionData = [
    { month: 'Oct', output: 1200, target: 1300 },
    { month: 'Nov', output: 1350, target: 1300 },
    { month: 'Dec', output: 980, target: 1300 },
    { month: 'Jan', output: 1450, target: 1400 },
    { month: 'Feb', output: 1380, target: 1400 },
    { month: 'Mar', output: 1520, target: 1400 },
  ]

  // Defect rate trend
  const defectData = [
    { month: 'Oct', rate: 2.8 }, { month: 'Nov', rate: 2.2 },
    { month: 'Dec', rate: 3.5 }, { month: 'Jan', rate: 1.9 },
    { month: 'Feb', rate: 1.5 }, { month: 'Mar', rate: 1.7 },
  ]

  // Work order status
  const woStatus = [
    { name: 'Completed', value: 85 },
    { name: 'In Progress', value: 42 },
    { name: 'Queued', value: 28 },
    { name: 'On Hold', value: 8 },
    { name: 'Cancelled', value: 5 },
  ]

  // Workstation utilization
  const workstations = [
    { name: 'CNC Machine', utilization: 88 },
    { name: 'Assembly Line A', utilization: 92 },
    { name: 'Assembly Line B', utilization: 75 },
    { name: 'Paint Shop', utilization: 68 },
    { name: 'QC Station', utilization: 82 },
  ]

  // OEE components
  const oeeAvailability = 91
  const oeePerformance = 85
  const oeeQuality = 97
  const oee = (oeeAvailability * oeePerformance * oeeQuality) / 10000

  const currentOutput = productionData[productionData.length - 1]?.output ?? 0
  const avgDefect = defectData.reduce((s, d) => s + d.rate, 0) / defectData.length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="Manufacturing Dashboard" subtitle="OEE, production output, defect rates and workstation utilization" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="OEE" value={`${oee.toFixed(1)}%`} color="#51459d" change={2.3} />
        <KPICard label="Monthly Output" value={currentOutput} color="#6fd943" change={10.1} />
        <KPICard label="Defect Rate" value={`${avgDefect.toFixed(1)}%`} color="#ff3a6e" change={-4.5} />
        <KPICard label="Active Work Orders" value={42} color="#3ec9d6" />
      </div>

      {/* OEE Gauges */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Overall Equipment Effectiveness (OEE)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col items-center">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">OEE Score</p>
            <ChartRenderer
              type="gauge"
              data={[{ name: 'OEE Score', value: oee }]}
              config={{
                nameKey: 'name',
                valueKey: 'value',
                colors: ['#ff3a6e', '#ffa21d', '#6fd943'],
              }}
              height={150}
            />
          </div>
          <div className="flex flex-col items-center">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Availability</p>
            <ChartRenderer
              type="gauge"
              data={[{ name: 'Availability', value: oeeAvailability }]}
              config={{
                nameKey: 'name',
                valueKey: 'value',
                colors: ['#ff3a6e', '#ffa21d', '#6fd943'],
              }}
              height={150}
            />
          </div>
          <div className="flex flex-col items-center">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Performance</p>
            <ChartRenderer
              type="gauge"
              data={[{ name: 'Performance', value: oeePerformance }]}
              config={{
                nameKey: 'name',
                valueKey: 'value',
                colors: ['#ff3a6e', '#ffa21d', '#6fd943'],
              }}
              height={150}
            />
          </div>
          <div className="flex flex-col items-center">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Quality</p>
            <ChartRenderer
              type="gauge"
              data={[{ name: 'Quality', value: oeeQuality }]}
              config={{
                nameKey: 'name',
                valueKey: 'value',
                colors: ['#ff3a6e', '#ffa21d', '#6fd943'],
              }}
              height={150}
            />
          </div>
        </div>
      </div>

      {/* Production + Defects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Production Output</h3>
          <p className="text-xs text-gray-400 mb-4">Actual vs target</p>
          <ChartRenderer
            type="bar"
            data={productionData}
            config={{
              xKey: 'month',
              yKeys: ['output', 'target'],
              colors: ['#51459d', '#e5e7eb'],
              showGrid: true,
              showLegend: true,
            }}
            height={240}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Defect Rate</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly defect percentage</p>
          <ChartRenderer
            type="line"
            data={defectData}
            config={{
              xKey: 'month',
              yKeys: ['rate'],
              colors: ['#ff3a6e'],
              showGrid: true,
              showLegend: false,
              smooth: true,
            }}
            height={240}
          />
        </div>
      </div>

      {/* WO Status + Workstation Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Work Order Status</h3>
          <p className="text-xs text-gray-400 mb-4">Current work order distribution</p>
          <ChartRenderer
            type="donut"
            data={woStatus}
            config={{
              nameKey: 'name',
              valueKey: 'value',
              colors: ['#6fd943', '#51459d', '#3ec9d6', '#ffa21d', '#ff3a6e'],
              showLegend: true,
            }}
            height={260}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Workstation Utilization</h3>
          <p className="text-xs text-gray-400 mb-4">Current capacity usage (%)</p>
          <ChartRenderer
            type="bar"
            data={workstations}
            config={{
              xKey: 'name',
              yKeys: ['utilization'],
              colors: ['#3ec9d6'],
              showGrid: true,
              showLegend: false,
              horizontal: true,
            }}
            height={260}
          />
        </div>
      </div>
    </div>
  )
}
