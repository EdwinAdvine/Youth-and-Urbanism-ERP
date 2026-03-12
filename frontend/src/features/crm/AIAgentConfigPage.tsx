import { useState } from 'react'
import {
  useAIAgents,
  useCreateAIAgent,
  useUpdateAIAgent,
  useDeleteAIAgent,
  useRunAIAgent,
  type AIAgentConfig,
} from '@/api/crm_ai_agents'
import { Button, Badge, Card, Spinner, Modal, Input, Select, Table, toast } from '@/components/ui'

const AGENT_TYPES = [
  { value: 'lead_qualifier', label: 'Lead Qualifier' },
  { value: 'meeting_scheduler', label: 'Meeting Scheduler' },
  { value: 'ticket_resolver', label: 'Ticket Resolver' },
  { value: 'report_generator', label: 'Report Generator' },
  { value: 'data_enricher', label: 'Data Enricher' },
]

const AGENT_TYPE_COLORS: Record<string, string> = {
  lead_qualifier: 'info',
  meeting_scheduler: 'warning',
  ticket_resolver: 'danger',
  report_generator: 'success',
  data_enricher: 'default',
}

interface FormState {
  name: string
  agent_type: string
  description: string
  config: string
  schedule: string
  approval_required: boolean
  max_actions_per_run: number
}

const emptyForm: FormState = {
  name: '',
  agent_type: 'lead_qualifier',
  description: '',
  config: '{}',
  schedule: '{}',
  approval_required: false,
  max_actions_per_run: 10,
}

export default function AIAgentConfigPage() {
  const { data: agents, isLoading } = useAIAgents()
  const createAgent = useCreateAIAgent()
  const updateAgent = useUpdateAIAgent()
  const deleteAgent = useDeleteAIAgent()
  const runAgent = useRunAIAgent()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [runModalOpen, setRunModalOpen] = useState(false)
  const [runAgentId, setRunAgentId] = useState<string | null>(null)
  const [runInputData, setRunInputData] = useState('{}')

  const items: AIAgentConfig[] = agents?.items ?? agents ?? []

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(agent: AIAgentConfig) {
    setEditingId(agent.id)
    setForm({
      name: agent.name,
      agent_type: agent.agent_type,
      description: agent.description ?? '',
      config: agent.config ? JSON.stringify(agent.config, null, 2) : '{}',
      schedule: agent.schedule ? String(agent.schedule) : '{}',
      approval_required: agent.approval_required,
      max_actions_per_run: agent.max_actions_per_run,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    let parsedConfig: Record<string, unknown> | null = null
    let parsedSchedule: string | null = null
    try {
      parsedConfig = JSON.parse(form.config)
    } catch {
      toast('error', 'Invalid config JSON')
      return
    }
    try {
      parsedSchedule = form.schedule.trim() || null
    } catch {
      toast('error', 'Invalid schedule JSON')
      return
    }

    const payload = {
      name: form.name,
      agent_type: form.agent_type,
      description: form.description || null,
      config: parsedConfig,
      schedule: parsedSchedule,
      approval_required: form.approval_required,
      max_actions_per_run: form.max_actions_per_run,
    }

    try {
      if (editingId) {
        await updateAgent.mutateAsync({ id: editingId, ...payload })
        toast('success', 'Agent updated')
      } else {
        await createAgent.mutateAsync(payload)
        toast('success', 'Agent created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save agent')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this agent configuration?')) return
    try {
      await deleteAgent.mutateAsync(id)
      toast('success', 'Agent deleted')
    } catch {
      toast('error', 'Failed to delete agent')
    }
  }

  function openRunModal(agentId: string) {
    setRunAgentId(agentId)
    setRunInputData('{}')
    setRunModalOpen(true)
  }

  async function handleRun() {
    if (!runAgentId) return
    try {
      await runAgent.mutateAsync(runAgentId)
      toast('success', 'Agent run started')
      setRunModalOpen(false)
    } catch {
      toast('error', 'Failed to run agent')
    }
  }

  async function handleToggleActive(agent: AIAgentConfig) {
    try {
      await updateAgent.mutateAsync({ id: agent.id, is_active: !agent.is_active })
      toast('success', agent.is_active ? 'Agent deactivated' : 'Agent activated')
    } catch {
      toast('error', 'Failed to toggle agent status')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: AIAgentConfig) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{row.name}</span>
      ),
    },
    {
      key: 'agent_type',
      label: 'Type',
      render: (row: AIAgentConfig) => (
        <Badge variant={(AGENT_TYPE_COLORS[row.agent_type] ?? 'default') as 'primary' | 'danger' | 'default' | 'success' | 'warning' | 'info'}>
          {row.agent_type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: 'Active',
      render: (row: AIAgentConfig) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleActive(row)
          }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            row.is_active ? 'bg-[#6fd943]' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              row.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
    },
    {
      key: 'approval_required',
      label: 'Approval',
      render: (row: AIAgentConfig) => (
        <Badge variant={row.approval_required ? 'warning' : 'default'}>
          {row.approval_required ? 'Required' : 'Auto'}
        </Badge>
      ),
    },
    {
      key: 'max_actions_per_run',
      label: 'Max Actions',
      render: (row: AIAgentConfig) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{row.max_actions_per_run}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: AIAgentConfig) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              openRunModal(row.id)
            }}
          >
            Run
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              openEdit(row)
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-[#ff3a6e] hover:text-[#ff3a6e]"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              handleDelete(row.id)
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Agent Configurations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage CRM AI agents for automation and intelligence</p>
        </div>
        <Button onClick={openCreate}>+ New Agent</Button>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <Table
            columns={columns}
            data={items}
            loading={isLoading}
            emptyText="No AI agents configured yet"
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Agent' : 'Create Agent'}>
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My Lead Qualifier"
          />
          <Select
            label="Agent Type"
            value={form.agent_type}
            onChange={(e) => setForm((f) => ({ ...f, agent_type: e.target.value }))}
            options={AGENT_TYPES}
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe what this agent does..."
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Config (JSON)
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#51459d]"
              value={form.config}
              onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Schedule (JSON)
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#51459d]"
              value={form.schedule}
              onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="approval_required"
              checked={form.approval_required}
              onChange={(e) => setForm((f) => ({ ...f, approval_required: e.target.checked }))}
              className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
            />
            <label htmlFor="approval_required" className="text-sm text-gray-700 dark:text-gray-300">
              Approval Required
            </label>
          </div>
          <Input
            label="Max Actions Per Run"
            type="number"
            value={String(form.max_actions_per_run)}
            onChange={(e) => setForm((f) => ({ ...f, max_actions_per_run: parseInt(e.target.value) || 1 }))}
            min={1}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={createAgent.isPending || updateAgent.isPending}
            >
              {editingId ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Run Agent Modal */}
      <Modal open={runModalOpen} onClose={() => setRunModalOpen(false)} title="Run Agent">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Input Data (JSON, optional)
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#51459d]"
              value={runInputData}
              onChange={(e) => setRunInputData(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRunModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRun} loading={runAgent.isPending}>
              Run Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
