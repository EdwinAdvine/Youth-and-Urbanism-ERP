import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useScenarios, useCreateScenario, useUpdateScenario,
  type ForecastScenario, type CreateScenarioPayload,
} from '../../api/supplychain_planning'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const STATUS_BADGE: Record<string, 'success' | 'info' | 'default'> = {
  draft: 'info',
  active: 'success',
  archived: 'default',
}

interface ScenarioFormState {
  name: string
  description: string
  assumptions: string
}

const defaultForm: ScenarioFormState = {
  name: '',
  description: '',
  assumptions: '{}',
}

export default function ForecastScenariosPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<ScenarioFormState>(defaultForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useScenarios({
    status: filterStatus || undefined,
    skip,
    limit,
  })

  const createMutation = useCreateScenario()
  const updateMutation = useUpdateScenario()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast('warning', 'Scenario name is required')
      return
    }
    let assumptions: Record<string, unknown> | undefined
    try {
      const parsed = JSON.parse(form.assumptions)
      assumptions = typeof parsed === 'object' && parsed !== null ? parsed : undefined
    } catch {
      toast('warning', 'Invalid JSON in assumptions')
      return
    }
    const payload: CreateScenarioPayload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      assumptions,
    }
    try {
      await createMutation.mutateAsync(payload)
      toast('success', 'Scenario created')
      setShowCreate(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to create scenario')
    }
  }

  const handleArchive = async (scenario: ForecastScenario) => {
    try {
      await updateMutation.mutateAsync({ id: scenario.id, status: 'archived' })
      toast('success', 'Scenario archived')
    } catch {
      toast('error', 'Failed to archive scenario')
    }
  }

  const handleActivate = async (scenario: ForecastScenario) => {
    try {
      await updateMutation.mutateAsync({ id: scenario.id, status: 'active' })
      toast('success', 'Scenario activated')
    } catch {
      toast('error', 'Failed to activate scenario')
    }
  }

  const filteredScenarios = (data?.scenarios ?? []).filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: ForecastScenario) => (
        <span className="font-medium text-[#51459d]">{row.name}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: ForecastScenario) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: ForecastScenario) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm truncate max-w-xs block">
          {row.description || '-'}
        </span>
      ),
    },
    {
      key: 'assumptions',
      label: 'Assumptions',
      render: (row: ForecastScenario) => (
        <span className="text-gray-500 text-xs font-mono truncate max-w-[200px] block">
          {row.assumptions ? JSON.stringify(row.assumptions).slice(0, 60) : '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: ForecastScenario) => <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row: ForecastScenario) => (
        <div className="flex items-center gap-1">
          {row.status === 'draft' && (
            <Button size="sm" variant="ghost" onClick={() => handleActivate(row)}>
              Activate
            </Button>
          )}
          {row.status !== 'archived' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleArchive(row)}
              className="text-gray-500 hover:text-gray-700"
            >
              Archive
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Forecast Scenarios</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total scenarios</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Scenario
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-72">
          <Input
            placeholder="Search scenarios..."
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
          <option value="archived">Archived</option>
        </select>
        <span className="text-sm text-gray-500">{filteredScenarios.length} scenarios</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<ForecastScenario>
          columns={columns}
          data={filteredScenarios}
          loading={isLoading}
          emptyText="No scenarios found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Forecast Scenario" size="lg">
        <div className="space-y-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Scenario name"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assumptions (JSON)</label>
            <textarea
              value={form.assumptions}
              onChange={(e) => setForm({ ...form, assumptions: e.target.value })}
              rows={6}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder='{"growth_rate": 0.05, "seasonality": true}'
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create Scenario
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
