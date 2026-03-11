import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useMeritBudgetPools,
  useCreateMeritBudgetPool,
  useUpdateMeritBudgetPool,
  useMeritIncreases,
  useCreateMeritIncrease,
  useApproveMeritIncrease,
  useRejectMeritIncrease,
  useApplyMeritIncrease,
  type MeritBudgetPool,
  type MeritBudgetPoolCreatePayload,
  type MeritIncrease,
  type MeritIncreaseCreatePayload,
} from '../../api/hr_phase1'
import { useEmployees } from '../../api/hr'

const poolStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  draft: 'default',
  active: 'success',
  closed: 'warning',
  exhausted: 'info',
}

const increaseStatusVariant: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  proposed: 'warning',
  approved: 'info',
  applied: 'success',
  rejected: 'danger',
  pending: 'default',
}

const defaultPoolForm: MeritBudgetPoolCreatePayload = {
  name: '',
  department_id: '',
  fiscal_year: new Date().getFullYear(),
  total_budget: 0,
  currency: 'USD',
}

const defaultIncreaseForm: MeritIncreaseCreatePayload = {
  employee_id: '',
  current_salary: 0,
  proposed_salary: 0,
  increase_type: 'merit',
  effective_date: new Date().toISOString().split('T')[0],
  budget_pool_id: '',
  notes: '',
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function MeritPlanningPage() {
  const [activeTab, setActiveTab] = useState<'pools' | 'increases'>('pools')

  // Pool state
  const { data: poolsData, isLoading: poolsLoading } = useMeritBudgetPools()
  const createPool = useCreateMeritBudgetPool()
  const updatePool = useUpdateMeritBudgetPool()
  const [showPoolModal, setShowPoolModal] = useState(false)
  const [editingPool, setEditingPool] = useState<MeritBudgetPool | null>(null)
  const [poolForm, setPoolForm] = useState<MeritBudgetPoolCreatePayload>(defaultPoolForm)

  // Increase state
  const [increaseStatusFilter, setIncreaseStatusFilter] = useState('')
  const { data: increasesData, isLoading: increasesLoading } = useMeritIncreases({
    status: increaseStatusFilter || undefined,
  })
  const createIncrease = useCreateMeritIncrease()
  const approveIncrease = useApproveMeritIncrease()
  const rejectIncrease = useRejectMeritIncrease()
  const applyIncrease = useApplyMeritIncrease()
  const [showIncreaseModal, setShowIncreaseModal] = useState(false)
  const [increaseForm, setIncreaseForm] = useState<MeritIncreaseCreatePayload>(defaultIncreaseForm)

  const { data: empData } = useEmployees({ limit: 500 })
  const employees = empData?.items ?? []

  // ─── Pool handlers ────────────────────────────────────────────────────────────
  function openCreatePool() {
    setEditingPool(null)
    setPoolForm(defaultPoolForm)
    setShowPoolModal(true)
  }

  function openEditPool(pool: MeritBudgetPool) {
    setEditingPool(pool)
    setPoolForm({
      name: pool.name,
      department_id: pool.department_id ?? '',
      fiscal_year: pool.fiscal_year,
      total_budget: pool.total_budget,
      currency: pool.currency,
    })
    setShowPoolModal(true)
  }

  function handlePoolSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: MeritBudgetPoolCreatePayload = {
      ...poolForm,
      department_id: poolForm.department_id || undefined,
    }
    if (editingPool) {
      updatePool.mutate(
        { poolId: editingPool.id, data: payload },
        {
          onSuccess: () => { toast('success', 'Budget pool updated'); setShowPoolModal(false) },
          onError: () => toast('error', 'Failed to update budget pool'),
        }
      )
    } else {
      createPool.mutate(payload, {
        onSuccess: () => { toast('success', 'Budget pool created'); setShowPoolModal(false) },
        onError: () => toast('error', 'Failed to create budget pool'),
      })
    }
  }

  // ─── Increase handlers ────────────────────────────────────────────────────────
  function openCreateIncrease() {
    setIncreaseForm(defaultIncreaseForm)
    setShowIncreaseModal(true)
  }

  function handleIncreaseSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (increaseForm.proposed_salary <= increaseForm.current_salary) {
      toast('warning', 'Proposed salary should be greater than current salary')
    }
    const payload: MeritIncreaseCreatePayload = {
      ...increaseForm,
      budget_pool_id: increaseForm.budget_pool_id || undefined,
      notes: increaseForm.notes || undefined,
      review_id: undefined,
    }
    createIncrease.mutate(payload, {
      onSuccess: () => { toast('success', 'Merit increase created'); setShowIncreaseModal(false) },
      onError: () => toast('error', 'Failed to create merit increase'),
    })
  }

  function handleApprove(id: string) {
    approveIncrease.mutate(id, {
      onSuccess: () => toast('success', 'Merit increase approved'),
      onError: () => toast('error', 'Failed to approve'),
    })
  }

  function handleReject(id: string) {
    rejectIncrease.mutate(id, {
      onSuccess: () => toast('success', 'Merit increase rejected'),
      onError: () => toast('error', 'Failed to reject'),
    })
  }

  function handleApply(id: string) {
    applyIncrease.mutate(id, {
      onSuccess: () => toast('success', 'Merit increase applied to employee salary'),
      onError: () => toast('error', 'Failed to apply merit increase'),
    })
  }

  function getEmployeeName(id: string) {
    const emp = employees.find((e: { id: string; first_name: string; last_name: string }) => e.id === id)
    return emp ? `${emp.first_name} ${emp.last_name}` : id
  }

  // ─── Pool columns ─────────────────────────────────────────────────────────────
  const poolColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (r: MeritBudgetPool) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{r.name}</span>
      ),
    },
    {
      key: 'department_id',
      label: 'Department',
      render: (r: MeritBudgetPool) => r.department_id ?? 'All',
    },
    {
      key: 'fiscal_year',
      label: 'Fiscal Year',
      render: (r: MeritBudgetPool) => r.fiscal_year,
    },
    {
      key: 'total_budget',
      label: 'Budget',
      render: (r: MeritBudgetPool) => formatCurrency(r.total_budget, r.currency),
    },
    {
      key: 'allocated_amount',
      label: 'Allocated',
      render: (r: MeritBudgetPool) => formatCurrency(r.allocated_amount, r.currency),
    },
    {
      key: 'remaining',
      label: 'Remaining',
      render: (r: MeritBudgetPool) => {
        const remaining = r.total_budget - r.allocated_amount
        return (
          <span className={remaining <= 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
            {formatCurrency(remaining, r.currency)}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: MeritBudgetPool) => (
        <Badge variant={poolStatusVariant[r.status] ?? 'default'}>{r.status}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (r: MeritBudgetPool) => (
        <Button variant="ghost" size="sm" onClick={() => openEditPool(r)}>Edit</Button>
      ),
    },
  ]

  // ─── Increase columns ─────────────────────────────────────────────────────────
  const increaseColumns = [
    {
      key: 'employee_id',
      label: 'Employee',
      render: (r: MeritIncrease) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{getEmployeeName(r.employee_id)}</span>
      ),
    },
    {
      key: 'current_salary',
      label: 'Current Salary',
      render: (r: MeritIncrease) => formatCurrency(r.current_salary),
    },
    {
      key: 'proposed_salary',
      label: 'Proposed',
      render: (r: MeritIncrease) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(r.proposed_salary)}</span>
      ),
    },
    {
      key: 'increase_percentage',
      label: 'Increase %',
      render: (r: MeritIncrease) => (
        <Badge variant={r.increase_percentage >= 10 ? 'warning' : r.increase_percentage >= 5 ? 'info' : 'default'}>
          {r.increase_percentage.toFixed(1)}%
        </Badge>
      ),
    },
    {
      key: 'increase_type',
      label: 'Type',
      render: (r: MeritIncrease) => r.increase_type,
    },
    {
      key: 'effective_date',
      label: 'Effective Date',
      render: (r: MeritIncrease) => new Date(r.effective_date).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: MeritIncrease) => (
        <Badge variant={increaseStatusVariant[r.status] ?? 'default'}>{r.status}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (r: MeritIncrease) => (
        <div className="flex gap-1 justify-end">
          {r.status === 'proposed' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => handleApprove(r.id)}>
                <span className="text-green-600">Approve</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleReject(r.id)}>
                <span className="text-red-500">Reject</span>
              </Button>
            </>
          )}
          {r.status === 'approved' && (
            <Button variant="ghost" size="sm" onClick={() => handleApply(r.id)}>
              <span className="text-blue-600">Apply</span>
            </Button>
          )}
        </div>
      ),
    },
  ]

  const isLoading = activeTab === 'pools' ? poolsLoading : increasesLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Merit Planning</h1>
          <p className="text-sm text-gray-500 mt-1">Manage merit budget pools and salary increases</p>
        </div>
        <Button onClick={activeTab === 'pools' ? openCreatePool : openCreateIncrease}>
          {activeTab === 'pools' ? 'Add Budget Pool' : 'Add Merit Increase'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-[10px] p-1 w-fit">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'pools'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('pools')}
        >
          Budget Pools
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'increases'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('increases')}
        >
          Merit Increases
        </button>
      </div>

      {/* Filters for increases tab */}
      {activeTab === 'increases' && (
        <div className="flex gap-3">
          <Select
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'proposed', label: 'Proposed' },
              { value: 'approved', label: 'Approved' },
              { value: 'applied', label: 'Applied' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            value={increaseStatusFilter}
            onChange={(e) => setIncreaseStatusFilter(e.target.value)}
            className="w-48"
          />
        </div>
      )}

      {/* Table */}
      <Card padding={false}>
        {activeTab === 'pools' ? (
          <Table
            columns={poolColumns}
            data={(poolsData as MeritBudgetPool[]) ?? []}
            keyExtractor={(r) => r.id}
            emptyText="No budget pools found."
          />
        ) : (
          <Table
            columns={increaseColumns}
            data={((increasesData as { items?: MeritIncrease[] })?.items ?? (increasesData as MeritIncrease[])) ?? []}
            keyExtractor={(r) => r.id}
            emptyText="No merit increases found."
          />
        )}
      </Card>

      {/* Budget Pool Modal */}
      <Modal open={showPoolModal} onClose={() => setShowPoolModal(false)} title={editingPool ? 'Edit Budget Pool' : 'Create Budget Pool'} size="lg">
        <form onSubmit={handlePoolSubmit} className="space-y-4">
          <Input
            label="Pool Name"
            required
            placeholder="e.g., Q1 2026 Engineering Merit"
            value={poolForm.name}
            onChange={(e) => setPoolForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="Department ID (optional)"
            placeholder="Leave blank for all departments"
            value={poolForm.department_id ?? ''}
            onChange={(e) => setPoolForm((p) => ({ ...p, department_id: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Fiscal Year"
              required
              type="number"
              value={poolForm.fiscal_year}
              onChange={(e) => setPoolForm((p) => ({ ...p, fiscal_year: Number(e.target.value) }))}
            />
            <Input
              label="Total Budget"
              required
              type="number"
              min={0}
              value={poolForm.total_budget}
              onChange={(e) => setPoolForm((p) => ({ ...p, total_budget: Number(e.target.value) }))}
            />
            <Input
              label="Currency"
              placeholder="USD"
              value={poolForm.currency ?? 'USD'}
              onChange={(e) => setPoolForm((p) => ({ ...p, currency: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowPoolModal(false)}>Cancel</Button>
            <Button type="submit" loading={createPool.isPending || updatePool.isPending}>
              {editingPool ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Merit Increase Modal */}
      <Modal open={showIncreaseModal} onClose={() => setShowIncreaseModal(false)} title="Create Merit Increase" size="lg">
        <form onSubmit={handleIncreaseSubmit} className="space-y-4">
          <Select
            label="Employee"
            required
            options={[
              { value: '', label: 'Select employee...' },
              ...employees.map((e: { id: string; first_name: string; last_name: string }) => ({
                value: e.id,
                label: `${e.first_name} ${e.last_name}`,
              })),
            ]}
            value={increaseForm.employee_id}
            onChange={(e) => setIncreaseForm((p) => ({ ...p, employee_id: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Current Salary"
              required
              type="number"
              min={0}
              value={increaseForm.current_salary}
              onChange={(e) => setIncreaseForm((p) => ({ ...p, current_salary: Number(e.target.value) }))}
            />
            <Input
              label="Proposed Salary"
              required
              type="number"
              min={0}
              value={increaseForm.proposed_salary}
              onChange={(e) => setIncreaseForm((p) => ({ ...p, proposed_salary: Number(e.target.value) }))}
            />
          </div>
          {increaseForm.current_salary > 0 && increaseForm.proposed_salary > 0 && (
            <p className="text-sm text-gray-500">
              Increase: {((increaseForm.proposed_salary - increaseForm.current_salary) / increaseForm.current_salary * 100).toFixed(1)}%
            </p>
          )}
          <Select
            label="Increase Type"
            options={[
              { value: 'merit', label: 'Merit' },
              { value: 'promotion', label: 'Promotion' },
              { value: 'market_adjustment', label: 'Market Adjustment' },
              { value: 'equity', label: 'Equity' },
            ]}
            value={increaseForm.increase_type}
            onChange={(e) => setIncreaseForm((p) => ({ ...p, increase_type: e.target.value }))}
          />
          <Input
            label="Effective Date"
            required
            type="date"
            value={increaseForm.effective_date}
            onChange={(e) => setIncreaseForm((p) => ({ ...p, effective_date: e.target.value }))}
          />
          <Input
            label="Budget Pool ID (optional)"
            placeholder="Link to a budget pool"
            value={increaseForm.budget_pool_id ?? ''}
            onChange={(e) => setIncreaseForm((p) => ({ ...p, budget_pool_id: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              placeholder="Justification or notes..."
              value={increaseForm.notes ?? ''}
              onChange={(e) => setIncreaseForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowIncreaseModal(false)}>Cancel</Button>
            <Button type="submit" loading={createIncrease.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
