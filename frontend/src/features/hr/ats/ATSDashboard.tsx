import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button } from '../../../components/ui'
import {
  useATSDashboard,
  useATSDiversity,
  useApplications,
  type CandidateApplication,
} from '@/api/hr_ats'

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: string
  accent: string
  sub?: string
}

function StatCard({ label, value, icon, accent, sub }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: `${accent}18` }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────

const STAGE_ORDER = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']
const STAGE_LABELS: Record<string, string> = {
  applied:   'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer:     'Offer',
  hired:     'Hired',
  rejected:  'Rejected',
}
const STAGE_COLORS: Record<string, string> = {
  applied:   '#51459d',
  screening: '#3ec9d6',
  interview: '#ffa21d',
  offer:     '#6fd943',
  hired:     '#6fd943',
  rejected:  '#ff3a6e',
}

function PipelineFunnel({ data }: { data: Record<string, number> }) {
  const maxVal = Math.max(...Object.values(data), 1)
  return (
    <div className="space-y-2.5">
      {STAGE_ORDER.map((stage) => {
        const count = data[stage] ?? 0
        const pct = Math.round((count / maxVal) * 100)
        return (
          <div key={stage} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-20 text-right shrink-0">
              {STAGE_LABELS[stage]}
            </span>
            <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: STAGE_COLORS[stage] }}
              >
                {count > 0 && (
                  <span className="text-xs font-bold text-white">{count}</span>
                )}
              </div>
            </div>
            <span className="text-xs text-gray-400 w-6 text-right shrink-0">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Source Breakdown ─────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  linkedin:     'LinkedIn',
  indeed:       'Indeed',
  referral:     'Referral',
  careers_page: 'Careers Page',
}

function SourceBreakdown({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => typeof v === 'number') as [string, number][]
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1

  return (
    <div className="space-y-2">
      {entries.sort(([, a], [, b]) => b - a).map(([source, count]) => {
        const pct = Math.round((count / total) * 100)
        return (
          <div key={source} className="flex items-center gap-3 text-sm">
            <span className="text-gray-600 dark:text-gray-300 w-28 shrink-0">
              {SOURCE_LABELS[source] ?? source}
            </span>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#51459d] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-16 text-right shrink-0">{pct}% ({count})</span>
          </div>
        )
      })}
      {entries.length === 0 && (
        <p className="text-sm text-gray-400">No source data yet</p>
      )}
    </div>
  )
}

// ─── Recent Applications ──────────────────────────────────────────────────────

const STAGE_BADGE_MAP: Record<CandidateApplication['stage'], { variant: 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'default'; label: string }> = {
  applied:   { variant: 'default',  label: 'Applied' },
  screening: { variant: 'info',     label: 'Screening' },
  interview: { variant: 'primary',  label: 'Interview' },
  offer:     { variant: 'warning',  label: 'Offer' },
  hired:     { variant: 'success',  label: 'Hired' },
  rejected:  { variant: 'danger',   label: 'Rejected' },
}

function RecentApplications({ items }: { items: CandidateApplication[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700">
            {['Candidate', 'Requisition', 'Stage', 'Match', 'Applied'].map((h) => (
              <th key={h} className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {items.map((app) => {
            const name = app.candidate
              ? `${app.candidate.first_name} ${app.candidate.last_name}`
              : app.candidate_id.slice(0, 8)
            const stageMeta = STAGE_BADGE_MAP[app.stage]
            return (
              <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">{name}</td>
                <td className="py-3 pr-4 text-gray-500 text-xs font-mono">{app.requisition_id.slice(0, 8)}…</td>
                <td className="py-3 pr-4">
                  <Badge variant={stageMeta.variant}>{stageMeta.label}</Badge>
                </td>
                <td className="py-3 pr-4">
                  {app.ai_match_score !== null
                    ? (
                      <span className={`text-xs font-semibold ${
                        app.ai_match_score >= 70 ? 'text-[#6fd943]'
                        : app.ai_match_score >= 50 ? 'text-[#ffa21d]'
                        : 'text-[#ff3a6e]'
                      }`}>
                        {app.ai_match_score}%
                      </span>
                    )
                    : <span className="text-gray-400 text-xs">—</span>
                  }
                </td>
                <td className="py-3 text-gray-400 text-xs">
                  {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </td>
              </tr>
            )
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">No applications yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function ATSDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useATSDashboard()
  const { data: diversity, isLoading: divLoading } = useATSDiversity()
  const { data: recentApps, isLoading: appsLoading } = useApplications({ page: 1, limit: 5 })

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ATS Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Recruitment overview at a glance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/hr/ats/requisitions')}>Post Job</Button>
          <Button onClick={() => navigate('/hr/ats/candidates')}>Add Candidate</Button>
        </div>
      </div>

      {/* Stat cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-[10px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Open Positions"
            value={stats?.open_requisitions ?? 0}
            icon="📋"
            accent="#51459d"
          />
          <StatCard
            label="Total Candidates"
            value={stats?.total_candidates ?? 0}
            icon="👥"
            accent="#3ec9d6"
          />
          <StatCard
            label="Avg Days to Hire"
            value={stats?.avg_time_to_hire_days ? `${stats.avg_time_to_hire_days}d` : '—'}
            icon="⏱️"
            accent="#ffa21d"
          />
          <StatCard
            label="Interviews This Week"
            value={stats?.interviews_this_week ?? 0}
            icon="🗓️"
            accent="#6fd943"
          />
        </div>
      )}

      {/* Pipeline Funnel + Source Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Pipeline Funnel</h2>
          {statsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse" />
              ))}
            </div>
          ) : (
            <PipelineFunnel data={stats?.applications_by_stage ?? {}} />
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Source Breakdown</h2>
          <p className="text-xs text-gray-400 mb-4">Where candidates are coming from</p>
          {divLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <SourceBreakdown data={diversity ?? {}} />
          )}
        </Card>
      </div>

      {/* Recent Applications */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Applications</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/hr/ats/pipeline')}>View All</Button>
        </div>
        {appsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <RecentApplications items={recentApps?.items ?? []} />
        )}
      </Card>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/hr/ats/requisitions')}>
            <span>📋</span> Post New Job
          </Button>
          <Button variant="outline" onClick={() => navigate('/hr/ats/candidates')}>
            <span>👤</span> Add Candidate
          </Button>
          <Button variant="outline" onClick={() => navigate('/hr/ats/interviews')}>
            <span>🗓️</span> Schedule Interview
          </Button>
          <Button variant="ghost" onClick={() => navigate('/hr/ats/pipeline')}>
            <span>📊</span> View Pipeline
          </Button>
        </div>
      </Card>
    </div>
  )
}
