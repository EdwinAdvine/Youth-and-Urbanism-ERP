import { useDashboardStats } from '../../../api/analytics'
import { KPICard, BarChart, PieChart, LineChart, GaugeChart } from '../../../components/charts'
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
          <LineChart
            data={headcountData}
            lines={[{ dataKey: 'headcount', color: '#51459d', name: 'Headcount' }]}
            xKey="month"
            height={240}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Attrition Rate</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly turnover percentage</p>
          <LineChart
            data={attritionData}
            lines={[{ dataKey: 'rate', color: '#ff3a6e', name: 'Attrition %' }]}
            xKey="month"
            height={240}
            formatTooltip={(v) => `${v}%`}
          />
        </div>
      </div>

      {/* Department Distribution + Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Department Distribution</h3>
          <p className="text-xs text-gray-400 mb-4">Employees by department</p>
          <PieChart data={deptDistribution} innerRadius={50} height={260} />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Attendance Breakdown</h3>
          <p className="text-xs text-gray-400 mb-4">Present vs Remote vs Absent (%)</p>
          <BarChart
            data={attendanceData}
            bars={[
              { dataKey: 'present', color: '#6fd943', name: 'Present', stackId: 'a' },
              { dataKey: 'remote', color: '#3ec9d6', name: 'Remote', stackId: 'a' },
              { dataKey: 'absent', color: '#ff3a6e', name: 'Absent', stackId: 'a' },
            ]}
            xKey="month"
            height={260}
            formatTooltip={(v) => `${v}%`}
          />
        </div>
      </div>

      {/* Leave Utilization + Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Leave Utilization</h3>
          <p className="text-xs text-gray-400 mb-4">Days used vs allocated by type</p>
          <BarChart
            data={leaveData}
            bars={[
              { dataKey: 'used', color: '#51459d', name: 'Used' },
              { dataKey: 'total', color: '#e5e7eb', name: 'Allocated' },
            ]}
            xKey="type"
            height={240}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Overall Leave Usage</h3>
          <GaugeChart
            value={leaveUtilization}
            label="Leave Utilization"
            thresholds={[
              { value: 50, color: '#6fd943' },
              { value: 80, color: '#ffa21d' },
              { value: 100, color: '#ff3a6e' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
