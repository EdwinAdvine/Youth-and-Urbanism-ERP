import './print-styles.css'
import { useState } from 'react'
import {
  useRevenueStats,
  useModuleUsageStats,
  useExpenseStats,
  useSupportMetrics,
  useDashboardStats,
  useTopProducts,
  type DashboardStats,
} from '../../api/analytics'

// ─── Design token colors for module usage donut ─────────────────────────────

const MODULE_COLORS: Record<string, string> = {
  Finance:        '#51459d',
  HR:             '#3ec9d6',
  CRM:            '#6fd943',
  Projects:       '#ffa21d',
  Inventory:      '#ff3a6e',
  Drive:          '#4a90d9',
  Notes:          '#9b59b6',
  Calendar:       '#e67e22',
  'AI Assistant': '#2ecc71',
  Users:          '#95a5a6',
}

const FALLBACK_COLORS = ['#51459d', '#3ec9d6', '#6fd943', '#ffa21d', '#ff3a6e']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKSh(value: number) {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toLocaleString()}`
}

function pctChange(current: number, previous: number) {
  if (!previous) return 0
  return Math.round(((current - previous) / previous) * 100)
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function BarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-1.5 h-28 px-1">
      {data.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full rounded-t-[3px] transition-all duration-300 relative"
            style={{ height: `${(val / max) * 100}%`, backgroundColor: color, opacity: 0.85 }}
            title={`${labels[i]}: ${val.toFixed(1)}M`}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {val.toFixed(1)}M
            </div>
          </div>
          <span className="text-[8px] text-gray-400 leading-none">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  let cumulative = 0
  const radius = 40
  const cx = 60
  const cy = 60
  const strokeWidth = 16

  return (
    <div className="flex items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {segments.map((seg) => {
          const pct = seg.value / total
          cumulative += seg.value

          const circumference = 2 * Math.PI * radius
          const dashLength = pct * circumference - 2

          return (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-((cumulative - seg.value) / total) * circumference + circumference * 0.25}
              strokeLinecap="butt"
            />
          )
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1f2937">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#9ca3af">usage</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{seg.label}</span>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 ml-auto">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, change, color, icon }: { label: string; value: string; change?: number; color: string; icon: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-[8px] flex items-center justify-center text-lg" style={{ backgroundColor: color + '20' }}>
          {icon}
        </div>
        {change !== undefined && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${change >= 0 ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DEFAULT_STATS: DashboardStats = {
  revenue_mtd: 0,
  revenue_prev: 0,
  open_invoices: 0,
  active_employees: 0,
  active_projects: 0,
  deals_pipeline: 0,
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<'overview' | 'finance' | 'operations'>('overview')
  const [topProductsLimit, setTopProductsLimit] = useState(10)

  // KPI cards
  const { data: stats } = useDashboardStats()
  const s = stats ?? DEFAULT_STATS
  const revChange = pctChange(s.revenue_mtd, s.revenue_prev)

  // Revenue trend
  const { data: revenueData } = useRevenueStats()
  const revenueValues = revenueData?.data?.map((d) => d.revenue / 1_000_000) ?? []
  const revenueLabels = revenueData?.data?.map((d) => d.month) ?? []

  // Expense trend
  const { data: expenseData } = useExpenseStats()
  const expenseValues = expenseData?.data?.map((d) => d.expenses / 1_000_000) ?? []
  const expenseLabels = expenseData?.data?.map((d) => d.month) ?? []

  // Module usage
  const { data: moduleData } = useModuleUsageStats()
  const moduleSegments = moduleData?.modules?.map((m, i) => ({
    label: m.module,
    value: m.count,
    color: MODULE_COLORS[m.module] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  })) ?? []

  // Support metrics
  const { data: supportData } = useSupportMetrics()
  const support = supportData?.data ?? { open: 0, resolved: 0, closed: 0, total: 0 }

  // Top products
  const { data: topProductsData, isLoading: topProductsLoading } = useTopProducts(topProductsLimit)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-5 py-2 sm:py-3 flex items-center gap-3 sm:gap-4 shrink-0">
        <h1 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>
        <div className="flex-1" />
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-[8px] overflow-hidden">
          {(['overview', 'finance', 'operations'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-[#51459d] text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 max-w-5xl mx-auto">
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label="Revenue MTD"       value={formatKSh(s.revenue_mtd)}    change={revChange} color="#51459d" icon="💰" />
              <StatCard label="Open Invoices"     value={String(s.open_invoices)}      color="#ffa21d"    icon="📄" />
              <StatCard label="Active Employees"  value={String(s.active_employees)}   color="#3ec9d6"    icon="👥" />
              <StatCard label="Active Projects"   value={String(s.active_projects)}    color="#6fd943"    icon="📋" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Revenue trend */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Revenue Trend</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Monthly revenue (KSh M)</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 rounded-sm bg-[#51459d]" />
                    2026
                  </div>
                </div>
                {revenueValues.length > 0 ? (
                  <BarChart data={revenueValues} labels={revenueLabels} color="#51459d" />
                ) : (
                  <div className="h-28 flex items-center justify-center text-xs text-gray-400">
                    Loading revenue data...
                  </div>
                )}
              </div>

              {/* Module usage */}
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Module Usage</h3>
                <p className="text-xs text-gray-400 mb-4">By feature access</p>
                {moduleSegments.length > 0 ? (
                  <DonutChart segments={moduleSegments} />
                ) : (
                  <div className="h-28 flex items-center justify-center text-xs text-gray-400">
                    Loading module data...
                  </div>
                )}
              </div>
            </div>

            {/* Additional metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-4 shadow-sm">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Customers (Revenue)</h4>
                <div className="space-y-2.5">
                  {[
                    { name: 'Acme Corp', value: 'KSh 420K', pct: 82 },
                    { name: 'TechStar Ltd', value: 'KSh 310K', pct: 61 },
                    { name: 'Greenleaf Co', value: 'KSh 280K', pct: 55 },
                    { name: 'SafariNet',   value: 'KSh 195K', pct: 38 },
                  ].map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 dark:text-gray-300">{c.name}</span>
                        <span className="text-gray-500 font-medium">{c.value}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#51459d]" style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-4 shadow-sm">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Invoice Status</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Paid',     count: 34, color: '#6fd943' },
                    { label: 'Pending',  count: 18, color: '#ffa21d' },
                    { label: 'Overdue',  count: 5,  color: '#ff3a6e' },
                    { label: 'Draft',    count: 8,  color: '#9ca3af' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{item.count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden flex gap-0.5">
                    {[{ pct: 52, color: '#6fd943' }, { pct: 28, color: '#ffa21d' }, { pct: 8, color: '#ff3a6e' }, { pct: 12, color: '#9ca3af' }].map((s, i) => (
                      <div key={i} className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-4 shadow-sm">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">HR Overview</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Present today',  value: '44', total: '52', color: '#6fd943' },
                    { label: 'On leave',       value: '5',  total: '52', color: '#ffa21d' },
                    { label: 'Remote',         value: '3',  total: '52', color: '#3ec9d6' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{item.value}<span className="text-gray-400 font-normal">/{item.total}</span></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(parseInt(item.value) / parseInt(item.total)) * 100}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Selling Products */}
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top Selling Products</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Ranked by units sold</p>
                </div>
                <select
                  value={topProductsLimit}
                  onChange={(e) => setTopProductsLimit(Number(e.target.value))}
                  className="text-xs border border-gray-200 dark:border-gray-700 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                >
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                  <option value={20}>Top 20</option>
                </select>
              </div>
              {topProductsLoading ? (
                <div className="h-28 flex items-center justify-center text-xs text-gray-400">Loading...</div>
              ) : (topProductsData?.data ?? []).length === 0 ? (
                <div className="h-28 flex items-center justify-center text-xs text-gray-400">No product data available</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 w-8">#</th>
                        <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Product Name</th>
                        <th className="text-right py-2 pr-3 text-xs font-semibold text-gray-500 w-24">Units Sold</th>
                        <th className="text-right py-2 text-xs font-semibold text-gray-500 w-28">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(topProductsData?.data ?? []).map((p: { name: string; units_sold: number; revenue: number }, i: number) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-2 pr-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                          <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{p.units_sold.toLocaleString()}</td>
                          <td className="py-2 text-right font-medium text-gray-900 dark:text-gray-100">{formatKSh(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'finance' && (
          <div className="p-5 space-y-5 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Revenue */}
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Revenue Trend</h3>
                <p className="text-xs text-gray-400 mb-4">Monthly revenue (KSh M)</p>
                {revenueValues.length > 0 ? (
                  <BarChart data={revenueValues} labels={revenueLabels} color="#51459d" />
                ) : (
                  <div className="h-28 flex items-center justify-center text-xs text-gray-400">No data yet</div>
                )}
              </div>

              {/* Expenses */}
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Expense Trend</h3>
                <p className="text-xs text-gray-400 mb-4">Monthly expenses (KSh M)</p>
                {expenseValues.length > 0 ? (
                  <BarChart data={expenseValues} labels={expenseLabels} color="#ff3a6e" />
                ) : (
                  <div className="h-28 flex items-center justify-center text-xs text-gray-400">No data yet</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label="Revenue MTD" value={formatKSh(s.revenue_mtd)} change={revChange} color="#51459d" icon="💰" />
              <StatCard label="Open Invoices" value={String(s.open_invoices)} color="#ffa21d" icon="📄" />
              <StatCard label="Pipeline Deals" value={String(s.deals_pipeline)} color="#6fd943" icon="🤝" />
              <StatCard label="Active Projects" value={String(s.active_projects)} color="#3ec9d6" icon="📋" />
            </div>
          </div>
        )}

        {tab === 'operations' && (
          <div className="p-5 space-y-5 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label="Open Tickets" value={String(support.open)} color="#ff3a6e" icon="🎫" />
              <StatCard label="Resolved" value={String(support.resolved)} color="#6fd943" icon="✅" />
              <StatCard label="Total Tickets" value={String(support.total)} color="#51459d" icon="📊" />
              <StatCard label="Active Employees" value={String(s.active_employees)} color="#3ec9d6" icon="👥" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Module usage */}
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Module Usage</h3>
                <p className="text-xs text-gray-400 mb-4">Records by module</p>
                {moduleSegments.length > 0 ? (
                  <DonutChart segments={moduleSegments} />
                ) : (
                  <div className="h-28 flex items-center justify-center text-xs text-gray-400">Loading...</div>
                )}
              </div>

              {/* Support breakdown */}
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Support Tickets</h3>
                <p className="text-xs text-gray-400 mb-4">Current status breakdown</p>
                <div className="space-y-3">
                  {[
                    { label: 'Open', value: support.open, color: '#ff3a6e' },
                    { label: 'Resolved', value: support.resolved, color: '#6fd943' },
                    { label: 'Closed', value: support.closed, color: '#9ca3af' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{item.value}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: support.total ? `${(item.value / support.total) * 100}%` : '0%',
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
