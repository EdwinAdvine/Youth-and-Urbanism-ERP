import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge } from '@/components/ui'
import { useDEIOverview } from '@/api/hr_phase3'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GENDER_COLORS: Record<string, string> = {
  male: '#51459d',
  female: '#3ec9d6',
  other: '#ffa21d',
  not_specified: '#aaa',
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  not_specified: 'Not Specified',
}

const TIME_PERIODS = [
  { value: 'current', label: 'Current' },
  { value: 'q1', label: 'Q1 2026' },
  { value: 'q2', label: 'Q2 2025' },
  { value: 'q3', label: 'Q3 2025' },
]

// ─── Sub-Components ───────────────────────────────────────────────────────────

function GenderBar({
  label,
  count,
  percentage,
  color,
}: {
  label: string
  count: number
  percentage: number
  color: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 dark:text-gray-300 font-medium">{label}</span>
        <span className="text-gray-500">
          {count.toLocaleString()} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4">
        <div
          className="h-4 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(percentage, 1)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-28 bg-gray-100 dark:bg-gray-800 rounded-[10px]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-56 bg-gray-100 dark:bg-gray-800 rounded-[10px]" />
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DEIDashboard() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useDEIOverview()
  const [timePeriod, setTimePeriod] = useState('current')
  const [exporting, setExporting] = useState(false)

  // Normalise data — the API can return either a flat DEIOverview or a richer DEIOverviewData shape
  const rawData = data as {
    total_employees?: number
    gender_distribution?: { gender: string; count: number; percentage?: number }[]
    gender_split?: { male?: number; female?: number; other?: number; not_specified?: number }
    by_department?: Array<{
      department_name?: string
      department?: string
      total?: number
      headcount?: number
      male?: number; female?: number; other?: number; not_specified?: number
      male_pct?: number; female_pct?: number; other_pct?: number; not_specified_pct?: number
      gender_split?: Record<string, number>
    }>
    department_breakdown?: Array<{
      department: string
      headcount: number
      gender_split: Record<string, number>
    }>
    leadership?: { male?: number; female?: number; other?: number; not_specified?: number; female_pct?: number }
    leadership_diversity?: { manager_gender_split?: Record<string, number> }
  } | null | undefined

  // Build normalised gender distribution
  type GenderEntry = { gender: string; count: number; pct: number }
  let genderDist: GenderEntry[] = []
  const totalEmployees = rawData?.total_employees ?? 0

  if (rawData?.gender_distribution) {
    genderDist = rawData.gender_distribution.map(g => ({
      gender: g.gender,
      count: g.count,
      pct: g.percentage ?? (totalEmployees > 0 ? (g.count / totalEmployees) * 100 : 0),
    }))
  } else if (rawData?.gender_split) {
    const gs = rawData.gender_split
    const keys = ['male', 'female', 'other', 'not_specified'] as const
    const total = keys.reduce((s, k) => s + (gs[k] ?? 0), 0)
    genderDist = keys.map(k => ({
      gender: k,
      count: gs[k] ?? 0,
      pct: total > 0 ? ((gs[k] ?? 0) / total) * 100 : 0,
    }))
  }

  // DEI Health Score — % employees with specified gender (not "not_specified")
  const specifiedCount = genderDist
    .filter(g => g.gender !== 'not_specified')
    .reduce((s, g) => s + g.count, 0)
  const deiScore = totalEmployees > 0 ? Math.round((specifiedCount / totalEmployees) * 100) : 0

  // Department breakdown
  type DeptRow = {
    name: string; total: number
    malePct: number; femalePct: number; otherPct: number; notSpecPct: number
  }
  const deptRows: DeptRow[] = []

  if (rawData?.by_department) {
    rawData.by_department.forEach(d => {
      const total = d.total ?? d.headcount ?? 0
      deptRows.push({
        name: d.department_name ?? d.department ?? 'Unknown',
        total,
        malePct: d.male_pct ?? (total > 0 ? ((d.male ?? 0) / total) * 100 : 0),
        femalePct: d.female_pct ?? (total > 0 ? ((d.female ?? 0) / total) * 100 : 0),
        otherPct: d.other_pct ?? (total > 0 ? ((d.other ?? 0) / total) * 100 : 0),
        notSpecPct: d.not_specified_pct ?? (total > 0 ? ((d.not_specified ?? 0) / total) * 100 : 0),
      })
    })
  } else if (rawData?.department_breakdown) {
    rawData.department_breakdown.forEach(d => {
      const gs = d.gender_split ?? {}
      const total = d.headcount
      deptRows.push({
        name: d.department,
        total,
        malePct: total > 0 ? ((gs.male ?? 0) / total) * 100 : 0,
        femalePct: total > 0 ? ((gs.female ?? 0) / total) * 100 : 0,
        otherPct: total > 0 ? ((gs.other ?? 0) / total) * 100 : 0,
        notSpecPct: total > 0 ? ((gs.not_specified ?? 0) / total) * 100 : 0,
      })
    })
  }

  // Leadership
  let femaleManagerPct = 0
  let leadershipSplit: Record<string, number> = {}
  if (rawData?.leadership) {
    const l = rawData.leadership
    femaleManagerPct = l.female_pct ?? 0
    leadershipSplit = { male: l.male ?? 0, female: l.female ?? 0, other: l.other ?? 0, not_specified: l.not_specified ?? 0 }
  } else if (rawData?.leadership_diversity?.manager_gender_split) {
    const mgs = rawData.leadership_diversity.manager_gender_split
    leadershipSplit = mgs
    const totalMgr = Object.values(mgs).reduce((s, v) => s + v, 0)
    femaleManagerPct = totalMgr > 0 ? ((mgs.female ?? 0) / totalMgr) * 100 : 0
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/v1/analytics/export/dei-report', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'dei-report.csv'
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-[10px] mb-6 animate-pulse" />
          <LoadingSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-center">
          <p className="text-danger font-medium mb-2">Failed to load DEI data</p>
          <p className="text-sm text-gray-500">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">DEI Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Diversity, Equity & Inclusion Metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time period selector — UI only */}
          <select
            className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={timePeriod}
            onChange={e => setTimePeriod(e.target.value)}
          >
            {TIME_PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            loading={exporting}
          >
            Export DEI Report
          </Button>
        </div>
      </div>

      {/* DEI Health Score */}
      <Card className="bg-gradient-to-br from-primary/10 to-info/10">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div
              className="text-6xl font-black"
              style={{ color: deiScore >= 80 ? '#6fd943' : deiScore >= 60 ? '#ffa21d' : '#ff3a6e' }}
            >
              {deiScore}
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">DEI Health Score</p>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {deiScore >= 80
                ? 'Strong DEI health — the majority of employees have self-identified their gender, supporting accurate inclusion tracking.'
                : deiScore >= 60
                ? 'Moderate DEI health — consider encouraging employees to complete their gender identity in their profiles.'
                : 'DEI data coverage needs improvement. Encourage employees to self-identify to enable better analytics.'}
            </p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Total Employees: <strong>{totalEmployees.toLocaleString()}</strong>
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Identified: <strong>{specifiedCount.toLocaleString()}</strong>
              </span>
            </div>
          </div>
          {timePeriod !== 'current' && (
            <Badge variant="warning">Historical data — filter not yet applied</Badge>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Gender Distribution */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Gender Distribution
          </h2>
          {genderDist.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No gender data available</p>
          ) : (
            <div className="space-y-4">
              {genderDist.map(g => (
                <GenderBar
                  key={g.gender}
                  label={GENDER_LABELS[g.gender] ?? g.gender}
                  count={g.count}
                  percentage={g.pct}
                  color={GENDER_COLORS[g.gender] ?? '#888'}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Panel 2: Department Breakdown */}
        <Card padding={false}>
          <div className="p-5 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Department Breakdown</h2>
          </div>
          {deptRows.length === 0 ? (
            <div className="p-5">
              <p className="text-sm text-gray-400 py-8 text-center">No department data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 dark:border-gray-800">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">M / F / Other</th>
                  </tr>
                </thead>
                <tbody>
                  {deptRows.map(row => (
                    <tr key={row.name} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="py-2.5 px-4 font-medium text-gray-800 dark:text-gray-200 truncate max-w-[140px]">{row.name}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-400">{row.total}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-0.5 h-3">
                          <div
                            className="h-3 rounded-l"
                            style={{ width: `${row.malePct}%`, backgroundColor: '#51459d', minWidth: row.malePct > 0 ? 4 : 0 }}
                            title={`Male: ${row.malePct.toFixed(0)}%`}
                          />
                          <div
                            className="h-3"
                            style={{ width: `${row.femalePct}%`, backgroundColor: '#3ec9d6', minWidth: row.femalePct > 0 ? 4 : 0 }}
                            title={`Female: ${row.femalePct.toFixed(0)}%`}
                          />
                          <div
                            className="h-3 rounded-r"
                            style={{ width: `${row.otherPct + row.notSpecPct}%`, backgroundColor: '#ffa21d', minWidth: (row.otherPct + row.notSpecPct) > 0 ? 4 : 0 }}
                            title={`Other/NS: ${(row.otherPct + row.notSpecPct).toFixed(0)}%`}
                          />
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {row.malePct.toFixed(0)}% / {row.femalePct.toFixed(0)}% / {(row.otherPct + row.notSpecPct).toFixed(0)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Panel 3: Leadership Diversity */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Leadership Diversity
          </h2>
          {Object.keys(leadershipSplit).length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No leadership data available</p>
          ) : (
            <div className="space-y-4">
              {femaleManagerPct < 30 && (
                <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <svg className="w-5 h-5 text-warning mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Female managers represent <strong>{femaleManagerPct.toFixed(1)}%</strong> of leadership — below the recommended 30% threshold.
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {Object.entries(leadershipSplit).map(([gender, count]) => {
                  const total = Object.values(leadershipSplit).reduce((s, v) => s + v, 0)
                  const pct = total > 0 ? (count / total) * 100 : 0
                  return (
                    <div key={gender} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: GENDER_COLORS[gender] ?? '#888' }} />
                      <span className="text-sm text-gray-700 dark:text-gray-300 w-28">
                        {GENDER_LABELS[gender] ?? gender}
                      </span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className="h-3 rounded-full"
                          style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: GENDER_COLORS[gender] ?? '#888' }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-20 text-right">
                        {count} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Panel 4: Pay Equity — placeholder */}
        <Card className="border-dashed border-2 border-gray-200 dark:border-gray-600">
          <div className="flex flex-col items-center justify-center h-full py-6 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Pay Equity</h3>
            <p className="text-sm text-gray-400 mb-4 max-w-xs">
              Pay equity analysis coming soon — requires compensation band data mapped to gender identity.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/hr/compensation-bands')}
            >
              Go to Compensation Bands
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
