import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge, Spinner } from '@/components/ui'
import {
  useSurveys,
  useRecognitionLeaderboard,
  useENPSTrend,
  type Survey,
  type RecognitionLeader,
} from '@/api/hr_engagement'

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: string
}

function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <Card className="flex items-start gap-4">
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[10px] text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

// ─── eNPS Sparkline ───────────────────────────────────────────────────────────

function ENPSSparkline() {
  const { data: trend, isLoading } = useENPSTrend()

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    )
  }

  if (!trend || trend.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">No eNPS data yet</p>
  }

  const scores = trend.map((t) => t.nps_score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1.5 h-20">
        {trend.map((point, i) => {
          const height = ((point.nps_score - min) / range) * 100
          const isPos = point.nps_score >= 0
          const isLast = i === trend.length - 1
          return (
            <div
              key={i}
              className="group relative flex flex-1 flex-col items-center justify-end"
              title={`${point.period}: ${point.nps_score}`}
            >
              <div
                className={`w-full rounded-t-sm transition-all ${isLast ? 'opacity-100' : 'opacity-70'}`}
                style={{
                  height: `${Math.max(height, 10)}%`,
                  backgroundColor: isPos ? '#6fd943' : '#ff3a6e',
                }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white">
                {point.nps_score > 0 ? '+' : ''}{point.nps_score}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1.5">
        {trend.map((point, i) => (
          <div key={i} className="flex-1 text-center text-gray-400" style={{ fontSize: '10px' }}>
            {point.period.slice(-5)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Survey Completion Row ────────────────────────────────────────────────────

function SurveyCompletionRow({ survey }: { survey: Survey }) {
  const rate = survey.response_count ?? 0
  const statusColors: Record<Survey['status'], string> = {
    active: '#6fd943',
    draft: '#ffa21d',
    closed: '#888',
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: statusColors[survey.status] }}
          />
          <span className="truncate text-sm text-gray-700 dark:text-gray-300 font-medium">
            {survey.title}
          </span>
          <span className="text-xs text-gray-400 capitalize flex-shrink-0">
            {survey.survey_type}
          </span>
        </div>
        <span className="flex-shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {rate} resp.
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min((rate / 100) * 100, 100)}%`,
            backgroundColor: statusColors[survey.status],
          }}
        />
      </div>
    </div>
  )
}

// ─── Top Recognized Card ──────────────────────────────────────────────────────

function TopRecognizedCard({ leader, rank }: { leader: RecognitionLeader; rank: number }) {
  const initials = leader.employee_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const palette = ['#51459d', '#3ec9d6', '#6fd943', '#ffa21d', '#ff3a6e']
  const color = palette[leader.employee_name.charCodeAt(0) % palette.length]
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="flex flex-col items-center gap-2 rounded-[10px] border border-gray-100 dark:border-gray-700 p-3 text-center">
      <div className="relative">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        {rank <= 3 && (
          <span className="absolute -top-1 -right-1 text-base leading-none">
            {medals[rank - 1]}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
          {leader.employee_name.split(' ')[0]}
        </p>
        <p className="text-xs font-bold" style={{ color: '#ffa21d' }}>
          {leader.points} pts
        </p>
        <p className="text-xs text-gray-400">{leader.recognition_count}x</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EngagementDashboard() {
  const navigate = useNavigate()

  const { data: surveys, isLoading: surveysLoading } = useSurveys({ limit: 6 })
  const { data: leaders, isLoading: leadersLoading } = useRecognitionLeaderboard()
  const { data: enpsTrend } = useENPSTrend()

  const activeSurveys = surveys?.items.filter((s) => s.status === 'active').length ?? 0
  const totalResponses = surveys?.items.reduce((sum, s) => sum + (s.response_count ?? 0), 0) ?? 0
  const latestENPS =
    enpsTrend && enpsTrend.length > 0 ? enpsTrend[enpsTrend.length - 1].nps_score : null
  const enpsDisplay =
    latestENPS !== null ? (latestENPS >= 0 ? `+${latestENPS}` : `${latestENPS}`) : 'N/A'
  const enpsColor =
    latestENPS !== null
      ? latestENPS >= 50
        ? '#6fd943'
        : latestENPS >= 0
          ? '#ffa21d'
          : '#ff3a6e'
      : '#888'

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Engagement Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Monitor employee engagement, surveys, and recognition
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/hr/engagement/recognition')}
          >
            Give Recognition
          </Button>
          <Button size="sm" onClick={() => navigate('/hr/engagement/surveys/new')}>
            + Create Survey
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Surveys"
          value={surveysLoading ? '…' : activeSurveys}
          sub="Currently running"
          color="#51459d"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          }
        />
        <StatCard
          label="Total Responses"
          value={surveysLoading ? '…' : totalResponses}
          sub="Across all surveys"
          color="#3ec9d6"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="Current eNPS"
          value={enpsDisplay}
          sub={
            latestENPS !== null
              ? latestENPS >= 50
                ? 'Excellent'
                : latestENPS >= 0
                  ? 'Needs Work'
                  : 'Critical'
              : 'No data'
          }
          color={enpsColor}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          }
        />
        <StatCard
          label="Avg Sentiment"
          value="0.72"
          sub="Based on open responses"
          color="#6fd943"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* eNPS Trend */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              eNPS Trend
            </h2>
            <Badge variant="info">Last 6 Surveys</Badge>
          </div>
          <ENPSSparkline />
        </Card>

        {/* Quick Actions */}
        <Card>
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => navigate('/hr/engagement/surveys/new')}
            >
              <svg
                className="h-4 w-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Survey
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => navigate('/hr/engagement/recognition')}
            >
              <span>🏅</span>
              Give Recognition
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => navigate('/hr/engagement/surveys')}
            >
              <svg
                className="h-4 w-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              View All Surveys
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Surveys */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Recent Survey Responses
            </h2>
            <button
              onClick={() => navigate('/hr/engagement/surveys')}
              className="text-xs font-medium hover:underline"
              style={{ color: '#51459d' }}
            >
              View all
            </button>
          </div>
          {surveysLoading ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : !surveys || surveys.items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No surveys yet</p>
          ) : (
            <div className="space-y-4">
              {surveys.items.slice(0, 5).map((survey) => (
                <SurveyCompletionRow key={survey.id} survey={survey} />
              ))}
            </div>
          )}
        </Card>

        {/* Top Recognized */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Top Recognized This Month
            </h2>
            <button
              onClick={() => navigate('/hr/engagement/recognition')}
              className="text-xs font-medium hover:underline"
              style={{ color: '#51459d' }}
            >
              View feed
            </button>
          </div>
          {leadersLoading ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : !leaders || leaders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No recognitions this month</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {leaders.slice(0, 5).map((leader, i) => (
                <TopRecognizedCard key={leader.employee_id} leader={leader} rank={i + 1} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
