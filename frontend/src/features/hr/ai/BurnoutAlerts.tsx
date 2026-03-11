import { useState } from 'react'
import { Card, Badge, Button } from '../../../components/ui'
import {
  useBurnoutIndicators,
  useCalculateBurnout,
  type BurnoutIndicator,
} from '@/api/hr_phase3'
import { toast } from '../../../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'severe' | 'high' | 'moderate' | 'low'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<RiskLevel, { variant: 'danger' | 'warning' | 'info' | 'success'; label: string }> = {
  severe:   { variant: 'danger',  label: 'Severe' },
  high:     { variant: 'warning', label: 'High' },
  moderate: { variant: 'info',    label: 'Moderate' },
  low:      { variant: 'success', label: 'Low' },
}

const LEVEL_COLOR: Record<RiskLevel, string> = {
  severe:   '#ff3a6e',
  high:     '#ffa21d',
  moderate: '#3ec9d6',
  low:      '#6fd943',
}

const FILTER_TABS: { key: 'all' | RiskLevel; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'severe',   label: 'Severe' },
  { key: 'high',     label: 'High' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'low',      label: 'Low' },
]

// ─── Score Gauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score, level }: { score: number; level: RiskLevel }) {
  const color = LEVEL_COLOR[level]
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{score}</span>
    </div>
  )
}

// ─── Factor Chip ───────────────────────────────────────────────────────────────

function FactorChip({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? '#ff3a6e'
    : value >= 50 ? '#ffa21d'
    : value >= 30 ? '#3ec9d6'
    : '#6fd943'
  const bg =
    value >= 70 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    : value >= 50 ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
    : value >= 30 ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400'
    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bg}`}>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {label} <span className="font-semibold">{value}</span>
    </span>
  )
}

// ─── Team Summary Row ──────────────────────────────────────────────────────────

function TeamSummaryBox({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 ml-auto">{count}</span>
    </div>
  )
}

// ─── Employee Card ─────────────────────────────────────────────────────────────

function EmployeeCard({ indicator }: { indicator: BurnoutIndicator }) {
  const level = (indicator.risk_level ?? 'low') as RiskLevel
  const badgeMeta = LEVEL_BADGE[level] ?? LEVEL_BADGE.low
  const factors = indicator.factors ?? {}
  const warningSigns = (indicator.warning_signs ?? []).slice(0, 3)

  function handleSchedule() {
    toast('info', `1:1 meeting scheduling opened for ${indicator.employee_name ?? 'employee'}.`)
  }
  function handleWorkload() {
    toast('info', `Workload adjustment workflow initiated for ${indicator.employee_name ?? 'employee'}.`)
  }

  return (
    <Card className="space-y-3">
      {/* Name + department + badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {indicator.employee_name ?? indicator.employee_id.slice(0, 8)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{indicator.department ?? '—'}</p>
        </div>
        <Badge variant={badgeMeta.variant}>{badgeMeta.label}</Badge>
      </div>

      {/* Score gauge */}
      <ScoreGauge score={indicator.burnout_score ?? 0} level={level} />

      {/* Factor chips */}
      <div className="flex flex-wrap gap-1.5">
        {typeof factors.overwork === 'number' && (
          <FactorChip label="Overwork" value={Math.round(factors.overwork)} />
        )}
        {typeof factors.leave_avoidance === 'number' && (
          <FactorChip label="Leave Avoidance" value={Math.round(factors.leave_avoidance)} />
        )}
        {typeof factors.isolation === 'number' && (
          <FactorChip label="Isolation" value={Math.round(factors.isolation)} />
        )}
        {typeof factors.sentiment === 'number' && (
          <FactorChip label="Sentiment" value={Math.round(factors.sentiment)} />
        )}
      </div>

      {/* Warning signs */}
      {warningSigns.length > 0 && (
        <ul className="space-y-0.5">
          {warningSigns.map((sign, i) => (
            <li key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
              <span className="text-[#ffa21d] mt-0.5 flex-shrink-0">•</span>
              {sign}
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={handleSchedule}>Schedule 1:1</Button>
        <Button variant="ghost" size="sm" onClick={handleWorkload}>Adjust Workload</Button>
      </div>
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BurnoutAlerts() {
  const [activeFilter, setActiveFilter] = useState<'all' | RiskLevel>('all')
  const [recalcAll, setRecalcAll] = useState(false)

  const { data: indicators, isLoading } = useBurnoutIndicators()
  const calcMutation = useCalculateBurnout()

  const allIndicators: BurnoutIndicator[] = indicators ?? []
  const immediate = allIndicators.filter((i) => i.immediate_action_required)

  const filtered =
    activeFilter === 'all'
      ? allIndicators
      : allIndicators.filter((i) => i.risk_level === activeFilter)

  // Distribution for summary
  const dist: Record<RiskLevel, number> = {
    severe:   allIndicators.filter((i) => i.risk_level === 'severe').length,
    high:     allIndicators.filter((i) => i.risk_level === 'high').length,
    moderate: allIndicators.filter((i) => i.risk_level === 'moderate').length,
    low:      allIndicators.filter((i) => i.risk_level === 'low').length,
  }

  async function handleRecalcAll() {
    setRecalcAll(true)
    try {
      await calcMutation.mutateAsync({ bulk: true })
      toast('success', 'Burnout indicators recalculated for all employees.')
    } finally {
      setRecalcAll(false)
    }
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Burnout Risk Alerts</h1>
          {immediate.length > 0 && <span className="text-2xl">🔥</span>}
        </div>
        <Button loading={recalcAll} onClick={handleRecalcAll}>Recalculate All</Button>
      </div>

      {/* Alert Banner */}
      {immediate.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-[10px] border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <span className="text-xl">⚠️</span>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            {immediate.length} employee{immediate.length !== 1 ? 's' : ''} require immediate attention
          </p>
        </div>
      )}

      {/* Team Summary */}
      {!isLoading && allIndicators.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Team Burnout Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <TeamSummaryBox label="Severe" count={dist.severe} color="#ff3a6e" />
            <TeamSummaryBox label="High" count={dist.high} color="#ffa21d" />
            <TeamSummaryBox label="Moderate" count={dist.moderate} color="#3ec9d6" />
            <TeamSummaryBox label="Low / OK" count={dist.low} color="#6fd943" />
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-1.5 rounded-[8px] text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? 'bg-[#51459d] text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-[10px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">😌</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {activeFilter === 'all'
              ? 'No burnout indicators calculated yet. Click "Recalculate All" to get started.'
              : `No employees in the "${activeFilter}" category.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((indicator) => (
            <EmployeeCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      )}
    </div>
  )
}
