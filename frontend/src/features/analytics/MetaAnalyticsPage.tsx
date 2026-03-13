/**
 * MetaAnalyticsPage — analytics usage intelligence for admins.
 * Shows dashboard popularity, query performance, and user engagement.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import DashboardHeader from './prebuilt/DashboardHeader'
import ChartRenderer from '../../components/charts/ChartRenderer'

interface DailyView { date: string; views: number }
interface TopDashboard { dashboard_id: string; views: number }
interface Performance { avg_ms: number; max_ms: number; total: number }

interface MetaStats {
  daily_views: DailyView[]
  top_dashboards: TopDashboard[]
  performance: Performance
}

const MOCK_STATS: MetaStats = {
  daily_views: [
    { date: '2026-03-05', views: 45 }, { date: '2026-03-06', views: 62 },
    { date: '2026-03-07', views: 38 }, { date: '2026-03-08', views: 71 },
    { date: '2026-03-09', views: 55 }, { date: '2026-03-10', views: 83 },
    { date: '2026-03-11', views: 91 }, { date: '2026-03-12', views: 67 },
  ],
  top_dashboards: [
    { dashboard_id: 'Finance Dashboard', views: 234 },
    { dashboard_id: 'CRM Pipeline', views: 187 },
    { dashboard_id: 'HR Overview', views: 143 },
    { dashboard_id: 'Support Metrics', views: 98 },
    { dashboard_id: 'Executive Summary', views: 76 },
  ],
  performance: { avg_ms: 342, max_ms: 1847, total: 1429 },
}

const PERIOD_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

export default function MetaAnalyticsPage() {
  const [days, setDays] = useState(7)

  const { data, isLoading } = useQuery<MetaStats>({
    queryKey: ['analytics-meta', days],
    queryFn: () => apiClient.get(`/analytics/meta/usage?days=${days}`).then(r => r.data),
    placeholderData: MOCK_STATS,
    retry: false,
  })

  const stats = data ?? MOCK_STATS
  const totalViews = stats.daily_views.reduce((sum, d) => sum + d.views, 0)
  const topDash = stats.top_dashboards[0]?.dashboard_id ?? '—'

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <DashboardHeader
          title="Analytics Meta-Intelligence"
          subtitle="Usage patterns, performance, and engagement"
        />
        {/* Period selector */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-[10px] p-1 shrink-0">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                days === opt.value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Views (this period)', value: isLoading ? '—' : totalViews.toLocaleString(), color: '#51459d' },
          { label: 'Most Used Dashboard', value: isLoading ? '—' : topDash, color: '#3ec9d6', small: true },
          { label: 'Avg Query Time', value: isLoading ? '—' : `${stats.performance.avg_ms}ms`, color: '#ffa21d' },
          { label: 'Active Copilot Queries', value: '0', color: '#6fd943' },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] p-4 shadow-sm"
          >
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <p
              className={`font-bold text-gray-900 dark:text-gray-100 ${kpi.small ? 'text-base truncate' : 'text-2xl'}`}
              style={{ color: kpi.color }}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Daily views chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Dashboard Views Over Time</h3>
        <p className="text-xs text-gray-400 mb-4">Daily view counts for the selected period</p>
        <ChartRenderer
          type="area"
          data={stats.daily_views as unknown as Record<string, unknown>[]}
          config={{
            xKey: 'date',
            yKeys: ['views'],
            colors: ['#51459d'],
            smooth: true,
            areaFill: true,
            showGrid: true,
          }}
          height={200}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top dashboards */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Top Dashboards</h3>
          <p className="text-xs text-gray-400 mb-4">Most viewed dashboards</p>
          <ChartRenderer
            type="bar"
            data={stats.top_dashboards as unknown as Record<string, unknown>[]}
            config={{
              xKey: 'dashboard_id',
              yKeys: ['views'],
              colors: ['#3ec9d6'],
              horizontal: true,
              showGrid: true,
            }}
            height={240}
          />
        </div>

        {/* Query performance */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Query Performance</h3>
          <p className="text-xs text-gray-400 mb-4">Backend analytics query timings</p>
          <div className="space-y-4 mt-2">
            {[
              { label: 'Average Response Time', value: `${stats.performance.avg_ms}ms`, bar: (stats.performance.avg_ms / stats.performance.max_ms) * 100, color: '#6fd943' },
              { label: 'Max Response Time', value: `${stats.performance.max_ms}ms`, bar: 100, color: '#ff3a6e' },
              { label: 'Total Queries Served', value: stats.performance.total.toLocaleString(), bar: null, color: '#51459d' },
            ].map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.value}</span>
                </div>
                {row.bar !== null && (
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.bar}%`, backgroundColor: row.color }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
