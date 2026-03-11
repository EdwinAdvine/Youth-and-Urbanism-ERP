import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  useSalaryStructures,
  useCreateSalaryStructure,
  useUpdateSalaryStructure,
  useDeleteSalaryStructure,
  usePayslips,
  useGeneratePayslips,
  useApprovePayslip,
  useMarkPayslipPaid,
  useEmployees,
  type SalaryStructure,
  type Payslip,
} from '../../api/hr'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function parseJsonPairs(raw: string): Record<string, number> | null {
  if (!raw.trim()) return null
  try {
    const lines = raw.split('\n').filter((l) => l.trim())
    const result: Record<string, number> = {}
    for (const line of lines) {
      const idx = line.indexOf(':')
      if (idx === -1) continue
      const key = line.slice(0, idx).trim()
      const val = parseFloat(line.slice(idx + 1).trim())
      if (key && !isNaN(val)) result[key] = val
    }
    return Object.keys(result).length > 0 ? result : null
  } catch {
    return null
  }
}

function pairsToText(obj: Record<string, number> | null): string {
  if (!obj) return ''
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

// ─── Status badge maps ────────────────────────────────────────────────────────

const PAYSLIP_BADGE: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger' | 'primary'> = {
  draft: 'default',
  approved: 'info',
  paid: 'success',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
]

// ─── Salary Structure Modal ───────────────────────────────────────────────────

interface StructureModalProps {
  open: boolean
  onClose: () => void
  editing: SalaryStructure | null
}

