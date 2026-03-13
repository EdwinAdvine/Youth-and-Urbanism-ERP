import { useDashboardStats } from '../../../api/analytics'
import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import DashboardHeader from './DashboardHeader'

export default function HRDashboard() {
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  const s = stats ?? { revenue_mtd: 0, revenue_prev: 0, open_invoices: 0, active_employees: 0, active_projects: 0, deals_pipeline: 0 }

  // Headcount trend
  const headcountData = [
    { month: 'Oct', headcount: 48 }, { month: 'Nov', headcount: 49 },
    { month: 'Dec', headcount: 48 }, { month: 'Jan', headcount: 50 },
    { month: 'Feb', headcount: 51 }, { month: 'Mar', headcount: s.active_employees || 52 },
  ]

  // Attrition
  const attritionData = [
    { month: 'Oct', rate: 3.2 }, { month: 'Nov', rate: 2.8 },
    { month: 'Dec', rate: 4.1 }, { month: 'Jan', rate: 2.5 },
    { month: 'Feb', rate: 1.9 }, { month: 'Mar', rate: 2.2 },
  ]

  // Department distribution
  const deptDistribution = [
    { name: 'Engineering', value: 18 },
    { name: 'Sales', value: 12 },
    { name: 'Operations', value: 8 },
    { name: 'Marketing', value: 6 },
    { name: 'HR', value: 4 },
    { name: 'Finance', value: 4 },
  ]

  // Leave utilization
  const leaveData = [
    { type: 'Annual', used: 65, total: 100 },
    { type: 'Sick', used: 28, total: 60 },
    { type: 'Personal', used: 12, total: 30 },
    { type: 'Maternity', used: 5, total: 10 },
  ]

  // Attendance trend
  const attendanceData = [
    { month: 'Oct', present: 92, remote: 5, absent: 3 },
    { month: 'Nov', present: 90, remote: 6, absent: 4 },
    { month: 'Dec', present: 85, remote: 8, absent: 7 },
    { month: 'Jan', present: 93, remote: 4, absent: 3 },
    { month: 'Feb', present: 91, remote: 6, absent: 3 },
    { month: 'Mar', present: 88, remote: 7, absent: 5 },
  ]

  const avgAttrition = attritionData.reduce((s, d) => s + d.rate, 0) / attritionData.length
  const leaveUtilization = leaveData.reduce((s, l) => s + l.used, 0) / leaveData.reduce((s, l) => s + l.total, 0) * 100

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="HR Dashboard" subtitle="Headcount, attrition, attendance and leave analytics" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Active Employees" value={s.active_employees || 52} color="#51459d" change={3.9} />
        <KPICard label="Attrition Rate" value={`${avgAttrition.toFixed(1)}%`} color="#ff3a6e" change={-1.2} />
        <KPICard label="Attendance Rate" value="88%" color="#6fd943" />
        <KPICard label="Leave Utilization" value={`${leaveUtilization.toFixed(0)}%`} color="#ffa21d" />
      </div>

      {/* Headcount + Attrition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Headcount Trend</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly employee count</p>
          <ChartRenderer
            type="line"
            data={headcountData}
            config={{
              xKey: 'month',
              yKeys: ['headcount'],
              colors: ['#51459d'],
              showGrid: true,
              showLegend: false,
              smooth: true,
            }}
            height={240}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Attrition Rate</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly turnover percentage</p>
          <ChartRenderer
            type="line"
            data={attritionData}
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

      {/* Department Distribution + Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Department Distribution</h3>
          <p className="text-xs text-gray-400 mb-4">Employees by department</p>
          <ChartRenderer
            type="donut"
            data={deptDistribution}
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
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Attendance Breakdown</h3>
          <p className="text-xs text-gray-400 mb-4">Present vs Remote vs Absent (%)</p>
          <ChartRenderer
            type="bar"
            data={attendanceData}
            config={{
              xKey: 'month',
              yKeys: ['present', 'remote', 'absent'],
              colors: ['#6fd943', '#3ec9d6', '#ff3a6e'],
              showGrid: true,
              showLegend: true,
              stacked: true,
            }}
            height={260}
          />
        </div>
      </div>

      {/* Leave Utilization + Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Leave Utilization</h3>
          <p className="text-xs text-gray-400 mb-4">Days used vs allocated by type</p>
          <ChartRenderer
            type="bar"
            data={leaveData}
            config={{
              xKey: 'type',
              yKeys: ['used', 'total'],
              colors: ['#51459d', '#e5e7eb'],
              showGrid: true,
              showLegend: true,
            }}
            height={240}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Overall Leave Usage</h3>
          <ChartRenderer
            type="gauge"
            data={[{ name: 'Leave Utilization', value: leaveUtilization }]}
            config={{
              nameKey: 'name',
              valueKey: 'value',
              colors: ['#6fd943', '#ffa21d', '#ff3a6e'],
            }}
            height={200}
          />
        </div>
      </div>
    </div>
  )
}
