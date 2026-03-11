import { useState, useMemo } from 'react'
import { Card, Spinner, Button, Badge } from '../../components/ui'
import { useAIUsage } from '../../api/ai_ext'

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function StatCard({ label, value, subtext, color }: { label: string; value: string; subtext: string; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtext}</p>
    </div>
  )
}

export default function UsageDashboardPage() {
  const [period, setPeriod] = useState('30d')
  const { data: usage, isLoading } = useAIUsage({ period })

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  if (!usage) {
    return <Card><div className="text-center py-16 text-gray-400">No usage data available</div></Card>
  }

  const avgTokensPerReq = usage.total_requests > 0 ? Math.round(usage.total_tokens / usage.total_requests) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Usage Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(usage.period_start).toLocaleDateString()} - {new Date(usage.period_end).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { value: '7d', label: '7 days' },
            { value: '30d', label: '30 days' },
            { value: '90d', label: '90 days' },
          ].map((p) => (
            <Button key={p.value} size="sm" variant={period === p.value ? 'primary' : 'outline'} onClick={() => setPeriod(p.value)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tokens" value={formatNumber(usage.total_tokens)} subtext={`${period} period`} color="#51459d" />
        <StatCard label="Total Requests" value={formatNumber(usage.total_requests)} subtext={`${period} period`} color="#6fd943" />
        <StatCard label="Avg Tokens/Request" value={String(avgTokensPerReq)} subtext="Across all models" color="#3ec9d6" />
        <StatCard label="Models Used" value={String(usage.tokens_by_model.length)} subtext="Active AI models" color="#ffa21d" />
      </div>

      {/* Usage Trend Chart */}
      {usage.tokens_by_day.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Usage Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5">Daily token usage</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#51459d]" />
                Tokens
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#3ec9d6]" />
                Requests
              </div>
            </div>
          </div>
          <UsageChart data={usage.tokens_by_day} />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Tools */}
        <Card className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Top AI Tools Used</h3>
          <p className="text-xs text-gray-400 mb-4">Most frequently called AI tools</p>
          {usage.tokens_by_tool.length === 0 ? (
            <p className="text-sm text-gray-400">No tool data</p>
          ) : (
            <div className="space-y-3">
              {usage.tokens_by_tool
                .sort((a, b) => b.requests - a.requests)
                .slice(0, 10)
                .map((tool) => {
                  const maxReq = Math.max(...usage.tokens_by_tool.map((t) => t.requests), 1)
                  const pct = Math.round((tool.requests / maxReq) * 100)
                  return (
                    <div key={tool.tool}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 font-mono">{tool.tool}</span>
                        <span className="text-gray-500 font-medium">{tool.requests} calls</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#51459d]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </Card>

        {/* Model Usage */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Model Usage</h3>
          <p className="text-xs text-gray-400 mb-4">Tokens by AI model</p>
          {usage.tokens_by_model.length === 0 ? (
            <p className="text-sm text-gray-400">No model data</p>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {usage.tokens_by_model.map((m) => {
                  const pct = usage.total_tokens > 0 ? Math.round((m.tokens / usage.total_tokens) * 100) : 0
                  const colors = ['#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e']
                  const idx = usage.tokens_by_model.indexOf(m) % colors.length
                  return (
                    <div key={m.model} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors[idx] }} />
                        <span className="text-xs text-gray-600">{m.model}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{formatNumber(m.tokens)}</span>
                        <span className="text-[10px] text-gray-400">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex gap-0.5">
                {usage.tokens_by_model.map((m, i) => {
                  const pct = usage.total_tokens > 0 ? Math.round((m.tokens / usage.total_tokens) * 100) : 0
                  const colors = ['#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e']
                  return (
                    <div key={m.model} className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                  )
                })}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

function UsageChart({ data }: { data: { date: string; tokens: number; requests: number }[] }) {
  const W = 700
  const H = 200
  const PAD = { top: 20, right: 30, bottom: 35, left: 50 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom

  const maxTokens = useMemo(() => Math.max(...data.map((d) => d.tokens), 1), [data])

  const xScale = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cW
  const yScale = (v: number) => PAD.top + cH - (v / maxTokens) * cH

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.tokens)}`).join(' ')
  const areaPath = path + ` L ${xScale(data.length - 1)} ${PAD.top + cH} L ${PAD.left} ${PAD.top + cH} Z`

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxTokens / 4) * i))
  const showLabels = data.length <= 15

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="#f1f5f9" strokeWidth="1" />
          <text x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" className="text-[9px] fill-gray-400">
            {formatNumber(v)}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="url(#usageGrad)" opacity="0.3" />
      <defs>
        <linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#51459d" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#51459d" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="#51459d" strokeWidth="2" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xScale(i)} cy={yScale(d.tokens)} r="3" fill="#51459d" />
          {showLabels && (
            <text x={xScale(i)} y={H - 8} textAnchor="middle" className="text-[8px] fill-gray-400">
              {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
