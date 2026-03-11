import './print-styles.css'
import { Card, Badge, Spinner } from '../../components/ui'
import { useExecutiveSummary, useModuleKPIs, useModuleTrends } from '../../api/analytics_ext'

function KPICard({ label, value, change, color }: { label: string; value: string; change?: number; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="w-3 h-8 rounded-full" style={{ backgroundColor: color }} />
        {change !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${change >= 0 ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `KSh ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `KSh ${(val / 1_000).toFixed(0)}K`
  return `KSh ${val.toFixed(0)}`
}

export default function ExecutiveDashboardPage() {
  const { data: executive, isLoading: execLoading } = useExecutiveSummary()
  const { data: moduleKPIs, isLoading: kpisLoading } = useModuleKPIs()
  const { data: trends, isLoading: trendsLoading } = useModuleTrends({ period: 'monthly' })

  const isLoading = execLoading || kpisLoading

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  const MODULE_COLORS: Record<string, string> = {
    finance: '#51459d',
    hr: '#3ec9d6',
    crm: '#6fd943',
    inventory: '#ffa21d',
    support: '#ff3a6e',
    projects: '#51459d',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">High-level business overview across all modules</p>
        </div>
        <Badge variant="primary" className="text-xs">Live Data</Badge>
      </div>

      {/* Top-level KPIs from Executive Summary */}
      {executive && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Revenue (MTD)"
            value={formatCurrency(executive.total_revenue)}
            change={executive.revenue_change}
            color="#51459d"
          />
          <KPICard
            label="Total Expenses (MTD)"
            value={formatCurrency(executive.total_expenses)}
            change={executive.expense_change}
            color="#ff3a6e"
          />
          <KPICard
            label="Net Profit"
            value={formatCurrency(executive.total_revenue - executive.total_expenses)}
            color="#6fd943"
          />
          <KPICard
            label="Active Users"
            value={executive.active_users?.toString() || '0'}
            color="#3ec9d6"
          />
        </div>
      )}

      {/* Revenue vs Expenses Trend */}
      {trends && trends.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Module Activity Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5">Monthly activity across modules</p>
            </div>
          </div>
          <div className="space-y-3">
            {trends.map((t) => {
              const maxVal = Math.max(...trends.map((x) => x.value), 1)
              return (
                <div key={`${t.module}-${t.period}`} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 shrink-0 text-right">{t.period}</span>
                  <div className="w-20 shrink-0">
                    <Badge variant="primary">{t.module}</Badge>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(t.value / maxVal) * 100}%`,
                        backgroundColor: MODULE_COLORS[t.module] || '#51459d',
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-20 text-right">{t.value.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Module KPI Sections */}
      {moduleKPIs && moduleKPIs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {moduleKPIs.map((mk) => (
            <Card key={mk.module}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-6 rounded-full" style={{ backgroundColor: MODULE_COLORS[mk.module] || '#51459d' }} />
                <h3 className="text-sm font-semibold text-gray-900 capitalize">{mk.module}</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(mk.kpis).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {typeof val === 'number' ? val.toLocaleString() : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Bottom Row: Pending Actions + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {executive && executive.pending_actions && (
          <Card>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pending Actions</h4>
            <div className="space-y-2">
              {Object.entries(executive.pending_actions).map(([label, count]) => (
                <div key={label} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-gray-600">
                    {label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <Badge variant={Number(count) > 5 ? 'danger' : Number(count) > 0 ? 'warning' : 'success'}>
                    {String(count)}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {executive && executive.system_health && (
          <Card>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">System Health</h4>
            <div className="space-y-3">
              {Object.entries(executive.system_health).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-gray-600">
                      {label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{String(value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Fallback if no data from API yet */}
      {!executive && !moduleKPIs && (
        <Card className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500 mb-2">No executive data available yet</p>
          <p className="text-xs text-gray-400">Data will appear once modules have activity</p>
        </Card>
      )}
    </div>
  )
}
