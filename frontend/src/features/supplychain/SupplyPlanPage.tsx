import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useSupplyPlans, useGenerateSupplyPlan,
  type SupplyPlan, type GenerateSupplyPlanPayload,
} from '../../api/supplychain_planning'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  active: 'success',
  executed: 'primary',
  archived: 'info',
}

interface GenerateFormState {
  sop_id: string
  scenario_id: string
  horizon_days: string
}

const defaultForm: GenerateFormState = {
  sop_id: '',
  scenario_id: '',
  horizon_days: '90',
}

export default function SupplyPlanPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showGenerate, setShowGenerate] = useState(false)
  const [form, setForm] = useState<GenerateFormState>(defaultForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useSupplyPlans({
    status: filterStatus || undefined,
    skip,
    limit,
  })

  const generateMutation = useGenerateSupplyPlan()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const handleGenerate = async () => {
    const payload: GenerateSupplyPlanPayload = {
      sop_id: form.sop_id.trim() || undefined,
      scenario_id: form.scenario_id.trim() || undefined,
      horizon_days: Number(form.horizon_days) || 90,
    }
    try {
      await generateMutation.mutateAsync(payload)
      toast('success', 'Supply plan generated')
      setShowGenerate(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to generate supply plan')
    }
  }

  const filteredPlans = (data?.plans ?? []).filter(
    (p) => !search || p.status.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    {
      key: 'status',
      label: 'Status',
      render: (row: SupplyPlan) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'generated_at',
      label: 'Generated',
      render: (row: SupplyPlan) => (
        <button
          className="text-[#51459d] font-medium hover:underline"
          onClick={() => navigate(`/supply-chain/supply-plans/${row.id}`)}
        >
          {formatDate(row.generated_at)}
        </button>
      ),
    },
    {
      key: 'plan_horizon_days',
      label: 'Horizon',
      render: (row: SupplyPlan) => (
        <span className="text-gray-600 dark:text-gray-400">{row.plan_horizon_days} days</span>
      ),
    },
    {
      key: 'line_count',
      label: 'Lines',
      render: (row: SupplyPlan) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{row.line_count}</span>
      ),
    },
    {
      key: 'sop_id',
      label: 'S&OP Plan',
      render: (row: SupplyPlan) => (
        <span className="text-gray-600 dark:text-gray-400 text-xs">
          {row.sop_id ? row.sop_id.slice(0, 8) + '...' : '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: SupplyPlan) => <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row: SupplyPlan) => (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/supply-chain/supply-plans/${row.id}`)}>
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Supply Plans</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total plans</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={() => setShowGenerate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate Plan
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="w-full sm:w-72">
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
          <option value="active">Active</option>
          <option value="executed">Executed</option>
          <option value="archived">Archived</option>
        </select>
        <span className="text-sm text-gray-500">{filteredPlans.length} plans</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<SupplyPlan>
          columns={columns}
          data={filteredPlans}
          loading={isLoading}
          emptyText="No supply plans found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Generate Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Supply Plan" size="lg">
        <div className="space-y-4">
          <Input
            label="S&OP Plan ID (optional)"
            value={form.sop_id}
            onChange={(e) => setForm({ ...form, sop_id: e.target.value })}
            placeholder="Link to an S&OP plan"
          />
          <Input
            label="Scenario ID (optional)"
            value={form.scenario_id}
            onChange={(e) => setForm({ ...form, scenario_id: e.target.value })}
            placeholder="Forecast scenario to use"
          />
          <Input
            label="Horizon (days)"
            type="number"
            min="1"
            value={form.horizon_days}
            onChange={(e) => setForm({ ...form, horizon_days: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleGenerate} loading={generateMutation.isPending}>
              Generate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
