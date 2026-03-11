import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button, Spinner } from '../../../components/ui'
import {
  useFlightRiskScores,
  useCalculateFlightRisk,
  useFlightRiskTeamSummary,
  type FlightRiskScore,
} from '@/api/hr_phase3'

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_BADGE: Record<RiskLevel, { variant: 'danger' | 'warning' | 'info' | 'success'; label: string }> = {
  critical: { variant: 'danger',  label: 'Critical' },
  high:     { variant: 'warning', label: 'High' },
  medium:   { variant: 'info',    label: 'Medium' },
  low:      { variant: 'success', label: 'Low' },
}

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: '#ff3a6e',
  high:     '#ffa21d',
  medium:   '#3ec9d6',
  low:      '#6fd943',
}

function topFactor(factors: Record<string, number>): string {
  if (!factors || Object.keys(factors).length === 0) return '—'
  const sorted = Object.entries(factors).sort(([, a], [, b]) => b - a)
  return sorted[0][0].replace(/_/g, ' ')
}

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

// ─── Risk Distribution Chart ───────────────────────────────────────────────────

interface DistributionProps {
  distribution: Record<string, number>
  total: number
}

function RiskDistributionChart({ distribution, total }: DistributionProps) {
  const levels: RiskLevel[] = ['critical', 'high', 'medium', 'low']
  return (
    <div className="space-y-3">
      {levels.map((level) => {
        const count = distribution[level] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={level} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right shrink-0 capitalize">
              {level}
            </span>
            <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: RISK_COLORS[level] }}
              >
                {count > 0 && <span className="text-xs font-bold text-white">{count}</span>}
              </div>
            </div>
            <span className="text-xs text-gray-400 w-10 text-right shrink-0">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Risk Score Bar ────────────────────────────────────────────────────────────

function RiskScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? '#ff3a6e'
    : score >= 60 ? '#ffa21d'
    : score >= 40 ? '#3ec9d6'
    : '#6fd943'
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{score}</span>
    </div>
  )
}

// ─── Employee Row ──────────────────────────────────────────────────────────────

interface EmployeeRowProps {
  score: FlightRiskScore
  onRecalculate: (employeeId: string) => void
  isRecalculating: boolean
}

function EmployeeRow({ score, onRecalculate, isRecalculating }: EmployeeRowProps) {
  const level = (score.risk_level ?? 'low') as RiskLevel
  const badgeMeta = RISK_BADGE[level] ?? RISK_BADGE.low
  const factor = topFactor(score.factors ?? {})
  const recs = (score.recommendations ?? []).join(', ')

  return (
    <tr className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
      <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
        {score.employee_name ?? score.employee_id.slice(0, 8)}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
        {score.department ?? '—'}
      </td>
      <td className="py-3 px-4">
        <Badge variant={badgeMeta.variant}>{badgeMeta.label}</Badge>
      </td>
      <td className="py-3 px-4">
        <RiskScoreBar score={score.risk_score} />
      </td>
      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300 capitalize">
        {factor}
      </td>
      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={recs}>
        {recs || '—'}
      </td>
      <td className="py-3 px-4">
        <Button
          variant="ghost"
          size="sm"
          loading={isRecalculating}
          onClick={() => onRecalculate(score.employee_id)}
        >
          Recalculate
        </Button>
      </td>
    </tr>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function FlightRiskDashboard() {
  const navigate = useNavigate()
  const [bulkLoading, setBulkLoading] = useState(false)
  const [recalculating, setRecalculating] = useState<string | null>(null)

  const { data: scores, isLoading: scoresLoading } = useFlightRiskScores()
  const { data: summary, isLoading: summaryLoading } = useFlightRiskTeamSummary()
  const calcMutation = useCalculateFlightRisk()

  const allScores: FlightRiskScore[] = scores ?? []
  const totalAnalyzed = allScores.length
  const highRisk = allScores.filter((s) => s.risk_level === 'high').length
  const criticalCount = allScores.filter((s) => s.risk_level === 'critical').length
  const avgScore =
    totalAnalyzed > 0
      ? Math.round(allScores.reduce((acc, s) => acc + s.risk_score, 0) / totalAnalyzed)
      : 0

  const distribution: Record<string, number> = summary?.distribution ?? {
    critical: criticalCount,
    high: highRisk,
    medium: allScores.filter((s) => s.risk_level === 'medium').length,
    low: allScores.filter((s) => s.risk_level === 'low').length,
  }

  async function handleRecalculate(employeeId: string) {
    setRecalculating(employeeId)
    try {
      await calcMutation.mutateAsync({ employee_id: employeeId })
    } finally {
      setRecalculating(null)
    }
  }

  async function handleBulkAnalysis() {
    setBulkLoading(true)
    try {
      await calcMutation.mutateAsync({ bulk: true })
    } finally {
      setBulkLoading(false)
    }
  }

  const isLoading = scoresLoading || summaryLoading

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Flight Risk Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Identify employees at risk of leaving</p>
        </div>
        <Button loading={bulkLoading} onClick={handleBulkAnalysis}>
          Run Bulk Analysis
        </Button>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-[10px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Analyzed" value={totalAnalyzed} icon="👥" accent="#51459d" />
          <StatCard label="High Risk" value={highRisk} icon="⚠️" accent="#ffa21d" />
          <StatCard label="Critical" value={criticalCount} icon="🚨" accent="#ff3a6e" />
          <StatCard label="Avg Risk Score" value={`${avgScore}/100`} icon="📊" accent="#3ec9d6" />
        </div>
      )}

      {/* Risk Distribution */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Risk Distribution</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse" />
            ))}
          </div>
        ) : (
          <RiskDistributionChart distribution={distribution} total={totalAnalyzed} />
        )}
      </Card>

      {/* Employee Table */}
      <Card padding={false}>
        <div className="p-6 pb-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Employee Risk Scores</h2>
          <p className="text-xs text-gray-400 mb-4">Click "Recalculate" on any row to refresh an individual score</p>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : allScores.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-4xl mb-3">🛫</p>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No flight risk scores calculated yet.</p>
            <p className="text-sm text-gray-400 mt-1">Click "Run Bulk Analysis" to get started.</p>
            <Button className="mt-4" onClick={handleBulkAnalysis} loading={bulkLoading}>
              Run Bulk Analysis
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['Employee Name', 'Department', 'Risk Level', 'Risk Score', 'Top Factor', 'Recommendations', 'Action'].map((h) => (
                    <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allScores.map((score) => (
                  <EmployeeRow
                    key={score.id}
                    score={score}
                    onRecalculate={handleRecalculate}
                    isRecalculating={recalculating === score.employee_id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
