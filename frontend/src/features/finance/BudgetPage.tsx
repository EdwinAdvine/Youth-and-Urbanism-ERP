import React, { useState } from 'react'
import {
  cn,
  Button,
  Input,
  Select,
  Badge,
  Card,
  Spinner,
  Modal,
  Table,
  toast,
} from '../../components/ui'
import {
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useBudgetVsActual,
  useAccounts,
  type Budget,
  type BudgetVsActualRow,
  type CreateBudgetLinePayload,
} from '../../api/finance'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatPct(pct: number) {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

const BUDGET_BADGE: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger' | 'primary'> = {
  draft: 'default',
  active: 'success',
  closed: 'info',
}

const STATUS_OPTIONS_FORM = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
]

// ─── Budget Modal ─────────────────────────────────────────────────────────────

interface BudgetModalProps {
  open: boolean
  onClose: () => void
  editing: Budget | null
}

interface LineRow {
  account_id: string
  allocated: string
}

function BudgetModal({ open, onClose, editing }: BudgetModalProps) {
  const createMut = useCreateBudget()
  const updateMut = useUpdateBudget()
  const { data: accounts } = useAccounts()

  const currentYear = new Date().getFullYear()

  const [name, setName] = useState('')
  const [fiscalYear, setFiscalYear] = useState(String(currentYear))
  const [status, setStatus] = useState('draft')
  const [lines, setLines] = useState<LineRow[]>([{ account_id: '', allocated: '' }])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const accountOptions = [
    { value: '', label: 'Select account…' },
    ...(accounts ?? []).map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` })),
  ]

  React.useEffect(() => {
    if (open && editing) {
      setName(editing.name)
      setFiscalYear(String(editing.fiscal_year))
      setStatus(editing.status)
      setLines(
        editing.lines.length > 0
          ? editing.lines.map((l) => ({ account_id: l.account_id, allocated: String(l.allocated) }))
          : [{ account_id: '', allocated: '' }]
      )
    } else if (open && !editing) {
      setName('')
      setFiscalYear(String(currentYear))
      setStatus('draft')
      setLines([{ account_id: '', allocated: '' }])
    }
    setErrors({})
  }, [open, editing])

  function addLine() {
    setLines((prev) => [...prev, { account_id: '', allocated: '' }])
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof LineRow, value: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    const yr = parseInt(fiscalYear)
    if (isNaN(yr) || yr < 2000 || yr > 2100) e.fiscalYear = 'Valid fiscal year required'
    const validLines = lines.filter((l) => l.account_id && l.allocated)
    if (validLines.length === 0) e.lines = 'At least one budget line is required'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    const validLines: CreateBudgetLinePayload[] = lines
      .filter((l) => l.account_id && l.allocated)
      .map((l) => ({ account_id: l.account_id, allocated: Number(l.allocated) }))

    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          name: name.trim(),
          fiscal_year: parseInt(fiscalYear),
          status,
        })
        toast('success', 'Budget updated')
      } else {
        await createMut.mutateAsync({
          name: name.trim(),
          fiscal_year: parseInt(fiscalYear),
          status,
          lines: validLines,
        })
        toast('success', 'Budget created')
      }
      onClose()
    } catch {
      toast('error', 'Failed to save budget')
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Budget' : 'New Budget'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <Input
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="e.g. Operations Budget FY2026"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Fiscal Year *"
            type="number"
            min="2000"
            max="2100"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            error={errors.fiscalYear}
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS_FORM}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>

        {/* Budget lines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Budget Lines *</label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              + Add Line
            </Button>
          </div>
          {errors.lines && <p className="text-xs text-danger mb-2">{errors.lines}</p>}
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    label={idx === 0 ? 'Account' : undefined}
                    options={accountOptions}
                    value={line.account_id}
                    onChange={(e) => updateLine(idx, 'account_id', e.target.value)}
                  />
                </div>
                <div className="w-36">
                  <Input
                    label={idx === 0 ? 'Allocated' : undefined}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.allocated}
                    onChange={(e) => updateLine(idx, 'allocated', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="mb-0.5 text-gray-400 hover:text-danger transition-colors p-1.5"
                    title="Remove line"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" loading={isBusy}>
            {editing ? 'Save Changes' : 'Create Budget'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Budget vs Actual Table ───────────────────────────────────────────────────

function BudgetVsActualTable({ fiscalYear }: { fiscalYear: number }) {
  const { data, isLoading, error } = useBudgetVsActual(fiscalYear)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="md" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-danger py-4">Failed to load report.</p>
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No budget vs actual data for {fiscalYear}.</p>
  }

  const columns = [
    {
      key: 'budget_name',
      label: 'Budget',
      render: (row: BudgetVsActualRow) => (
        <span className="font-medium text-gray-900">{row.budget_name}</span>
      ),
    },
    {
      key: 'account',
      label: 'Account',
      render: (row: BudgetVsActualRow) => (
        <span className="text-gray-700">
          {row.account_code} – {row.account_name}
        </span>
      ),
    },
    {
      key: 'allocated',
      label: 'Allocated',
      render: (row: BudgetVsActualRow) => formatCurrency(row.allocated),
    },
    {
      key: 'spent',
      label: 'Spent',
      render: (row: BudgetVsActualRow) => (
        <span className={row.spent > row.allocated ? 'text-danger font-medium' : ''}>
          {formatCurrency(row.spent)}
        </span>
      ),
    },
    {
      key: 'remaining',
      label: 'Remaining',
      render: (row: BudgetVsActualRow) => (
        <span className={row.remaining < 0 ? 'text-danger font-semibold' : 'text-green-700 font-semibold'}>
          {formatCurrency(row.remaining)}
        </span>
      ),
    },
    {
      key: 'variance_pct',
      label: 'Variance %',
      render: (row: BudgetVsActualRow) => (
        <span className={row.variance_pct < 0 ? 'text-danger' : 'text-green-700'}>
          {formatPct(row.variance_pct)}
        </span>
      ),
    },
  ]

  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <Table<BudgetVsActualRow>
          columns={columns}
          data={data}
          emptyText="No data"
          keyExtractor={(row) => `${row.budget_id}-${row.account_id}`}
        />
      </div>
    </Card>
  )
}

// ─── BudgetPage ───────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  const { data: budgets, isLoading } = useBudgets(selectedYear)
  const deleteMut = useDeleteBudget()

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(b: Budget) {
    setEditing(b)
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this budget? This action cannot be undone.')) return
    try {
      await deleteMut.mutateAsync(id)
      toast('success', 'Budget deleted')
    } catch {
      toast('error', 'Failed to delete budget')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: Budget) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'fiscal_year',
      label: 'Fiscal Year',
      render: (row: Budget) => <span className="text-gray-700">{row.fiscal_year}</span>,
    },
    {
      key: 'total_amount',
      label: 'Total Budget',
      render: (row: Budget) => <span className="font-medium">{formatCurrency(row.total_amount)}</span>,
    },
    {
      key: 'spent_amount',
      label: 'Spent',
      render: (row: Budget) => (
        <span className={row.spent_amount > row.total_amount ? 'text-danger font-medium' : ''}>
          {formatCurrency(row.spent_amount)}
        </span>
      ),
    },
    {
      key: 'remaining',
      label: 'Remaining',
      render: (row: Budget) => {
        const remaining = row.total_amount - row.spent_amount
        return (
          <span className={cn('font-semibold', remaining < 0 ? 'text-danger' : 'text-green-700')}>
            {formatCurrency(remaining)}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Budget) => (
        <Badge variant={BUDGET_BADGE[row.status] ?? 'default'}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Budget) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
            Edit
          </Button>
          {row.status === 'draft' && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDelete(row.id)}
              loading={deleteMut.isPending}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Budgets</h1>
          <p className="text-sm text-gray-500 mt-1">Manage budgets and track spending by account</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Budget
        </Button>
      </div>

      {/* Fiscal year filter */}
      <div className="flex items-end gap-3 mb-4">
        <div className="w-40">
          <Input
            label="Fiscal Year"
            type="number"
            min="2000"
            max="2100"
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(parseInt(e.target.value) || currentYear)}
          />
        </div>
        <span className="text-sm text-gray-500 mb-2">{budgets?.length ?? 0} budgets</span>
      </div>

      {/* Budgets table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card padding={false}>
          <Table<Budget>
            columns={columns}
            data={budgets ?? []}
            loading={isLoading}
            emptyText="No budgets found for this fiscal year"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      {/* Budget vs Actual section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Budget vs Actual</h2>
          <Button
            variant="outline"
            onClick={() => setReportOpen((prev) => !prev)}
          >
            {reportOpen ? 'Hide Report' : 'View Report'}
          </Button>
        </div>

        {reportOpen && (
          <BudgetVsActualTable fiscalYear={selectedYear} />
        )}
      </div>

      <BudgetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />
    </div>
  )
}
