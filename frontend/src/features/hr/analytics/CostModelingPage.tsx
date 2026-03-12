import { useState } from 'react'
import { Card, Button, Badge } from '@/components/ui'
import { useHeadcountCost, useCompensationAnalysis, useCostScenarioModel } from '@/api/hr_phase3'

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtCurrency(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

// ─── Headcount Chart Bar ───────────────────────────────────────────────────────

function HorizBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0
  return (
    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500 text-xs text-white font-semibold"
        style={{ width: `${pct}%`, backgroundColor: color }}
      >
        {value}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface ScenarioResult {
  current_cost: number
  projected_cost: number
  delta: number
  delta_pct: number
  breakdown_by_department: Array<{ department: string; current_cost: number; projected_cost: number; delta: number }>
}

interface CompensationAnalysisResult {
  above_band: number
  within_band: number
  below_band: number
  unmatched: number
  total: number
}

export default function CostModelingPage() {
  const { data: headcountData, isLoading: hcLoading } = useHeadcountCost()
  const { data: compAnalysis, isLoading: compLoading } = useCompensationAnalysis()
  const scenarioMutation = useCostScenarioModel()

  const [growthPct, setGrowthPct] = useState(5)
  const [salaryIncreasePct, setSalaryIncreasePct] = useState(3)
  const [benefitCostPerHead, setBenefitCostPerHead] = useState('')
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() + 1)
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null)
  const [exporting, setExporting] = useState(false)

  const hcRows = headcountData ?? []
  const maxHeadcount = Math.max(...hcRows.map((r) => r.headcount), 1)
  const maxCost = Math.max(...hcRows.map((r) => r.total_salary_budget), 1)

  const totalHeadcount = hcRows.reduce((s, r) => s + r.headcount, 0)
  const totalPayroll = hcRows.reduce((s, r) => s + r.total_salary_budget, 0)
  const totalBenefits = hcRows.reduce((s, r) => s + r.benefit_cost_est, 0)
  const totalPeopleCost = totalPayroll + totalBenefits

  const comp = compAnalysis as CompensationAnalysisResult | undefined

  const handleRunScenario = async () => {
    const avgSalary = totalHeadcount > 0 ? totalPayroll / totalHeadcount : 0
    const result = await scenarioMutation.mutateAsync({
      base_headcount: totalHeadcount,
      growth_rate: growthPct,
      attrition_rate: 10,
      avg_salary: avgSalary,
      benefit_rate: 25,
      fiscal_year: fiscalYear,
    })
    setScenarioResult(result as ScenarioResult)
  }

  const handleExportHeadcount = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/v1/analytics/export/headcount-report', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'headcount-report.csv'
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cost Modeling</h1>
          <p className="text-sm text-gray-500 mt-0.5">Headcount and compensation cost analysis</p>
        </div>
        <Button variant="outline" onClick={handleExportHeadcount} loading={exporting}>
          Export Headcount Report
        </Button>
      </div>

      {/* Stats */}
      {hcLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Headcount', value: totalHeadcount.toLocaleString(), accent: '#51459d' },
            { label: 'Annual Payroll', value: fmtCurrency(totalPayroll), accent: '#3ec9d6' },
            { label: 'Est. Benefits Cost', value: fmtCurrency(totalBenefits), accent: '#ffa21d' },
            { label: 'Total People Cost', value: fmtCurrency(totalPeopleCost), accent: '#6fd943' },
          ].map((s) => (
            <Card key={s.label}>
              <div
                className="w-2 h-8 rounded-full mb-2"
                style={{ backgroundColor: s.accent }}
              />
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Headcount by Department */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Headcount by Department</h2>
          {hcLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : hcRows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No headcount data available</p>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-4 text-xs text-gray-400 mb-1">
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#51459d' }} /> Headcount</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#3ec9d6' }} /> Salary ($k)</div>
              </div>
              {[...hcRows]
                .sort((a, b) => b.headcount - a.headcount)
                .map((row) => (
                  <div key={row.department} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-300 w-32 shrink-0 truncate">{row.department}</span>
                      <HorizBar value={row.headcount} max={maxHeadcount} color="#51459d" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 shrink-0" />
                      <HorizBar value={Math.round(row.total_salary_budget / 1000)} max={Math.round(maxCost / 1000)} color="#3ec9d6" />
                      <span className="text-xs text-gray-400 shrink-0">{fmtCurrency(row.avg_salary)} avg</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* Compensation Band Analysis */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Compensation Band Compliance</h2>
          {compLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : !comp ? (
            <p className="text-sm text-gray-400 text-center py-8">No compensation band data available</p>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Within Band', count: comp.within_band, color: '#6fd943', variant: 'success' as const },
                { label: 'Below Band', count: comp.below_band, color: '#ffa21d', variant: 'warning' as const },
                { label: 'Above Band', count: comp.above_band, color: '#ff3a6e', variant: 'danger' as const },
                { label: 'Unmatched', count: comp.unmatched, color: '#aaa', variant: 'default' as const },
              ].map((item) => {
                const pct = comp.total > 0 ? Math.round((item.count / comp.total) * 100) : 0
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.variant}>{item.label}</Badge>
                        <span className="text-gray-600 dark:text-gray-300">{item.count} employees</span>
                      </div>
                      <span className="text-xs text-gray-400">{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-gray-400 mt-2">
                Total analyzed: {comp.total} employees
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Scenario Modeler */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Scenario Modeler</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4 lg:col-span-1">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Headcount Growth (%)
              </label>
              <input
                type="number"
                value={growthPct}
                onChange={(e) => setGrowthPct(Number(e.target.value))}
                className="border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full"
                min={-50}
                max={200}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Salary Increase (%)
              </label>
              <input
                type="number"
                value={salaryIncreasePct}
                onChange={(e) => setSalaryIncreasePct(Number(e.target.value))}
                className="border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full"
                min={0}
                max={50}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                New Benefit Cost / Head (optional)
              </label>
              <input
                type="number"
                value={benefitCostPerHead}
                onChange={(e) => setBenefitCostPerHead(e.target.value)}
                placeholder="e.g. 8000"
                className="border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Fiscal Year
              </label>
              <input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
                className="border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full"
              />
            </div>
            <Button
              onClick={handleRunScenario}
              disabled={scenarioMutation.isPending}
              className="w-full"
            >
              {scenarioMutation.isPending ? 'Calculating...' : 'Run Model'}
            </Button>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {!scenarioResult ? (
              <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[10px]">
                Configure parameters and click "Run Model" to see projections
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/40 rounded-[10px]">
                    <p className="text-xs text-gray-500 mb-1">Current Cost</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {fmtCurrency(scenarioResult.current_cost)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/40 rounded-[10px]">
                    <p className="text-xs text-gray-500 mb-1">Projected Cost</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {fmtCurrency(scenarioResult.projected_cost)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/40 rounded-[10px]">
                    <p className="text-xs text-gray-500 mb-1">Delta</p>
                    <p className={`text-xl font-bold ${scenarioResult.delta >= 0 ? 'text-[#ff3a6e]' : 'text-[#6fd943]'}`}>
                      {scenarioResult.delta >= 0 ? '+' : ''}{fmtCurrency(scenarioResult.delta)}
                      <span className="text-sm ml-1">
                        ({scenarioResult.delta_pct >= 0 ? '+' : ''}{scenarioResult.delta_pct?.toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                </div>

                {scenarioResult.breakdown_by_department?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700">
                          {['Department', 'Current Cost', 'Projected Cost', 'Delta'].map((h) => (
                            <th key={h} className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pr-4">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {scenarioResult.breakdown_by_department.map((row) => (
                          <tr key={row.department} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200">{row.department}</td>
                            <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{fmtCurrency(row.current_cost)}</td>
                            <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{fmtCurrency(row.projected_cost)}</td>
                            <td className={`py-2 font-semibold ${row.delta >= 0 ? 'text-[#ff3a6e]' : 'text-[#6fd943]'}`}>
                              {row.delta >= 0 ? '+' : ''}{fmtCurrency(row.delta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
