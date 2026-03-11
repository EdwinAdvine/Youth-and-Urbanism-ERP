import { useParams } from 'react-router-dom'
import { Card, Spinner, Badge } from '../../components/ui'
import { useForm } from '../../api/forms'
import { useFormAnalytics, type FieldSummary } from '../../api/forms_ext'

export default function FormAnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const formId = id ?? ''

  const { data: form } = useForm(formId)
  const { data: analytics, isLoading } = useFormAnalytics(formId)

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  if (!analytics) {
    return <div className="text-center py-24 text-gray-400">No analytics data available</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Form Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">{form?.title ?? analytics.form_title}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total Responses</p>
          <p className="text-2xl font-bold text-primary mt-1">{analytics.total_responses}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Response Rate</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{analytics.response_rate}%</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Avg. Completion Time</p>
          <p className="text-2xl font-bold text-cyan-600 mt-1">
            {analytics.avg_completion_time_seconds > 60
              ? `${Math.round(analytics.avg_completion_time_seconds / 60)}m`
              : `${analytics.avg_completion_time_seconds}s`}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Fields</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{analytics.field_summaries.length}</p>
        </Card>
      </div>

      {/* Responses over time */}
      {analytics.responses_by_day.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Responses Over Time</h2>
          <ResponseChart data={analytics.responses_by_day} />
        </Card>
      )}

      {/* Field summaries */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Field Analysis</h2>
        {analytics.field_summaries.map((field) => (
          <FieldAnalysis key={field.field_id} field={field} total={analytics.total_responses} />
        ))}
      </div>
    </div>
  )
}

function ResponseChart({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const W = 700
  const H = 150
  const PAD = { top: 10, right: 10, bottom: 25, left: 35 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom

  const barW = Math.max(4, Math.min(20, cW / data.length - 2))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const x = PAD.left + (i / data.length) * cW + barW / 2
        const h = (d.count / maxCount) * cH
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={PAD.top + cH - h}
              width={barW}
              height={h}
              rx={2}
              className="fill-primary/70 hover:fill-primary transition-colors"
            />
            {data.length <= 14 && (
              <text x={x + barW / 2} y={H - 5} textAnchor="middle" className="text-[8px] fill-gray-400">
                {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function FieldAnalysis({ field, total }: { field: FieldSummary; total: number }) {
  const hasValues = Object.keys(field.values).length > 0

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{field.label}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="default">{field.field_type}</Badge>
            <span className="text-xs text-gray-400">{field.response_count} response{field.response_count !== 1 ? 's' : ''}</span>
          </div>
        </div>
        {field.average !== undefined && (
          <div className="text-right">
            <p className="text-sm text-gray-500">Average</p>
            <p className="text-lg font-semibold text-primary">{field.average.toFixed(1)}</p>
          </div>
        )}
      </div>

      {hasValues && (
        <div className="space-y-2">
          {Object.entries(field.values)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([value, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={value}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-600 truncate max-w-[60%]">{value}</span>
                    <span className="text-xs text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {field.min !== undefined && field.max !== undefined && (
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>Min: {field.min}</span>
          <span>Max: {field.max}</span>
        </div>
      )}
    </Card>
  )
}
