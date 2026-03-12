import { useState } from 'react'
import { useCalendarAnalytics } from '../../api/calendar_analytics'

const PERIOD_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
]

const TYPE_COLORS: Record<string, string> = {
  meeting: '#51459d',
  task: '#6fd943',
  reminder: '#ffa21d',
  holiday: '#ff3a6e',
  focus: '#6366f1',
  booking: '#14b8a6',
  deadline: '#e11d48',
}

export default function CalendarAnalytics() {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useCalendarAnalytics(days)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-400">
        No analytics data available.
      </div>
    )
  }

  const byTypeEntries = Object.entries(data.by_type).sort((a, b) => b[1] - a[1])
  const byPriorityEntries = Object.entries(data.by_priority).sort((a, b) => b[1] - a[1])
  const maxTypeCount = Math.max(...byTypeEntries.map(([, v]) => v), 1)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Calendar Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Insights into your scheduling patterns</p>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                days === opt.value
                  ? 'bg-white dark:bg-gray-700 text-[#51459d] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Events" value={data.total_events} icon="calendar" />
        <KpiCard label="Meeting Hours" value={`${data.total_meeting_hours.toFixed(1)}h`} icon="clock" />
        <KpiCard label="Meetings/Week" value={data.meetings_per_week.toFixed(1)} icon="users" />
        <KpiCard
          label="Focus Time"
          value={`${data.focus_time_ratio_pct.toFixed(0)}%`}
          icon="shield"
          accent={data.focus_time_ratio_pct >= 40 ? 'text-green-600' : 'text-amber-500'}
        />
      </div>

      {/* Avg Meeting Duration + Busiest Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Meeting Duration</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.avg_meeting_minutes.toFixed(0)} <span className="text-sm font-normal text-gray-400">min</span>
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Busiest Day</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
            {data.busiest_day || 'N/A'}
          </p>
        </div>
      </div>

      {/* Events by Type */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Events by Type</h3>
        <div className="space-y-3">
          {byTypeEntries.map(([type, count]) => (
            <div key={type} className="flex items-center gap-3">
              <span className="w-20 text-xs text-gray-500 capitalize">{type}</span>
              <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(count / maxTypeCount) * 100}%`,
                    backgroundColor: TYPE_COLORS[type] || '#94a3b8',
                  }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium text-gray-700 dark:text-gray-300">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Events by Priority */}
      {byPriorityEntries.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Events by Priority</h3>
          <div className="flex gap-4">
            {byPriorityEntries.map(([priority, count]) => (
              <div key={priority} className="flex-1 text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{count}</p>
                <p className="text-xs text-gray-500 capitalize">{priority}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string | number
  icon: string
  accent?: string
}) {
  const icons: Record<string, string> = {
    calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25',
    clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
    users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    shield: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={icons[icon] || icons.calendar} />
        </svg>
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${accent || 'text-gray-900 dark:text-white'}`}>{value}</p>
    </div>
  )
}
