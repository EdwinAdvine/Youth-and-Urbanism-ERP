import { KPICard, BarChart, LineChart, GaugeChart, PieChart } from '../../../components/charts'
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
      <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Overall Equipment Effectiveness (OEE)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col items-center">
            <GaugeChart value={oee} label="OEE Score" size={150} />
          </div>
          <div className="flex flex-col items-center">
            <GaugeChart
              value={oeeAvailability}
              label="Availability"
              size={150}
              thresholds={[{ value: 80, color: '#ff3a6e' }, { value: 90, color: '#ffa21d' }, { value: 100, color: '#6fd943' }]}
            />
          </div>
          <div className="flex flex-col items-center">
            <GaugeChart
              value={oeePerformance}
              label="Performance"
              size={150}
              thresholds={[{ value: 70, color: '#ff3a6e' }, { value: 85, color: '#ffa21d' }, { value: 100, color: '#6fd943' }]}
            />
          </div>
          <div className="flex flex-col items-center">
            <GaugeChart
              value={oeeQuality}
              label="Quality"
              size={150}
              thresholds={[{ value: 90, color: '#ff3a6e' }, { value: 95, color: '#ffa21d' }, { value: 100, color: '#6fd943' }]}
            />
          </div>
        </div>
      </div>

      {/* Production + Defects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Production Output</h3>
          <p className="text-xs text-gray-400 mb-4">Actual vs target</p>
          <BarChart
            data={productionData}
            bars={[
              { dataKey: 'output', color: '#51459d', name: 'Actual' },
              { dataKey: 'target', color: '#e5e7eb', name: 'Target' },
            ]}
            xKey="month"
            height={240}
          />
        </div>

        <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Defect Rate</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly defect percentage</p>
          <LineChart
            data={defectData}
            lines={[{ dataKey: 'rate', color: '#ff3a6e', name: 'Defect %' }]}
            xKey="month"
            height={240}
            formatTooltip={(v) => `${v}%`}
          />
        </div>
      </div>

      {/* WO Status + Workstation Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Work Order Status</h3>
          <p className="text-xs text-gray-400 mb-4">Current work order distribution</p>
          <PieChart data={woStatus} innerRadius={50} height={260} />
        </div>

        <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Workstation Utilization</h3>
          <p className="text-xs text-gray-400 mb-4">Current capacity usage (%)</p>
          <BarChart
            data={workstations}
            bars={[{ dataKey: 'utilization', color: '#3ec9d6', name: 'Utilization %' }]}
            xKey="name"
            height={260}
            formatTooltip={(v) => `${v}%`}
          />
        </div>
      </div>
    </div>
  )
}
