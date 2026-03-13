import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFormAnalytics } from '@/api/forms_ext'
import type { FormAnalytics } from '@/api/forms_ext'

interface LiveAnalyticsDashboardProps {
  formId: string
}

// ─── Animated Counter ────────────────────────────────────────────────────────

function useAnimatedCounter(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target
    const start = Date.now()
    const from = value

    function tick() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return value
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const last7 = data.slice(-7)
  const maxVal = Math.max(...last7.map((d) => d.count), 1)

  return (
    <div className="flex items-end gap-2 h-24">
      {last7.map((d, i) => {
        const pct = (d.count / maxVal) * 100
        return (
          <div key={i} className="flex flex-col items-center flex-1 gap-1">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{d.count}</span>
            <div className="w-full relative" style={{ height: '64px' }}>
              <div
                className="absolute bottom-0 w-full rounded-t-[4px] transition-all duration-500"
                style={{ height: `${pct}%`, backgroundColor: '#51459d' }}
              />
            </div>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 truncate w-full text-center">
              {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Percentage Pill ─────────────────────────────────────────────────────────

function PercentPill({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[130px]">{label}</span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: '#3ec9d6' }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LiveAnalyticsDashboard({ formId }: LiveAnalyticsDashboardProps) {
  const { data: analytics, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['forms', formId, 'analytics'],
    queryFn: async () => {
      const { default: apiClient } = await import('@/api/client')
      const res = await apiClient.get<FormAnalytics>(`/forms/${formId}/analytics`)
      return res.data
    },
    enabled: !!formId,
    refetchInterval: 10_000,
  })

  // Shadowed hook result for comparison
  useFormAnalytics(formId) // ensures the cache is warm

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const totalCounter = useAnimatedCounter(analytics?.total_responses ?? 0)

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt))
  }, [dataUpdatedAt])

  const avgMinutes = analytics
    ? Math.round((analytics.avg_completion_time_seconds ?? 0) / 60)
    : 0

  const recentSubmissions = analytics?.responses_by_day?.slice(-5).reverse() ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" style={{ fontFamily: 'Open Sans, sans-serif' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: '#51459d', borderTopColor: 'transparent' }}
          />
          <p className="text-sm text-gray-500">Loading analytics…</p>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" style={{ fontFamily: 'Open Sans, sans-serif' }}>
        <p className="text-sm text-gray-500">No analytics data available yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5" style={{ fontFamily: 'Open Sans, sans-serif' }}>
      {/* Live Indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: '#6fd943' }}
          />
          <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: '#6fd943' }} />
        </span>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Live — Refreshing every 10s
          {lastUpdated && (
            <span className="ml-2 text-gray-400">
              (last: {lastUpdated.toLocaleTimeString()})
            </span>
          )}
        </span>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Total Responses
          </p>
          <p className="text-4xl font-bold mt-1" style={{ color: '#51459d' }}>
            {totalCounter.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Response Rate
          </p>
          <p className="text-4xl font-bold mt-1" style={{ color: '#6fd943' }}>
            {(analytics.response_rate ?? 0).toFixed(1)}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Avg Completion
          </p>
          <p className="text-4xl font-bold mt-1" style={{ color: '#3ec9d6' }}>
            {avgMinutes}m
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Responses by Day Chart */}
        {analytics.responses_by_day?.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Responses — Last 7 Days
            </h3>
            <BarChart data={analytics.responses_by_day} />
          </div>
        )}

        {/* Recent Submissions Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Submissions
          </h3>
          {recentSubmissions.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No recent submissions.</p>
          ) : (
            <ul className="space-y-2">
              {recentSubmissions.map((day, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {new Date(day.date).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span
                    className="text-sm font-semibold px-2.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: '#51459d' }}
                  >
                    {day.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Per-field Breakdown */}
      {analytics.field_summaries?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Field Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {analytics.field_summaries.map((field) => {
              const sortedValues = Object.entries(field.values ?? {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
              const total = Object.values(field.values ?? {}).reduce((s, n) => s + n, 0) || 1

              return (
                <div key={field.field_id}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {field.label}
                    </p>
                    <span className="text-xs text-gray-400 ml-2 shrink-0">
                      {field.response_count} responses
                    </span>
                  </div>
                  {sortedValues.length > 0 ? (
                    sortedValues.map(([key, count]) => (
                      <PercentPill key={key} label={key} pct={(count / total) * 100} />
                    ))
                  ) : (
                    <p className="text-xs text-gray-400">No data</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