function StructureModal({ open, onClose, editing }: StructureModalProps) {
  const createMut = useCreateSalaryStructure()
  const updateMut = useUpdateSalaryStructure()

  const [name, setName] = useState('')
  const [baseSalary, setBaseSalary] = useState('')
  const [allowancesText, setAllowancesText] = useState('')
  const [deductionsText, setDeductionsText] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Populate form when editing
  React.useEffect(() => {
    if (open && editing) {
      setName(editing.name)
      setBaseSalary(String(editing.base_salary))
      setAllowancesText(pairsToText(editing.allowances))
      setDeductionsText(pairsToText(editing.deductions))
      setIsActive(editing.is_active)
    } else if (open && !editing) {
      setName('')
      setBaseSalary('')
      setAllowancesText('')
      setDeductionsText('')
      setIsActive(true)
    }
    setErrors({})
  }, [open, editing])

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!baseSalary || isNaN(Number(baseSalary)) || Number(baseSalary) < 0)
      e.baseSalary = 'Valid base salary is required'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    const payload = {
      name: name.trim(),
      base_salary: Number(baseSalary),
      allowances: parseJsonPairs(allowancesText),
      deductions: parseJsonPairs(deductionsText),
      is_active: isActive,
    }

    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Salary structure updated')
      } else {
        await createMut.mutateAsync(payload)
        toast('success', 'Salary structure created')
      }
      onClose()
    } catch {
      toast('error', 'Failed to save salary structure')
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Salary Structure' : 'New Salary Structure'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="e.g. Senior Engineer"
        />
        <Input
          label="Base Salary *"
          type="number"
          min="0"
          step="0.01"
          value={baseSalary}
          onChange={(e) => setBaseSalary(e.target.value)}
          error={errors.baseSalary}
          placeholder="0.00"
        />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Allowances <span className="text-gray-400 font-normal">(one per line: key: value)</span>
          </label>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[80px] resize-y"
            value={allowancesText}
            onChange={(e) => setAllowancesText(e.target.value)}
            placeholder={'Housing: 500\nTransport: 200'}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Deductions <span className="text-gray-400 font-normal">(one per line: key: value)</span>
          </label>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[80px] resize-y"
            value={deductionsText}
            onChange={(e) => setDeductionsText(e.target.value)}
            placeholder={'NHIF: 150\nNSSF: 200'}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-gray-700">Active</span>
        </label>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" loading={isBusy}>
            {editing ? 'Save Changes' : 'Create Structure'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Generate Payslips Modal ──────────────────────────────────────────────────

interface GenerateModalProps {
  open: boolean
  onClose: () => void
}

function GeneratePayslipsModal({ open, onClose }: GenerateModalProps) {
  const generateMut = useGeneratePayslips()
  const { data: structures } = useSalaryStructures()

  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [structureId, setStructureId] = useState('')
  const [employeeIds, setEmployeeIds] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setPeriodStart('')
      setPeriodEnd('')
      setStructureId('')
      setEmployeeIds('')
      setErrors({})
    }
  }, [open])

  const structureOptions = [
    { value: '', label: 'All structures (use employee default)' },
    ...(structures ?? []).map((s) => ({ value: s.id, label: s.name })),
  ]

  function validate() {
    const e: Record<string, string> = {}
    if (!periodStart) e.periodStart = 'Period start is required'
    if (!periodEnd) e.periodEnd = 'Period end is required'
    if (periodStart && periodEnd && periodStart > periodEnd)
      e.periodEnd = 'Period end must be after start'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    const idsRaw = employeeIds.trim()
    const employeeIdList = idsRaw
      ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : null

    try {
      await generateMut.mutateAsync({
        period_start: periodStart,
        period_end: periodEnd,
        salary_structure_id: structureId || null,
        employee_ids: employeeIdList,
      })
      toast('success', 'Payslips generated successfully')
      onClose()
    } catch {
      toast('error', 'Failed to generate payslips')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate Payslips" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Period Start *"
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          error={errors.periodStart}
        />
        <Input
          label="Period End *"
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          error={errors.periodEnd}
        />
        <Select
          label="Salary Structure (optional)"
          options={structureOptions}
          value={structureId}
          onChange={(e) => setStructureId(e.target.value)}
        />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Employee IDs <span className="text-gray-400 font-normal">(optional, comma-separated)</span>
          </label>
          <input
            type="text"
            value={employeeIds}
            onChange={(e) => setEmployeeIds(e.target.value)}
            placeholder="Leave empty for all active employees"
            className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
          />
          <p className="text-xs text-gray-500">Leave empty to generate for all active employees</p>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={generateMut.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={generateMut.isPending}>
            Generate
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Salary Structures Tab ────────────────────────────────────────────────────

function SalaryStructuresTab() {
  const { data: structures, isLoading } = useSalaryStructures()
  const deleteMut = useDeleteSalaryStructure()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SalaryStructure | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(s: SalaryStructure) {
    setEditing(s)
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this salary structure? This action cannot be undone.')) return
    try {
      await deleteMut.mutateAsync(id)
      toast('success', 'Salary structure deleted')
    } catch {
      toast('error', 'Failed to delete salary structure')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: SalaryStructure) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'base_salary',
      label: 'Base Salary',
      render: (row: SalaryStructure) => <span className="font-medium">{formatCurrency(row.base_salary)}</span>,
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (row: SalaryStructure) => {
        const count = row.allowances ? Object.keys(row.allowances).length : 0
        return count > 0 ? (
          <span className="text-gray-700">{count} item{count !== 1 ? 's' : ''}</span>
        ) : (
          <span className="text-gray-400">None</span>
        )
      },
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (row: SalaryStructure) => {
        const count = row.deductions ? Object.keys(row.deductions).length : 0
        return count > 0 ? (
          <span className="text-gray-700">{count} item{count !== 1 ? 's' : ''}</span>
        ) : (
          <span className="text-gray-400">None</span>
        )
      },
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: SalaryStructure) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: SalaryStructure) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDelete(row.id)}
            loading={deleteMut.isPending}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{structures?.length ?? 0} structures</p>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Structure
        </Button>
      </div>
      <Card padding={false}>
        <Table<SalaryStructure>
          columns={columns}
          data={structures ?? []}
          loading={isLoading}
          emptyText="No salary structures found"
          keyExtractor={(row) => row.id}
        />
      </Card>
      <StructureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />
    </div>
  )
}

