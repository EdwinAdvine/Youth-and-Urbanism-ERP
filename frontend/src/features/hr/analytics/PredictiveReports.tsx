import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge } from '@/components/ui'
import {
  useAttritionRisk,
  useHiringDemand,
  useFlightRiskScores,
  useRecalculateFlightRisk,
} from '@/api/hr_phase3'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

// Risk colors available: low=#6fd943, medium=#ffa21d, high=#ff7043, critical=#ff3a6e

function riskBadgeVariant(level: RiskLevel): 'success' | 'warning' | 'danger' | 'default' {
  const map: Record<RiskLevel, 'success' | 'warning' | 'danger' | 'default'> = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
    critical: 'danger',
  }
  return map[level] ?? 'default'
}

function scoreColor(score: number): string {
  if (score >= 75) return '#ff3a6e'
  if (score >= 50) return '#ff7043'
  if (score >= 25) return '#ffa21d'
  return '#6fd943'
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function priorityBadge(priority: 'urgent' | 'normal' | 'low') {
  const map: Record<string, 'danger' | 'warning' | 'default'> = {
    urgent: 'danger',
    normal: 'warning',
    low: 'default',
  }
  return <Badge variant={map[priority] ?? 'default'}>{priority}</Badge>
}

// ─── Action Drawer ────────────────────────────────────────────────────────────

function ActionDrawer({
  employeeName,
  recommendations,
  factors,
  onClose,
}: {
  employeeName: string
  recommendations: string[]
  factors: string[]
  onClose: () => void
}) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-30 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-96 max-w-full bg-white dark:bg-gray-800 shadow-xl z-40 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Recommendations</h3>
            <p className="text-xs text-gray-500 mt-0.5">{employeeName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {factors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Risk Factors</h4>
              <div className="space-y-2">
                {factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recommendations.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Recommended Actions
              </h4>
              <div className="space-y-3">
                {recommendations.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              No AI recommendations available yet.
              <br />
              Run risk recalculation to generate insights.
            </p>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-700">
          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </div>
    </>
  )
}

// ─── Attrition Risk Tab ───────────────────────────────────────────────────────

function AttritionRiskTab() {
  const { data: riskData, isLoading } = useAttritionRisk()
  const { data: scoresData, isLoading: loadingScores } = useFlightRiskScores()
  const recalculate = useRecalculateFlightRisk()

  const [deptFilter, setDeptFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [drawerEmployee, setDrawerEmployee] = useState<{
    name: string
    recommendations: string[]
    factors: string[]
  } | null>(null)

  // Normalise attrition data
  const rawRisk = riskData as {
    high_risk_count?: number
    critical_risk_count?: number
    total_estimated_replacement_cost?: number
    employees?: Array<{
      employee_id: string
      employee_name: string
      department: string
      risk_score: number
      risk_level: RiskLevel
      top_factors: string[]
      last_reviewed: string | null
      ai_recommendations?: string[]
      estimated_replacement_cost?: number
    }>
  } | null | undefined

  // Normalise flight risk scores (older shape from the existing hook)
  const rawScores = scoresData as Array<{
    id?: string
    employee_id: string
    score?: number
    risk_level?: RiskLevel
    level?: RiskLevel
    factors?: unknown
    recommendations?: string[]
    calculated_at?: string
  }> | { items?: unknown[] } | null | undefined

  const scoresList = Array.isArray(rawScores)
    ? rawScores
    : (rawScores as { items?: unknown[] })?.items ?? []

  // Merge employees from both sources
  type EmployeeRow = {
    id: string
    name: string
    department: string
    score: number
    level: RiskLevel
    factors: string[]
    recommendations: string[]
    lastReviewed: string | null
    replacementCost: number
  }

  const employees: EmployeeRow[] = []

  if (rawRisk?.employees) {
    rawRisk.employees.forEach(e => {
      employees.push({
        id: e.employee_id,
        name: e.employee_name,
        department: e.department,
        score: e.risk_score,
        level: e.risk_level,
        factors: e.top_factors ?? [],
        recommendations: e.ai_recommendations ?? [],
        lastReviewed: e.last_reviewed,
        replacementCost: e.estimated_replacement_cost ?? 0,
      })
    })
  } else if (scoresList.length > 0) {
    (scoresList as Array<{
      id?: string
      employee_id: string
      score?: number
      risk_level?: RiskLevel
      level?: RiskLevel
      factors?: Record<string, number> | null
      recommendations?: string[] | null
      calculated_at?: string
    }>).forEach(s => {
      const level: RiskLevel = s.risk_level ?? s.level ?? 'low'
      if (level === 'low' || level === 'medium') return
      const factorMap = (s.factors ?? {}) as Record<string, number>
      employees.push({
        id: s.employee_id,
        name: `Employee ${s.employee_id.slice(0, 8)}`,
        department: '—',
        score: s.score ?? 0,
        level,
        factors: Object.entries(factorMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([k]) => k.replace('_', ' ')),
        recommendations: s.recommendations ?? [],
        lastReviewed: s.calculated_at ?? null,
        replacementCost: 0,
      })
    })
  }

  // Summary stats
  const highCount = rawRisk?.high_risk_count ?? employees.filter(e => e.level === 'high').length
  const criticalCount = rawRisk?.critical_risk_count ?? employees.filter(e => e.level === 'critical').length
  const totalAtRisk = highCount + criticalCount
  const totalCost = rawRisk?.total_estimated_replacement_cost ?? employees.reduce((s, e) => s + e.replacementCost, 0)
  const preventable = highCount

  // Departments for filter
  const departments = [...new Set(employees.map(e => e.department).filter(d => d && d !== '—'))]

  const filtered = employees.filter(e => {
    if (deptFilter && e.department !== deptFilter) return false
    if (levelFilter && e.level !== levelFilter) return false
    return true
  })

  const loading = isLoading || loadingScores

  return (
    <div className="space-y-5">
      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Total At Risk (High + Critical)</p>
          <p className="text-3xl font-bold text-danger">{totalAtRisk}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Est. Replacement Cost</p>
          <p className="text-3xl font-bold text-warning">{formatCurrency(totalCost)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Preventable (High Risk)</p>
          <p className="text-3xl font-bold text-info">{preventable}</p>
        </Card>
      </div>

      {/* Filters + Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <select
            className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
          >
            <option value="">All Risk Levels</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => recalculate.mutate()}
          loading={recalculate.isPending}
        >
          Recalculate All
        </Button>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Employee', 'Department', 'Risk Score', 'Risk Level', 'Top Factors', 'Last Reviewed', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800 animate-pulse">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                    {employees.length === 0
                      ? 'No flight risk data available. Run recalculation to generate scores.'
                      : 'No employees match the selected filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map(e => (
                  <tr
                    key={e.id}
                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{e.name}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{e.department}</td>
                    <td className="py-3 px-4">
                      <span className="text-base font-bold" style={{ color: scoreColor(e.score) }}>
                        {e.score.toFixed(0)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={riskBadgeVariant(e.level)}>
                        {e.level}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {e.factors.slice(0, 2).map((f, i) => (
                          <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full capitalize">
                            {f}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {e.lastReviewed
                        ? new Date(e.lastReviewed).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDrawerEmployee({
                          name: e.name,
                          recommendations: e.recommendations,
                          factors: e.factors,
                        })}
                      >
                        Take Action
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Action Drawer */}
      {drawerEmployee && (
        <ActionDrawer
          employeeName={drawerEmployee.name}
          recommendations={drawerEmployee.recommendations}
          factors={drawerEmployee.factors}
          onClose={() => setDrawerEmployee(null)}
        />
      )}
    </div>
  )
}

// ─── Hiring Demand Tab ────────────────────────────────────────────────────────

function HiringDemandTab() {
  const { data, isLoading } = useHiringDemand()
  const navigate = useNavigate()

  const rawData = data as {
    open_positions?: number
    avg_time_to_fill?: number
    projected_hires_next_quarter?: number
    requisitions?: Array<{
      id: string
      department: string
      open_reqs: number
      target_hire_date: string | null
      priority: 'urgent' | 'normal' | 'low'
      status: string
      avg_time_to_fill: number | null
    }>
  } | null | undefined

  const openPositions = rawData?.open_positions ?? 0
  const avgFill = rawData?.avg_time_to_fill ?? 0
  const projectedHires = rawData?.projected_hires_next_quarter ?? 0
  const requisitions = rawData?.requisitions ?? []

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Open Positions</p>
          {isLoading
            ? <div className="h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            : <p className="text-3xl font-bold" style={{ color: '#51459d' }}>{openPositions}</p>}
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Avg Time to Fill</p>
          {isLoading
            ? <div className="h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            : <p className="text-3xl font-bold" style={{ color: '#ffa21d' }}>{avgFill}d</p>}
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Projected Hires (Next Quarter)</p>
          {isLoading
            ? <div className="h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            : <p className="text-3xl font-bold" style={{ color: '#6fd943' }}>{projectedHires}</p>}
        </Card>
      </div>

      {/* Requisitions Table */}
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Open Requisitions by Department</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Department', 'Open Reqs', 'Target Hire Date', 'Priority', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800 animate-pulse">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : requisitions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                    No open requisitions found.
                  </td>
                </tr>
              ) : (
                requisitions.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{r.department}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{r.open_reqs}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      {r.target_hire_date ? new Date(r.target_hire_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">{priorityBadge(r.priority)}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => navigate('/hr/ats')}
                        className="text-sm text-primary hover:underline"
                      >
                        View Requisitions
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'attrition' | 'hiring'

export default function PredictiveReports() {
  const [activeTab, setActiveTab] = useState<Tab>('attrition')

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Predictive Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">AI-powered HR forecasting</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {([
          { key: 'attrition', label: 'Attrition Risk' },
          { key: 'hiring', label: 'Hiring Demand' },
        ] as { key: Tab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'attrition' && <AttritionRiskTab />}
      {activeTab === 'hiring' && <HiringDemandTab />}
    </div>
  )
}
