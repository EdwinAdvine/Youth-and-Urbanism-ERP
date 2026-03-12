import { useState, useMemo } from 'react'
import { Card, Badge, Button, Input, Modal } from '../../../components/ui'
import {
  useWorkforceScenarios,
  useCreateWorkforceScenario,
  type WorkforcePlanningScenario,
} from '@/api/hr_phase3'

type WorkforceScenario = WorkforcePlanningScenario
type ScenarioVariant = NonNullable<WorkforcePlanningScenario['scenarios']>[number] & { salary_increase_pct?: number; attrition_count?: number }
type WorkforceScenarioCreatePayload = Partial<WorkforcePlanningScenario> & { variants?: Array<{ name: string; growth_rate: number; attrition_rate: number; new_hires: number; salary_increase_pct?: number }> }
import { toast } from '../../../components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function calcProjectedHeadcount(base: number, variant: ScenarioVariant): number {
  const growth = Math.round(base * (variant.growth_rate / 100))
  return base + (variant.new_hires ?? 0) + growth - (variant.attrition_count ?? Math.round(base * 0.05))
}

function calcProjectedCost(base: number, baseBudget: number, variant: ScenarioVariant): number {
  const headcount = calcProjectedHeadcount(base, variant)
  const avgSalary = baseBudget / Math.max(base, 1)
  const newAvgSalary = avgSalary * (1 + (variant.salary_increase_pct ?? 0) / 100)
  return headcount * newAvgSalary
}

const VARIANT_COLORS: Record<string, string> = {
  best_case:  '#6fd943',
  worst_case: '#ff3a6e',
  base_case:  '#51459d',
}

function getVariantColor(name: string): string {
  const key = name.toLowerCase().replace(/\s/g, '_')
  return VARIANT_COLORS[key] ?? '#3ec9d6'
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

// ─── Variant Row for Scenario Card ────────────────────────────────────────────

function VariantBadge({ name }: { name: string }) {
  const color = getVariantColor(name)
  const label =
    name.toLowerCase().includes('best') ? 'Best Case'
    : name.toLowerCase().includes('worst') ? 'Worst Case'
    : name.toLowerCase().includes('base') ? 'Base Case'
    : name
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {label}
    </span>
  )
}

// ─── Scenario Card ─────────────────────────────────────────────────────────────