// ─── Payslips Tab ─────────────────────────────────────────────────────────────

function PayslipsTab() {
  const navigate = useNavigate()
  const approveMut = useApprovePayslip()
  const markPaidMut = useMarkPayslipPaid()

  const [statusFilter, setStatusFilter] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [generateOpen, setGenerateOpen] = useState(false)

  const { data: payslipsData, isLoading } = usePayslips({
    status: statusFilter || undefined,
    period_start: periodStart || undefined,
    period_end: periodEnd || undefined,
  })

  // Load employees for name lookup
  const { data: employeesData } = useEmployees({ limit: 1000 })
  const employeeMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    if (employeesData?.items) {
      for (const emp of employeesData.items) {
        map[emp.id] = `${emp.first_name} ${emp.last_name}`
      }
    }
    return map
  }, [employeesData])

  async function handleApprove(id: string) {
    try {
      await approveMut.mutateAsync(id)
      toast('success', 'Payslip approved')
    } catch {
      toast('error', 'Failed to approve payslip')
    }
  }

  async function handleMarkPaid(id: string) {
    try {
      await markPaidMut.mutateAsync(id)
      toast('success', 'Payslip marked as paid')
    } catch {
      toast('error', 'Failed to update payslip')
    }
  }

  const columns = [
    {
      key: 'employee_id',
      label: 'Employee',
      render: (row: Payslip) => (
        <span className="font-medium text-gray-900">
          {employeeMap[row.employee_id] ?? row.employee_id}
        </span>
      ),
    },
    {
      key: 'period',
      label: 'Period',
      render: (row: Payslip) => (
        <span className="text-sm text-gray-600">
          {formatDate(row.period_start)} – {formatDate(row.period_end)}
        </span>
      ),
    },
    {
      key: 'gross_pay',
      label: 'Gross Pay',
      render: (row: Payslip) => <span className="font-medium">{formatCurrency(row.gross_pay)}</span>,
    },
    {
      key: 'deductions_total',
      label: 'Deductions',
      render: (row: Payslip) => (
        <span className="text-red-600">{formatCurrency(row.deductions_total)}</span>
      ),
    },
    {
      key: 'net_pay',
      label: 'Net Pay',
      render: (row: Payslip) => (
        <span className="font-semibold text-green-700">{formatCurrency(row.net_pay)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Payslip) => (
        <Badge variant={PAYSLIP_BADGE[row.status] ?? 'default'}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Payslip) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/hr/payslips/${row.id}`)}
          >
            View
          </Button>
          {row.status === 'draft' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleApprove(row.id)}
              loading={approveMut.isPending}
            >
              Approve
            </Button>
          )}
          {row.status === 'approved' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleMarkPaid(row.id)}
              loading={markPaidMut.isPending}
            >
              Mark Paid
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-44">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Input
            label="Period Start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Input
            label="Period End"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
        <div className="ml-auto flex items-end">
          <Button onClick={() => setGenerateOpen(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Generate Payslips
          </Button>
        </div>
      </div>

      <Card padding={false}>
        <Table<Payslip>
          columns={columns}
          data={payslipsData?.items ?? []}
          loading={isLoading}
          emptyText="No payslips found"
          keyExtractor={(row) => row.id}
        />
      </Card>

      <GeneratePayslipsModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
      />
    </div>
  )
}

// ─── PayrollPage ──────────────────────────────────────────────────────────────

type Tab = 'structures' | 'payslips'

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<Tab>('structures')

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        <p className="text-sm text-gray-500 mt-1">Manage salary structures and payslips</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(
          [
            { key: 'structures', label: 'Salary Structures' },
            { key: 'payslips', label: 'Payslips' },
          ] as { key: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'structures' ? <SalaryStructuresTab /> : <PayslipsTab />}
    </div>
  )
}
