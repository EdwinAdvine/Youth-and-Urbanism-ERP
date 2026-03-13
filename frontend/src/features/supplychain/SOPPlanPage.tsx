import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useSOPPlans, useCreateSOPPlan,
  type SOPPlan, type CreateSOPPlanPayload,
} from '../../api/supplychain_planning'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  in_review: 'warning',
  approved: 'success',
  closed: 'info',
}

interface SOPFormState {
  title: string
  cycle_type: 'monthly' | 'quarterly' | 'annual'
  period_start: string
  period_end: string
  notes: string
}

const defaultForm: SOPFormState = {
  title: '',
  cycle_type: 'monthly',
  period_start: '',
  period_end: '',
  notes: '',
}

export default function SOPPlanPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<SOPFormState>(defaultForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useSOPPlans({
    status: filterStatus || undefined,
    skip,
    limit,
  })

  const createMutation = useCreateSOPPlan()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast('warning', 'Title is required')
      return
    }
    if (!form.period_start || !form.period_end) {
      toast('warning', 'Period start and end dates are required')
      return
    }
    const payload: CreateSOPPlanPayload = {
      title: form.title.trim(),
      cycle_type: form.cycle_type,
      period_start: form.period_start,
      period_end: form.period_end,
      notes: form.notes.trim() || undefined,
    }
    try {
      await createMutation.mutateAsync(payload)
      toast('success', 'S&OP plan created')
      setShowCreate(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to create S&OP plan')
    }
  }

  const filteredPlans = (data?.plans ?? []).filter(
    (p) => !search || p.title.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (row: SOPPlan) => (
        <button
          className="text-[#51459d] font-medium hover:underline"
          onClick={() => navigate(`/supply-chain/sop-plans/${row.id}`)}
        >
          {row.title}
        </button>
      ),
    },
    {
      key: 'cycle_type',
      label: 'Cycle',
      render: (row: SOPPlan) => (
        <span className="text-gray-600 dark:text-gray-400 capitalize">{row.cycle_type}</span>
      ),
    },
    {
      key: 'period_start',
      label: 'Period Start',
      render: (row: SOPPlan) => <span className="text-gray-600 dark:text-gray-400">{formatDate(row.period_start)}</span>,
    },
    {
      key: 'period_end',
      label: 'Period End',
      render: (row: SOPPlan) => <span className="text-gray-600 dark:text-gray-400">{formatDate(row.period_end)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: SOPPlan) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: SOPPlan) => <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row: SOPPlan) => (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/supply-chain/sop-plans/${row.id}`)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">S&OP Plans</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total plans</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New S&OP Plan
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-72">
          <Input
            placeholder="Search plans..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
          <option value="closed">Closed</option>
        </select>
        <span className="text-sm text-gray-500">{filteredPlans.length} plans</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<SOPPlan>
          columns={columns}
          data={filteredPlans}
          loading={isLoading}
          emptyText="No S&OP plans found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New S&OP Plan" size="lg">
        <div className="space-y-4">
          <Input
            label="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="S&OP cycle title"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cycle Type</label>
            <select
              value={form.cycle_type}
              onChange={(e) => setForm({ ...form, cycle_type: e.target.value as SOPFormState['cycle_type'] })}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Period Start *"
              type="date"
              value={form.period_start}
              onChange={(e) => setForm({ ...form, period_start: e.target.value })}
            />
            <Input
              label="Period End *"
              type="date"
              value={form.period_end}
              onChange={(e) => setForm({ ...form, period_end: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create Plan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
