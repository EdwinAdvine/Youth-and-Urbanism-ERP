import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, Badge, Select, Spinner } from '../../components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

interface HealthScore {
  score: number
  conversion_rate: number
  cart_abandonment: number
  revenue_growth: number
  repeat_purchase_rate: number
}

interface RFMSegment {
  segment: string
  count: number
  revenue_share: number
}

interface ForecastPoint {
  date: string
  predicted_revenue: number
}

interface CohortRow {
  cohort: string
  months: number[]
}

interface AIInsight {
  id: string
  icon: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
}

interface AnalyticsData {
  health_score: HealthScore
  rfm_segments: RFMSegment[]
  forecast: ForecastPoint[]
  cohort_retention: CohortRow[]
}

// ─── API ─────────────────────────────────────────────────────────────────────

const fetchAdvancedAnalytics = (dateRange: string): Promise<AnalyticsData> =>
  axios.get('/api/v1/ecommerce/analytics/advanced', { params: { range: dateRange } }).then((r) => r.data)

// ─── Static AI Insights ───────────────────────────────────────────────────────

const AI_INSIGHTS: AIInsight[] = [
  {
    id: '1',
    icon: '📈',
    title: 'High-Value Segment Opportunity',
    description: 'Champions customers (top RFM segment) have declined 8% MoM. Consider a loyalty reward campaign to re-engage them before churn sets in.',
    impact: 'high',
  },
  {
    id: '2',
    icon: '🛒',
    title: 'Cart Abandonment Spike',
    description: 'Cart abandonment jumped 12% on mobile devices in the last 7 days. The checkout form on mobile may have a UX issue worth investigating.',
    impact: 'medium',
  },
  {
    id: '3',
    icon: '💡',
    title: 'Upsell Window Detected',
    description: 'Customers who purchase in the "Electronics" category have a 34% likelihood of buying a related accessory within 3 days. A targeted post-purchase email could lift revenue.',
    impact: 'medium',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const color = score >= 71 ? '#6fd943' : score >= 41 ? '#ffa21d' : '#ff3a6e'

  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={80} viewBox="0 0 140 80" className="overflow-visible">
        <path
          d="M 10 80 A 60 60 0 0 1 130 80"
          fill="none" stroke="#f3f4f6" strokeWidth={14} strokeLinecap="round"
        />
        <path
          d="M 10 80 A 60 60 0 0 1 130 80"
          fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 188.5} 188.5`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={70} y={70} textAnchor="middle" fontSize={24} fontWeight="bold" fill={color}>{score}</text>
      </svg>
      <span className="text-xs text-gray-500 mt-1">Health Score</span>
    </div>
  )
}

function CohortCell({ value }: { value: number }) {
  const opacity = value / 100
  return (
    <td className="px-3 py-2 text-center text-xs font-medium border border-gray-100"
      style={{ backgroundColor: `rgba(81, 69, 157, ${opacity * 0.7})`, color: value > 50 ? 'white' : '#374151' }}>
      {value > 0 ? `${value}%` : '—'}
    </td>
  )
}

// ─── Mock Data Fallback ───────────────────────────────────────────────────────

const MOCK: AnalyticsData = {
  health_score: { score: 73, conversion_rate: 3.8, cart_abandonment: 62, revenue_growth: 11.2, repeat_purchase_rate: 28 },
  rfm_segments: [
    { segment: 'Champions',   count: 418,  revenue_share: 42 },
    { segment: 'Loyal',       count: 721,  revenue_share: 28 },
    { segment: 'At Risk',     count: 290,  revenue_share: 15 },
    { segment: 'Lost',        count: 543,  revenue_share: 8  },
    { segment: 'New',         count: 1102, revenue_share: 7  },
  ],
  forecast: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
    predicted_revenue: 4800 + Math.sin(i / 4) * 600 + i * 40 + Math.random() * 200,
  })),
  cohort_retention: [
    { cohort: 'Jan 2026', months: [100, 48, 32, 24, 18, 14] },
    { cohort: 'Feb 2026', months: [100, 51, 35, 27, 20,  0] },
    { cohort: 'Mar 2026', months: [100, 44, 30, 22,  0,  0] },
    { cohort: 'Apr 2026', months: [100, 53, 38,  0,  0,  0] },
    { cohort: 'May 2026', months: [100, 49,  0,  0,  0,  0] },
    { cohort: 'Jun 2026', months: [100,  0,  0,  0,  0,  0] },
  ],
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdvancedAnalyticsPage() {
  const [dateRange, setDateRange] = useState('90d')

  const { data, isLoading } = useQuery({
    queryKey: ['ecommerce-advanced-analytics', dateRange],
    queryFn: () => fetchAdvancedAnalytics(dateRange),
    placeholderData: MOCK,
  })

  const d = data ?? MOCK
  const hs = d.health_score
  const forecast = d.forecast
  const maxForecast = Math.max(...forecast.map((f) => f.predicted_revenue), 1)
  const monthLabels = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5']

  const IMPACT_COLORS: Record<AIInsight['impact'], 'danger' | 'warning' | 'info'> = {
    high: 'danger', medium: 'warning', low: 'info',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advanced Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Deep e-commerce intelligence — health, segmentation, cohorts, and forecasting</p>
        </div>
        <Select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          options={[
            { value: '30d', label: 'Last 30 days' },
            { value: '90d', label: 'Last 90 days' },
            { value: '180d', label: 'Last 6 months' },
            { value: '365d', label: 'Last 12 months' },
          ]}
        />
      </div>

      {/* Row 1: Health Score + Components */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="flex flex-col items-center justify-center">
          {isLoading ? <Spinner /> : <HealthGauge score={hs.score} />}
          <div className="mt-4 w-full space-y-2">
            {[
              { label: 'Conversion Rate',     value: `${hs.conversion_rate}%`,      color: 'text-success' },
              { label: 'Cart Abandonment',    value: `${hs.cart_abandonment}%`,     color: 'text-danger' },
              { label: 'Revenue Growth',      value: `+${hs.revenue_growth}%`,      color: 'text-success' },
              { label: 'Repeat Purchase Rate',value: `${hs.repeat_purchase_rate}%`, color: 'text-primary' },
            ].map((c) => (
              <div key={c.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{c.label}</span>
                <span className={`font-semibold ${c.color}`}>{c.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* RFM Segments */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">RFM Segmentation</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Segment</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customers</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue Share</th>
                </tr>
              </thead>
              <tbody>
                {d.rfm_segments.map((seg) => (
                  <tr key={seg.segment} className="border-b border-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{seg.segment}</td>
                    <td className="py-2.5 px-3 text-right text-gray-600">{seg.count.toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${seg.revenue_share}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-10 text-right">{seg.revenue_share}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Row 2: Forecast Chart */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">30-Day Revenue Forecast</h2>
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-2">
            {forecast.slice(0, 15).map((pt) => {
              const pct = (pt.predicted_revenue / maxForecast) * 100
              return (
                <div key={pt.date} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-20 shrink-0 text-right">{pt.date.slice(5)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #51459d 0%, #3ec9d6 100%)' }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-24 text-right">
                    ${pt.predicted_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )
            })}
            <p className="text-xs text-gray-400 text-right pt-1">Showing first 15 of {forecast.length} days</p>
          </div>
        )}
      </Card>

      {/* Row 3: Cohort Retention */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cohort Retention</h2>
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cohort</th>
                {monthLabels.map((m) => (
                  <th key={m} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.cohort_retention.map((row) => (
                <tr key={row.cohort}>
                  <td className="px-3 py-2 text-xs font-medium text-gray-700 whitespace-nowrap">{row.cohort}</td>
                  {row.months.map((v, i) => <CohortCell key={i} value={v} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3">Percentage of original cohort still active each month</p>
      </Card>

      {/* Row 4: AI Insights */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AI_INSIGHTS.map((ins) => (
            <Card key={ins.id}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{ins.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">{ins.title}</p>
                    <Badge variant={IMPACT_COLORS[ins.impact]} className="capitalize shrink-0">{ins.impact}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{ins.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
