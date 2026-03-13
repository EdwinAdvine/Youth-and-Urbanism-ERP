import { useDashboardStats } from '../../../api/analytics'
import { useModuleKPIs } from '../../../api/analytics_ext'
import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import DashboardHeader from './DashboardHeader'

function formatKSh(value: number) {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toLocaleString()}`
}

export default function CRMDashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { isLoading: kpisLoading } = useModuleKPIs('crm')

  const isLoading = statsLoading || kpisLoading

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  const s = stats ?? { revenue_mtd: 0, revenue_prev: 0, open_invoices: 0, active_employees: 0, active_projects: 0, deals_pipeline: 0 }

  // Pipeline stages (representative data)
  const pipelineStages = [
    { name: 'Leads', value: 245 },
    { name: 'Qualified', value: 180 },
    { name: 'Proposal', value: 95 },
    { name: 'Negotiation', value: 52 },
    { name: 'Closed Won', value: 28 },
  ]

  // Conversion trend
  const conversionData = [
    { month: 'Oct', rate: 11.2 }, { month: 'Nov', rate: 12.5 },
    { month: 'Dec', rate: 10.8 }, { month: 'Jan', rate: 13.1 },
    { month: 'Feb', rate: 14.2 }, { month: 'Mar', rate: 11.4 },
  ]

  // Deal velocity
  const velocityData = [
    { month: 'Oct', days: 42 }, { month: 'Nov', days: 38 },
    { month: 'Dec', days: 45 }, { month: 'Jan', days: 35 },
    { month: 'Feb', days: 32 }, { month: 'Mar', days: 30 },
  ]

  // Lead sources
  const leadSources = [
    { name: 'Website', value: 85 },
    { name: 'Referral', value: 62 },
    { name: 'Cold Call', value: 45 },
    { name: 'Social Media', value: 33 },
    { name: 'Events', value: 20 },
  ]

  // Deal size distribution
  const dealSizes = [
    { range: '< KSh 50K', count: 12 },
    { range: 'KSh 50K-100K', count: 22 },
    { range: 'KSh 100K-500K', count: 18 },
    { range: 'KSh 500K-1M', count: 8 },
    { range: '> KSh 1M', count: 4 },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="CRM Dashboard" subtitle="Pipeline, conversions, deal velocity and lead analytics" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Pipeline Deals" value={s.deals_pipeline} color="#51459d" change={8.3} />
        <KPICard label="Pipeline Value" value={formatKSh(s.deals_pipeline * 125000)} color="#6fd943" />
        <KPICard label="Conversion Rate" value="11.4%" color="#3ec9d6" change={-2.1} />
        <KPICard label="Avg Deal Size" value={formatKSh(185000)} color="#ffa21d" change={5.7} />
      </div>

      {/* Pipeline Funnel + Lead Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Sales Pipeline</h3>
          <p className="text-xs text-gray-400 mb-4">Funnel conversion by stage</p>
          <ChartRenderer
            type="funnel"
            data={pipelineStages}
            config={{
              nameKey: 'name',
              valueKey: 'value',
              colors: ['#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e'],
              showLegend: true,
            }}
            height={260}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Lead Sources</h3>
          <p className="text-xs text-gray-400 mb-4">Where leads come from</p>
          <ChartRenderer
            type="donut"
            data={leadSources}
            config={{
              nameKey: 'name',
              valueKey: 'value',
              colors: ['#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e'],
              showLegend: true,
            }}
            height={260}
          />
        </div>
      </div>

      {/* Conversion Rate + Deal Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Conversion Rate Trend</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly lead-to-deal conversion</p>
          <ChartRenderer
            type="line"
            data={conversionData}
            config={{
              xKey: 'month',
              yKeys: ['rate'],
              colors: ['#6fd943'],
              showGrid: true,
              showLegend: false,
              smooth: true,
            }}
            height={240}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Deal Velocity</h3>
          <p className="text-xs text-gray-400 mb-4">Average days to close</p>
          <ChartRenderer
            type="bar"
            data={velocityData}
            config={{
              xKey: 'month',
              yKeys: ['days'],
              colors: ['#3ec9d6'],
              showGrid: true,
              showLegend: false,
            }}
            height={240}
          />
        </div>
      </div>

      {/* Deal Size Distribution */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Deal Size Distribution</h3>
        <p className="text-xs text-gray-400 mb-4">Number of deals by value range</p>
        <ChartRenderer
          type="bar"
          data={dealSizes}
          config={{
            xKey: 'range',
            yKeys: ['count'],
            colors: ['#51459d'],
            showGrid: true,
            showLegend: false,
          }}
          height={240}
        />
      </div>
    </div>
  )
}
