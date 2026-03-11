import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge, Pagination, toast } from '../../components/ui'
import {
  useBonuses,
  useCreateBonus,
  useApproveBonus,
  usePayBonus,
  type Bonus,
  type BonusCreatePayload,
} from '../../api/hr_phase1'
import { useEmployees } from '../../api/hr'

const bonusTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'performance', label: 'Performance' },
  { value: 'spot', label: 'Spot' },
  { value: 'signing', label: 'Signing' },
  { value: 'referral', label: 'Referral' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'retention', label: 'Retention' },
]

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'default'> = {
  proposed: 'warning',
  approved: 'info',
  paid: 'success',
  cancelled: 'danger',
}

const defaultForm: BonusCreatePayload = {
  employee_id: '',
  bonus_type: 'performance',
  amount: 0,
  currency: 'USD',
  reason: '',
  pay_period: '',
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function BonusManagementPage() {
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: bonusesData, isLoading } = useBonuses({
    employee_id: employeeFilter || undefined,
    bonus_type: typeFilter || undefined,
    status: statusFilter || undefined,
    page,
    limit,
  })

  const { data: empData } = useEmployees({ limit: 500 })
  const employees = empData?.items ?? []

  const createBonus = useCreateBonus()
  const approveBonus = useApproveBonus()
  const payBonus = usePayBonus()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<BonusCreatePayload>(defaultForm)

  // Handle both paginated and array responses
  const bonuses: Bonus[] = Array.isArray(bonusesData)
    ? bonusesData
    : (bonusesData as { items?: Bonus[] })?.items ?? []
  const total: number = Array.isArray(bonusesData)
    ? bonusesData.length
    : (bonusesData as { total?: number })?.total ?? 0
  const pages = Math.ceil(total / limit) || 1

  function openCreate() {
    setForm(defaultForm)
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.amount <= 0) {
      toast('error', 'Bonus amount must be greater than zero')
      return
    }
    const payload: BonusCreatePayload = {
      ...form,
      reason: form.reason || undefined,
      pay_period: form.pay_period || undefined,
    }
    createBonus.mutate(payload, {
      onSuccess: () => { toast('success', 'Bonus created'); setShowModal(false) },
      onError: () => toast('error', 'Failed to create bonus'),
    })
  }

  function handleApprove(id: string) {
    approveBonus.mutate(id, {
      onSuccess: () => toast('success', 'Bonus approved'),
      onError: () => toast('error', 'Failed to approve bonus'),
    })
  }

  function handlePay(id: string) {
    payBonus.mutate(id, {
      onSuccess: () => toast('success', 'Bonus marked as paid'),
      onError: () => toast('error', 'Failed to pay bonus'),
    })
  }

  function getEmployeeName(id: string) {
    const emp = employees.find((e: { id: string; first_name: string; last_name: string }) => e.id === id)
    return emp ? `${emp.first_name} ${emp.last_name}` : id
  }

  const columns = [
    {
      key: 'employee_id',
      label: 'Employee',
      render: (r: Bonus) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{getEmployeeName(r.employee_id)}</span>
      ),
    },
    {
      key: 'bonus_type',
      label: 'Type',
      render: (r: Bonus) => (
        <Badge variant="primary">{r.bonus_type}</Badge>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (r: Bonus) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {formatCurrency(r.amount, r.currency)}
        </span>
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (r: Bonus) => r.currency,
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (r: Bonus) => (
        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[200px] block">
          {r.reason ?? '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Bonus) => (
        <Badge variant={statusVariant[r.status] ?? 'default'}>{r.status}</Badge>
      ),
    },
    {
      key: 'paid_at',
      label: 'Paid At',
      render: (r: Bonus) => r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (r: Bonus) => (
        <div className="flex gap-1 justify-end">
          {r.status === 'proposed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleApprove(r.id)}
              loading={approveBonus.isPending}
            >
              <span className="text-green-600">Approve</span>
            </Button>
          )}
          {r.status === 'approved' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePay(r.id)}
              loading={payBonus.isPending}
            >
              <span className="text-blue-600">Pay</span>
            </Button>
          )}
        </div>
      ),
    },
  ]

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bonus Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage employee bonuses</p>
        </div>
        <Button onClick={openCreate}>Add Bonus</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select
          options={bonusTypeOptions}
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="w-48"
        />
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'proposed', label: 'Proposed' },
            { value: 'approved', label: 'Approved' },
            { value: 'paid', label: 'Paid' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="w-48"
        />
        <Input
          placeholder="Filter by employee ID..."
          value={employeeFilter}
          onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1) }}
          className="w-56"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={bonuses}
          keyExtractor={(r) => r.id}
          emptyText="No bonuses found."
        />
        <Pagination
          page={page}
          pages={pages}
          total={total}
          onChange={setPage}
        />
      </Card>

      {/* Create Bonus Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Bonus" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
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
            value={form.employee_id}
            onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
          />
          <Select
            label="Bonus Type"
            required
            options={[
              { value: 'performance', label: 'Performance' },
              { value: 'spot', label: 'Spot' },
              { value: 'signing', label: 'Signing' },
              { value: 'referral', label: 'Referral' },
              { value: 'holiday', label: 'Holiday' },
              { value: 'retention', label: 'Retention' },
            ]}
            value={form.bonus_type}
            onChange={(e) => setForm((p) => ({ ...p, bonus_type: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount"
              required
              type="number"
              min={0}
              step={0.01}
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: Number(e.target.value) }))}
            />
            <Input
              label="Currency"
              placeholder="USD"
              value={form.currency ?? 'USD'}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              placeholder="Reason for bonus..."
              value={form.reason ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            />
          </div>
          <Input
            label="Pay Period (optional)"
            placeholder="e.g., 2026-Q1"
            value={form.pay_period ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, pay_period: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createBonus.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
