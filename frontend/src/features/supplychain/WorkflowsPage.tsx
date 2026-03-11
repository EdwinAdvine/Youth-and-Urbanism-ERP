import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  cn, Button, Badge, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useWorkflowTemplates, useCreateWorkflowTemplate, useUpdateWorkflowTemplate,
  useWorkflowRuns, useTriggerWorkflow,
  type WorkflowTemplateItem, type WorkflowRunItem,
} from '../../api/supplychain_ops'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const RUN_STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default'> = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'warning',
}

type TabId = 'templates' | 'runs'

interface TemplateFormState {
  name: string
  description: string
  trigger_event: string
  steps_json: string
}

const defaultForm: TemplateFormState = {
  name: '',
  description: '',
  trigger_event: '',
  steps_json: '{"steps": []}',
}

export default function WorkflowsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('templates')
  const [templatePage, setTemplatePage] = useState(1)
  const [runPage, setRunPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<TemplateFormState>(defaultForm)

  const templateLimit = 20
  const runLimit = 20

  const { data: templatesData, isLoading: templatesLoading } = useWorkflowTemplates({
    skip: (templatePage - 1) * templateLimit,
    limit: templateLimit,
  })

  const { data: runsData, isLoading: runsLoading } = useWorkflowRuns({
    skip: (runPage - 1) * runLimit,
    limit: runLimit,
  })

  const createMutation = useCreateWorkflowTemplate()
  const updateMutation = useUpdateWorkflowTemplate()
  const triggerMutation = useTriggerWorkflow()

  const templatePages = templatesData ? Math.ceil(templatesData.total / templateLimit) : 1
  const runPages = runsData ? Math.ceil(runsData.total / runLimit) : 1

  const handleCreate = async () => {
    if (!form.name.trim() || !form.trigger_event.trim()) {
      toast('warning', 'Name and trigger event are required')
      return
    }
    let parsedSteps: Record<string, unknown> | undefined
    try {
      parsedSteps = JSON.parse(form.steps_json)
    } catch {
      toast('error', 'Invalid JSON in steps')
      return
    }
    try {
      await createMutation.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        trigger_event: form.trigger_event.trim(),
        steps: parsedSteps,
      })
      toast('success', 'Template created')
      setShowCreate(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to create template')
    }
  }

  const handleToggleActive = async (tpl: WorkflowTemplateItem) => {
    try {
      await updateMutation.mutateAsync({
        id: tpl.id,
        is_active: !tpl.is_active,
      })
      toast('success', `Template ${tpl.is_active ? 'deactivated' : 'activated'}`)
    } catch {
      toast('error', 'Failed to toggle template')
    }
  }

  const handleTrigger = async (tpl: WorkflowTemplateItem) => {
    if (!tpl.is_active) {
      toast('warning', 'Cannot trigger an inactive template')
      return
    }
    try {
      await triggerMutation.mutateAsync(tpl.id)
      toast('success', 'Workflow triggered')
      setActiveTab('runs')
    } catch {
      toast('error', 'Failed to trigger workflow')
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'templates', label: `Templates (${templatesData?.total ?? 0})` },
    { id: 'runs', label: `Runs (${runsData?.total ?? 0})` },
  ]

  const templateColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: WorkflowTemplateItem) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{row.name}</span>
      ),
    },
    {
      key: 'trigger_event',
      label: 'Trigger Event',
      render: (row: WorkflowTemplateItem) => (
        <span className="text-[#51459d] text-sm font-mono">{row.trigger_event}</span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: WorkflowTemplateItem) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">{row.description || '-'}</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Active',
      render: (row: WorkflowTemplateItem) => (
        <button
          onClick={() => handleToggleActive(row)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${row.is_active ? 'bg-[#6fd943]' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${row.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: WorkflowTemplateItem) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: WorkflowTemplateItem) => (
        <Button size="sm" variant="ghost" onClick={() => handleTrigger(row)} loading={triggerMutation.isPending}>
          Trigger
        </Button>
      ),
    },
  ]

  const runColumns = [
    {
      key: 'template_id',
      label: 'Template',
      render: (row: WorkflowRunItem) => {
        const tpl = templatesData?.templates?.find((t) => t.id === row.template_id)
        return (
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {tpl?.name || row.template_id.slice(0, 8) + '...'}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: WorkflowRunItem) => (
        <Badge variant={RUN_STATUS_BADGE[row.status] ?? 'default'}>{row.status}</Badge>
      ),
    },
    {
      key: 'started_at',
      label: 'Started',
      render: (row: WorkflowRunItem) => (
        <span className="text-gray-500 text-xs">{formatDateTime(row.started_at)}</span>
      ),
    },
    {
      key: 'completed_at',
      label: 'Completed',
      render: (row: WorkflowRunItem) => (
        <span className="text-gray-500 text-xs">{row.completed_at ? formatDateTime(row.completed_at) : '-'}</span>
      ),
    },
    {
      key: 'error_message',
      label: 'Error',
      render: (row: WorkflowRunItem) => (
        row.error_message ? (
          <span className="text-[#ff3a6e] text-xs truncate max-w-[200px] block">{row.error_message}</span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: WorkflowRunItem) => (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/supply-chain/workflows/runs/${row.id}`)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workflows</h1>
          <p className="text-sm text-gray-500 mt-1">Automation templates and execution runs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Template
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'text-[#51459d] border-[#51459d]'
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <Card padding={false}>
          <Table<WorkflowTemplateItem>
            columns={templateColumns}
            data={templatesData?.templates ?? []}
            loading={templatesLoading}
            emptyText="No workflow templates found"
            keyExtractor={(row) => row.id}
          />
          {templatePages > 1 && (
            <Pagination page={templatePage} pages={templatePages} total={templatesData?.total ?? 0} onChange={setTemplatePage} />
          )}
        </Card>
      )}

      {/* Runs Tab */}
      {activeTab === 'runs' && (
        <Card padding={false}>
          <Table<WorkflowRunItem>
            columns={runColumns}
            data={runsData?.runs ?? []}
            loading={runsLoading}
            emptyText="No workflow runs found"
            keyExtractor={(row) => row.id}
          />
          {runPages > 1 && (
            <Pagination page={runPage} pages={runPages} total={runsData?.total ?? 0} onChange={setRunPage} />
          )}
        </Card>
      )}

      {/* Create Template Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Workflow Template" size="lg">
        <div className="space-y-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Workflow template name"
          />
          <Input
            label="Trigger Event *"
            value={form.trigger_event}
            onChange={(e) => setForm({ ...form, trigger_event: e.target.value })}
            placeholder="e.g. supplychain.po.approved, inventory.low_stock"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What does this workflow do?"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Steps (JSON)</label>
            <textarea
              value={form.steps_json}
              onChange={(e) => setForm({ ...form, steps_json: e.target.value })}
              rows={8}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder='{"steps": [{"action": "send_email", "params": {...}}]}'
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create Template
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
