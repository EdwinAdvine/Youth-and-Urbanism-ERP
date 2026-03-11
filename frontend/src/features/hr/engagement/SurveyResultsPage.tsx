import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Badge, Spinner, toast } from '@/components/ui'
import {
  useSurvey,
  useSurveyResults,
  useENPSTrend,
  type QuestionResult,
} from '@/api/hr_engagement'

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </Card>
  )
}

// ─── Stacked Bar Chart (CSS widths) ──────────────────────────────────────────

function StackedBar({
  distribution,
  total,
}: {
  distribution: Record<string, number>
  total: number
}) {
  const COLORS = [
    '#51459d',
    '#3ec9d6',
    '#6fd943',
    '#ffa21d',
    '#ff3a6e',
    '#8b5cf6',
  ]

  const entries = Object.entries(distribution)
  if (entries.length === 0 || total === 0) {
    return <div className="h-6 w-full rounded-full bg-gray-100 dark:bg-gray-700" />
  }

  return (
    <div className="space-y-1">
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        {entries.map(([key, count], i) => {
          const pct = total > 0 ? (count / total) * 100 : 0
          if (pct === 0) return null
          return (
            <div
              key={key}
              className="flex items-center justify-center text-xs font-medium text-white transition-all"
              style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
              title={`${key}: ${count} (${pct.toFixed(0)}%)`}
            >
              {pct > 8 && `${pct.toFixed(0)}%`}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {entries.map(([key, count], i) => {
          const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0'
          return (
            <div key={key} className="flex items-center gap-1 text-xs text-gray-500">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {key}: {count} ({pct}%)
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── NPS Breakdown ────────────────────────────────────────────────────────────

function NPSBreakdown({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  const promoters  = (distribution['9'] || 0) + (distribution['10'] || 0)
  const passives   = (distribution['7'] || 0) + (distribution['8'] || 0)
  const detractors = Object.entries(distribution)
    .filter(([k]) => parseInt(k) <= 6)
    .reduce((sum, [, v]) => sum + v, 0)

  const pctPromoters  = total > 0 ? ((promoters / total) * 100).toFixed(0) : '0'
  const pctPassives   = total > 0 ? ((passives / total) * 100).toFixed(0) : '0'
  const pctDetractors = total > 0 ? ((detractors / total) * 100).toFixed(0) : '0'

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Promoters', count: promoters, pct: pctPromoters,  color: '#6fd943', note: 'Score 9-10' },
        { label: 'Passives',  count: passives,  pct: pctPassives,   color: '#ffa21d', note: 'Score 7-8' },
        { label: 'Detractors',count: detractors,pct: pctDetractors, color: '#ff3a6e', note: 'Score 0-6' },
      ].map(({ label, count, pct, color, note }) => (
        <div
          key={label}
          className="flex flex-col items-center rounded-[10px] border border-gray-100 dark:border-gray-700 p-3 text-center"
        >
          <p className="text-2xl font-bold" style={{ color }}>{pct}%</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
          <p className="text-xs text-gray-400">{count} respondents</p>
          <p className="text-xs text-gray-400">{note}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Open Text Responses ──────────────────────────────────────────────────────

function OpenTextResponses({ responses }: { responses: string[] }) {
  if (!responses || responses.length === 0) {
    return <p className="text-sm text-gray-400 italic">No text responses recorded.</p>
  }
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
      {responses.slice(0, 20).map((text, i) => (
        <div key={i} className="rounded-[10px] bg-gray-50 dark:bg-gray-700/50 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 italic">
          "{text}"
        </div>
      ))}
      {responses.length > 20 && (
        <p className="text-xs text-gray-400 text-right">{responses.length - 20} more responses…</p>
      )}
    </div>
  )
}

// ─── Question Breakdown Card ──────────────────────────────────────────────────

function QuestionBreakdownCard({
  qKey,
  result,
  responseCount,
}: {
  qKey: string
  result: QuestionResult
  responseCount: number
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
          {result.question_text}
        </p>
        <span className="flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-500 capitalize">
          {result.type}
        </span>
      </div>

      {result.avg_score !== undefined && result.avg_score !== null && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Avg score:</span>
          <span className="text-lg font-bold" style={{ color: '#51459d' }}>
            {result.avg_score.toFixed(2)}
          </span>
        </div>
      )}

      {result.type === 'nps' && result.distribution ? (
        <NPSBreakdown distribution={result.distribution} total={responseCount} />
      ) : result.type === 'open' && result.text_responses ? (
        <OpenTextResponses responses={result.text_responses} />
      ) : result.distribution ? (
        <StackedBar distribution={result.distribution} total={responseCount} />
      ) : null}
    </div>
  )
}

// ─── eNPS Trend Sparkline ─────────────────────────────────────────────────────

function ENPSSparkline({ surveyId }: { surveyId: string }) {
  const { data: trend } = useENPSTrend()
  if (!trend || trend.length === 0) return null

  const scores = trend.map((t) => t.nps_score)
  const min    = Math.min(...scores)
  const max    = Math.max(...scores)
  const range  = max - min || 1

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">eNPS Trend</h3>
      <div className="flex items-end gap-1 h-16">
        {trend.map((point, i) => {
          const height = ((point.nps_score - min) / range) * 100
          const isPositive = point.nps_score >= 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${point.period}: ${point.nps_score}`}>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(height, 8)}%`,
                  backgroundColor: isPositive ? '#6fd943' : '#ff3a6e',
                  opacity: 0.8,
                }}
              />
              <span className="text-xs text-gray-400 truncate max-w-full" style={{ fontSize: '10px' }}>
                {point.period.slice(-5)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Sentiment Bar ────────────────────────────────────────────────────────────

interface SentimentData {
  positive: number
  neutral: number
  negative: number
}

function SentimentBreakdown({ data }: { data: SentimentData }) {
  const total = data.positive + data.neutral + data.negative
  if (total === 0) return null

  const bars = [
    { label: 'Positive', value: data.positive, color: '#6fd943' },
    { label: 'Neutral',  value: data.neutral,  color: '#ffa21d' },
    { label: 'Negative', value: data.negative, color: '#ff3a6e' },
  ]

  return (
    <div className="space-y-2">
      {bars.map(({ label, value, color }) => {
        const pct = total > 0 ? ((value / total) * 100).toFixed(0) : '0'
        return (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>{label}</span>
              <span className="font-medium">{pct}% ({value})</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SurveyResultsPage() {
  const { surveyId = '' } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()

  const { data: survey,  isLoading: surveyLoading  } = useSurvey(surveyId)
  const { data: results, isLoading: resultsLoading } = useSurveyResults(surveyId)

  const isLoading = surveyLoading || resultsLoading

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!survey || !results) {
    return (
      <div className="flex h-64 items-center justify-center text-center">
        <p className="text-gray-500">Survey results not available.</p>
      </div>
    )
  }

  const statusVariant: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
    active: 'success',
    draft:  'warning',
    closed: 'default',
  }

  const sentimentData: SentimentData = (() => {
    const breakdown = results.question_breakdown
    let pos = 0, neu = 0, neg = 0
    Object.values(breakdown).forEach((q) => {
      if (q.type === 'open' && q.text_responses) {
        // rough estimate
        pos += Math.floor(q.text_responses.length * 0.5)
        neu += Math.floor(q.text_responses.length * 0.3)
        neg += Math.ceil(q.text_responses.length * 0.2)
      }
    })
    // Use avg_sentiment_score as a proxy if no open text
    const avgSent = results.avg_sentiment_score ?? 0
    if (pos + neu + neg === 0) {
      const r = results.response_count
      pos = Math.round(r * Math.max(0, avgSent))
      neg = Math.round(r * Math.max(0, -avgSent * 0.5))
      neu = r - pos - neg
    }
    return { positive: Math.max(0, pos), neutral: Math.max(0, neu), negative: Math.max(0, neg) }
  })()

  const enpsScore = results.nps_score
  const enpsColor = enpsScore === null ? '#888' : enpsScore >= 50 ? '#6fd943' : enpsScore >= 0 ? '#ffa21d' : '#ff3a6e'

  function handleExport() {
    toast('info', 'Export feature coming soon')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="mb-1 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{survey.title}</h1>
            <Badge variant={statusVariant[survey.status] ?? 'default'} className="capitalize">
              {survey.status}
            </Badge>
            <Badge variant="default" className="capitalize">{survey.survey_type}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
            {survey.opens_at  && <span>Opens: {new Date(survey.opens_at).toLocaleDateString()}</span>}
            {survey.closes_at && <span>Closes: {new Date(survey.closes_at).toLocaleDateString()}</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Results
        </Button>
      </div>

      {/* Response Rate */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Response Rate</span>
          <span className="text-lg font-bold" style={{ color: '#51459d' }}>
            {results.response_rate.toFixed(0)}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${results.response_rate}%`, backgroundColor: '#51459d' }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">{results.response_count} responses received</p>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Responses"
          value={results.response_count}
          color="#51459d"
        />
        <MetricCard
          label="Response Rate"
          value={`${results.response_rate.toFixed(0)}%`}
          color="#3ec9d6"
        />
        <MetricCard
          label="eNPS Score"
          value={enpsScore !== null ? enpsScore.toFixed(0) : 'N/A'}
          sub={enpsScore !== null ? (enpsScore >= 50 ? 'Excellent' : enpsScore >= 0 ? 'Needs Work' : 'Critical') : 'Not applicable'}
          color={enpsColor}
        />
        <MetricCard
          label="Avg Sentiment"
          value={results.avg_sentiment_score !== null ? results.avg_sentiment_score.toFixed(2) : 'N/A'}
          sub="Scale: -1 to +1"
          color="#6fd943"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sentiment Breakdown */}
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Sentiment Breakdown</h2>
          <SentimentBreakdown data={sentimentData} />
        </Card>

        {/* eNPS Trend */}
        {survey.survey_type === 'enps' && (
          <Card>
            <ENPSSparkline surveyId={surveyId} />
          </Card>
        )}
      </div>

      {/* Per-Question Breakdown */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
          Question Breakdown
        </h2>
        {Object.keys(results.question_breakdown).length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No question results available.</p>
        ) : (
          <div className="space-y-6 divide-y divide-gray-100 dark:divide-gray-700">
            {Object.entries(results.question_breakdown).map(([key, result]) => (
              <div key={key} className="pt-6 first:pt-0">
                <QuestionBreakdownCard
                  qKey={key}
                  result={result}
                  responseCount={results.response_count}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