function ScenarioCard({ scenario }: { scenario: WorkforceScenario }) {
  const variants: ScenarioVariant[] = scenario.scenarios ?? []

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{scenario.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">FY {scenario.fiscal_year} · Base: {scenario.base_headcount} employees</p>
        </div>
        <Badge variant="primary">{variants.length} variant{variants.length !== 1 ? 's' : ''}</Badge>
      </div>

      {variants.length > 0 && (
        <div className="space-y-2">
          {variants.map((v, i) => {
            const projected = calcProjectedHeadcount(scenario.base_headcount, v)
            const cost = calcProjectedCost(scenario.base_headcount, scenario.base_budget ?? 0, v)
            const delta = projected - scenario.base_headcount
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-[10px] border border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <VariantBadge name={v.name} />
                <div className="flex-1 flex items-center gap-4 text-sm flex-wrap">
                  <span className="text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">{projected}</span> heads
                  </span>
                  <span className="text-gray-400 text-xs">
                    {delta >= 0 ? '+' : ''}{delta} from base
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 ml-auto font-semibold">
                    {formatCurrency(cost)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {variants.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No variants defined</p>
      )}
    </Card>
  )
}

// ─── Comparison Table ──────────────────────────────────────────────────────────

function ComparisonTable({ scenario }: { scenario: WorkforceScenario }) {
  const variants: ScenarioVariant[] = scenario.scenarios ?? []
  if (variants.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700">
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Variant</th>
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Headcount</th>
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Delta</th>
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Projected Cost</th>
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Cost Delta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {variants.map((v, i) => {
            const projected = calcProjectedHeadcount(scenario.base_headcount, v)
            const cost = calcProjectedCost(scenario.base_headcount, scenario.base_budget ?? 0, v)
            const baseCost = scenario.base_budget ?? 0
            const hcDelta = projected - scenario.base_headcount
            const costDelta = cost - baseCost
            return (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <td className="py-2.5 px-3">
                  <VariantBadge name={v.name} />
                </td>
                <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-gray-100">{projected}</td>
                <td className="py-2.5 px-3">
                  <span className={`text-xs font-semibold ${hcDelta >= 0 ? 'text-[#6fd943]' : 'text-[#ff3a6e]'}`}>
                    {hcDelta >= 0 ? '+' : ''}{hcDelta}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(cost)}</td>
                <td className="py-2.5 px-3">
                  <span className={`text-xs font-semibold ${costDelta >= 0 ? 'text-[#ffa21d]' : 'text-[#6fd943]'}`}>
                    {costDelta >= 0 ? '+' : ''}{formatCurrency(Math.abs(costDelta))}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Variant Row in Form ───────────────────────────────────────────────────────

interface VariantFormRow {
  name: string
  growth_rate: string
  attrition_rate: string
  new_hires: string
  salary_increase_pct: string
}

const EMPTY_VARIANT: VariantFormRow = {
  name: '',
  growth_rate: '0',
  attrition_rate: '5',
  new_hires: '0',
  salary_increase_pct: '0',
}

interface VariantEditorRowProps {
  index: number
  row: VariantFormRow
  onChange: (index: number, updated: VariantFormRow) => void
  onRemove: (index: number) => void
  baseHeadcount: number
  baseBudget: number
}

function VariantEditorRow({ index, row, onChange, onRemove, baseHeadcount, baseBudget }: VariantEditorRowProps) {
  const base = parseInt(baseHeadcount.toString()) || 0
  const budget = parseFloat(baseBudget.toString()) || 0
  const growth = parseFloat(row.growth_rate) || 0
  const attrition = parseFloat(row.attrition_rate) || 0
  const newHires = parseInt(row.new_hires) || 0
  const salaryInc = parseFloat(row.salary_increase_pct) || 0
  const growthAdds = Math.round(base * (growth / 100))
  const attritionLoss = Math.round(base * (attrition / 100))
  const projected = base + newHires + growthAdds - attritionLoss
  const avgSalary = budget / Math.max(base, 1)
  const newAvgSalary = avgSalary * (1 + salaryInc / 100)
  const projectedCost = projected * newAvgSalary

  function update(field: keyof VariantFormRow, value: string) {
    onChange(index, { ...row, [field]: value })
  }

  return (
    <div className="p-3 rounded-[10px] border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Variant {index + 1}
        </p>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-xs text-[#ff3a6e] hover:underline"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Input
          label="Name"
          value={row.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. Best Case"
        />
        <Input
          label="Growth Rate (%)"
          type="number"
          value={row.growth_rate}
          onChange={(e) => update('growth_rate', e.target.value)}
        />
        <Input
          label="Attrition Rate (%)"
          type="number"
          value={row.attrition_rate}
          onChange={(e) => update('attrition_rate', e.target.value)}
        />
        <Input
          label="New Hires"
          type="number"
          value={row.new_hires}
          onChange={(e) => update('new_hires', e.target.value)}
        />
        <Input
          label="Salary Increase (%)"
          type="number"
          value={row.salary_increase_pct}
          onChange={(e) => update('salary_increase_pct', e.target.value)}
        />
        <div className="flex items-end pb-0.5">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            <p>Projected: <span className="font-semibold text-gray-900 dark:text-gray-100">{projected} heads</span></p>
            <p>Est. cost: <span className="font-semibold text-[#51459d]">{formatCurrency(projectedCost)}</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── New Scenario Modal ────────────────────────────────────────────────────────

interface NewScenarioModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: WorkforceScenarioCreatePayload) => void
  saving: boolean
}

const EMPTY_SCENARIO_FORM = {
  name: '',
  fiscal_year: new Date().getFullYear() + 1,
  base_headcount: 0,
  base_budget: 0,
}

function NewScenarioModal({ open, onClose, onSave, saving }: NewScenarioModalProps) {
  const [form, setForm] = useState(EMPTY_SCENARIO_FORM)
  const [variants, setVariants] = useState<VariantFormRow[]>([{ ...EMPTY_VARIANT, name: 'Base Case' }])

  function handleSave() {
    if (!form.name.trim()) { toast('error', 'Scenario name is required.'); return }
    if (form.base_headcount <= 0) { toast('error', 'Base headcount must be > 0.'); return }
    const validVariants = variants.filter((v) => v.name.trim())
    onSave({
      name: form.name.trim(),
      fiscal_year: form.fiscal_year,
      base_headcount: form.base_headcount,
      base_budget: form.base_budget,
      variants: validVariants.map((v) => ({
        name: v.name.trim(),
        growth_rate: parseFloat(v.growth_rate) || 0,
        attrition_rate: parseFloat(v.attrition_rate) || 0,
        new_hires: parseInt(v.new_hires) || 0,
        salary_increase_pct: parseFloat(v.salary_increase_pct) || 0,
      })),
    })
  }

  function handleClose() {
    setForm(EMPTY_SCENARIO_FORM)
    setVariants([{ ...EMPTY_VARIANT, name: 'Base Case' }])
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="New Workforce Scenario" size="xl">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Scenario Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. FY2027 Growth Plan"
          />
          <Input
            label="Fiscal Year"
            type="number"
            value={form.fiscal_year}
            onChange={(e) => setForm((f) => ({ ...f, fiscal_year: parseInt(e.target.value) || f.fiscal_year }))}
          />
          <Input
            label="Base Headcount *"
            type="number"
            value={form.base_headcount || ''}
            onChange={(e) => setForm((f) => ({ ...f, base_headcount: parseInt(e.target.value) || 0 }))}
            placeholder="Current employee count"
          />
          <Input
            label="Base Budget ($)"
            type="number"
            value={form.base_budget || ''}
            onChange={(e) => setForm((f) => ({ ...f, base_budget: parseFloat(e.target.value) || 0 }))}
            placeholder="Annual salary budget"
          />
        </div>

        {/* Variants */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Scenario Variants</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVariants((prev) => [...prev, { ...EMPTY_VARIANT }])}
            >
              + Add Variant
            </Button>
          </div>
          <div className="space-y-3">
            {variants.map((v, i) => (
              <VariantEditorRow
                key={i}
                index={i}
                row={v}
                onChange={(idx, updated) => setVariants((prev) => prev.map((r, j) => j === idx ? updated : r))}
                onRemove={(idx) => setVariants((prev) => prev.filter((_, j) => j !== idx))}
                baseHeadcount={form.base_headcount}
                baseBudget={form.base_budget}
              />
            ))}
            {variants.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No variants added. Click "Add Variant" above.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
        <Button variant="outline" onClick={handleClose}>Cancel</Button>
        <Button loading={saving} onClick={handleSave}>Create Scenario</Button>
      </div>
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkforcePlanningPage() {
  const [newOpen, setNewOpen] = useState(false)
  const [compareId, setCompareId] = useState<string | null>(null)

  const { data: scenarios, isLoading } = useWorkforceScenarios()
  const createMutation = useCreateWorkforceScenario()

  const allScenarios: WorkforceScenario[] = scenarios?.items ?? []

  // Summary stats from first/most recent scenario
  const primaryScenario = allScenarios[0] ?? null
  const totalHeadcount = primaryScenario?.base_headcount ?? 0
  const totalBudget = primaryScenario?.base_budget ?? 0
  const openPositions = allScenarios.reduce((sum, s) => {
    const maxNewHires = Math.max(...(s.scenarios ?? []).map((v) => v.new_hires ?? 0), 0)
    return sum + maxNewHires
  }, 0)

  // Best projected growth (highest headcount delta across all scenarios/variants)
  const bestGrowth = useMemo(() => {
    let max = 0
    allScenarios.forEach((s) => {
      (s.scenarios ?? []).forEach((v) => {
        const projected = calcProjectedHeadcount(s.base_headcount, v)
        const delta = projected - s.base_headcount
        if (delta > max) max = delta
      })
    })
    return max
  }, [allScenarios])

  async function handleCreate(data: WorkforceScenarioCreatePayload) {
    await createMutation.mutateAsync(data)
    setNewOpen(false)
    toast('success', `Scenario "${data.name}" created.`)
  }

  const compareScenario = compareId ? allScenarios.find((s) => s.id === compareId) ?? null : null

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workforce Planning</h1>
          <p className="text-sm text-gray-500 mt-0.5">Model headcount and cost scenarios</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>+ New Scenario</Button>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-[10px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Current Headcount"
            value={totalHeadcount || '—'}
            icon="👥"
            accent="#51459d"
          />
          <StatCard
            label="Total Salary Budget"
            value={totalBudget ? formatCurrency(totalBudget) : '—'}
            icon="💰"
            accent="#6fd943"
          />
          <StatCard
            label="Projected Growth"
            value={bestGrowth > 0 ? `+${bestGrowth}` : '—'}
            icon="📈"
            accent="#3ec9d6"
            sub="best case scenario"
          />
          <StatCard
            label="Open Positions"
            value={openPositions || '—'}
            icon="📋"
            accent="#ffa21d"
          />
        </div>
      )}

      {/* Scenarios */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 rounded-[10px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      ) : allScenarios.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">No workforce scenarios yet.</p>
          <p className="text-sm text-gray-400 mt-1">Create your first scenario to model headcount and cost projections.</p>
          <Button className="mt-4" onClick={() => setNewOpen(true)}>Create First Scenario</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {allScenarios.map((scenario) => (
              <div key={scenario.id} className="space-y-2">
                <ScenarioCard scenario={scenario} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCompareId(compareId === scenario.id ? null : scenario.id)}
                >
                  {compareId === scenario.id ? 'Hide Comparison' : 'Show Comparison Table'}
                </Button>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          {compareScenario && (
            <Card>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Comparison — {compareScenario.name}
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                Side-by-side variant comparison (base: {compareScenario.base_headcount} heads, {formatCurrency(compareScenario.base_budget ?? 0)} budget)
              </p>
              <ComparisonTable scenario={compareScenario} />
            </Card>
          )}
        </>
      )}

      <NewScenarioModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSave={handleCreate}
        saving={createMutation.isPending}
      />
    </div>
  )
}
