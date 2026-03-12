import { useState, useMemo } from 'react'
import { useTeamsAnalytics, useLiveTeamsAnalytics } from '@/api/chatExtended'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveStats {
  messages_today: number
  active_channels: number
  active_members: number
  active_calls: number
}

interface ChannelStat {
  id: string
  name: string
  message_count: number
  member_count: number
}

interface UserStat {
  id: string
  name: string
  messages_sent: number
  reaction_count: number
}

interface SentimentData {
  positive: number
  neutral: number
  negative: number
}

interface AnalyticsData {
  top_channels: ChannelStat[]
  top_users: UserStat[]
  sentiment: SentimentData
  daily_messages: { date: string; count: number }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

type RangeKey = '7d' | '30d' | '90d'

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateRange(days: number) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  return {
    from_date: from.toISOString().split('T')[0],
    to_date: to.toISOString().split('T')[0],
  }
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiveStatCard({
  label,
  value,
  color,
  pulse,
}: {
  label: string
  value: number | string
  color: string
  pulse?: boolean
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-[10px] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {pulse && <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />}
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function BarChart({ data, maxHeight = 120 }: { data: { date: string; count: number }[]; maxHeight?: number }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="flex items-end gap-1 h-full" style={{ minHeight: maxHeight }}>
      {data.map((d) => {
        const height = Math.max((d.count / maxCount) * maxHeight, 2)
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex justify-center">
              <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap transition-opacity">
                {d.count} msgs
              </div>
              <div
                className="w-full max-w-[24px] rounded-t-[4px] bg-[#51459d] hover:bg-[#3d3480] transition-colors"
                style={{ height }}
              />
            </div>
            <span className="text-[9px] text-gray-400 whitespace-nowrap">
              {new Date(d.date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SentimentBar({ sentiment }: { sentiment: SentimentData }) {
  const total = sentiment.positive + sentiment.neutral + sentiment.negative || 1
  const pct = {
    positive: Math.round((sentiment.positive / total) * 100),
    neutral: Math.round((sentiment.neutral / total) * 100),
    negative: Math.round((sentiment.negative / total) * 100),
  }

  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden">
        <div className="bg-[#6fd943] transition-all" style={{ width: `${pct.positive}%` }} />
        <div className="bg-[#ffa21d] transition-all" style={{ width: `${pct.neutral}%` }} />
        <div className="bg-[#ff3a6e] transition-all" style={{ width: `${pct.negative}%` }} />
      </div>
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#6fd943]" />
          <span className="text-gray-600">Positive {pct.positive}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffa21d]" />
          <span className="text-gray-600">Neutral {pct.neutral}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff3a6e]" />
          <span className="text-gray-600">Negative {pct.negative}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TeamsAnalyticsDashboard() {
  const [range, setRange] = useState<RangeKey>('30d')

  const rangeDef = RANGE_OPTIONS.find((r) => r.key === range)!
  const dateRange = useMemo(() => getDateRange(rangeDef.days), [rangeDef.days])

  const { data: liveData, isLoading: liveLoading } = useLiveTeamsAnalytics()
  const { data: analyticsData, isLoading: analyticsLoading } = useTeamsAnalytics(dateRange)

  const live: LiveStats = liveData ?? {
    messages_today: 0,
    active_channels: 0,
    active_members: 0,
    active_calls: 0,
  }

  const analytics: AnalyticsData = analyticsData ?? {
    top_channels: [],
    top_users: [],
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    daily_messages: [],
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Teams Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time usage metrics and historical trends
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-[8px] p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors ${
                range === opt.key
                  ? 'bg-white text-[#51459d] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Live Stats */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Live
          </h2>
          {liveLoading ? (
            <div className="text-sm text-gray-400 text-center py-4">Loading live stats...</div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <LiveStatCard
                label="Messages Today"
                value={formatNumber(live.messages_today)}
                color="#51459d"
              />
              <LiveStatCard
                label="Active Channels"
                value={live.active_channels}
                color="#3ec9d6"
              />
              <LiveStatCard
                label="Active Members"
                value={live.active_members}
                color="#6fd943"
              />
              <LiveStatCard
                label="Active Calls"
                value={live.active_calls}
                color="#ffa21d"
                pulse={live.active_calls > 0}
              />
            </div>
          )}
        </div>

        {/* Daily Messages Chart */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Message Volume
          </h2>
          <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
            {analyticsLoading ? (
              <div className="text-sm text-gray-400 text-center py-8">Loading chart...</div>
            ) : analytics.daily_messages.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-8">No data for this period</div>
            ) : (
              <BarChart data={analytics.daily_messages} maxHeight={140} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Top Channels */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Top Channels
            </h2>
            <div className="bg-white border border-gray-100 rounded-[10px] shadow-sm overflow-hidden">
              {analyticsLoading ? (
                <div className="text-sm text-gray-400 text-center py-8">Loading...</div>
              ) : analytics.top_channels.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-8">No channel data</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">
                        Channel
                      </th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">
                        Messages
                      </th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">
                        Members
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.top_channels.map((ch, i) => (
                      <tr
                        key={ch.id}
                        className={`${i !== analytics.top_channels.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50`}
                      >
                        <td className="py-2 px-4 text-xs font-medium text-gray-800">
                          #{ch.name}
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-600 text-right">
                          {formatNumber(ch.message_count)}
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-600 text-right">
                          {ch.member_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Top Users */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Top Users
            </h2>
            <div className="bg-white border border-gray-100 rounded-[10px] shadow-sm overflow-hidden">
              {analyticsLoading ? (
                <div className="text-sm text-gray-400 text-center py-8">Loading...</div>
              ) : analytics.top_users.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-8">No user data</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">
                        User
                      </th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">
                        Messages
                      </th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">
                        Reactions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.top_users.map((user, i) => (
                      <tr
                        key={user.id}
                        className={`${i !== analytics.top_users.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50`}
                      >
                        <td className="py-2 px-4 text-xs font-medium text-gray-800">
                          {user.name}
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-600 text-right">
                          {formatNumber(user.messages_sent)}
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-600 text-right">
                          {user.reaction_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Sentiment Overview */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Sentiment Overview
          </h2>
          <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
            {analyticsLoading ? (
              <div className="text-sm text-gray-400 text-center py-4">Loading...</div>
            ) : (
              <SentimentBar sentiment={analytics.sentiment} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
