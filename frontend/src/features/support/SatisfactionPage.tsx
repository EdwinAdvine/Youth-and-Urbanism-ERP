import { useState } from 'react'
import { Card, Select, Spinner } from '../../components/ui'
import { useSatisfactionReport } from '../../api/support_ext'

export default function SatisfactionPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const { data: report, isLoading, error } = useSatisfactionReport({ period })

  if (error) return <div className="p-6 text-danger">Failed to load satisfaction data</div>

  const latest = report?.[0]
  const overallAvg = report && report.length > 0
    ? report.reduce((s, r) => s + r.avg_rating, 0) / report.length
    : 0
  const totalResponses = report?.reduce((s, r) => s + r.total_responses, 0) ?? 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Satisfaction</h1>
          <p className="text-sm text-gray-500 mt-1">CSAT and NPS tracking over time</p>
        </div>
        <Select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}
          options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Avg Rating</p>
          <p className="text-3xl font-bold text-primary">{overallAvg.toFixed(1)}<span className="text-sm text-gray-400 font-normal">/5</span></p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Responses</p>
          <p className="text-3xl font-bold text-gray-900">{totalResponses}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">NPS Score</p>
          <p className={`text-3xl font-bold ${(latest?.nps_score ?? 0) >= 50 ? 'text-green-600' : (latest?.nps_score ?? 0) >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
            {latest?.nps_score?.toFixed(0) ?? '-'}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Latest Period</p>
          <p className="text-2xl font-bold text-gray-900">{latest?.period ?? '-'}</p>
        </Card>
      </div>

      {/* Rating Distribution */}
      {latest?.ratings_distribution && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rating Distribution</h2>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = latest.ratings_distribution[String(star)] ?? 0
              const pct = latest.total_responses > 0 ? (count / latest.total_responses) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16 shrink-0">
                    <span className="text-sm font-medium">{star}</span>
                    <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4">
                    <div className="bg-yellow-400 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm text-gray-500 w-16 text-right">{count} ({pct.toFixed(0)}%)</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Trend */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Satisfaction Trend</h2>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !report || report.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No satisfaction data available</p>
        ) : (
          <div className="space-y-3">
            {report.map((r) => (
              <div key={r.period} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-24 shrink-0 text-right">{r.period}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${(r.avg_rating / 5) * 100}%` }} />
                </div>
                <span className="text-sm font-bold text-gray-900 w-10 text-right">{r.avg_rating.toFixed(1)}</span>
                <span className="text-xs text-gray-400 w-16 text-right">NPS: {r.nps_score}</span>
                <span className="text-xs text-gray-400 w-16 text-right">{r.total_responses} resp</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
