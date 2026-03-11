import { useState } from 'react'
import {
  useWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useActivateWorkflow,
  usePauseWorkflow,
  type Workflow,
  type WorkflowCreatePayload,
} from '@/api/crm_workflows'
import { Button, Badge, Card, Modal, Input, Select, Table, toast } from '@/components/ui'

const TRIGGER_TYPES = [
  { value: 'event', label: 'Event' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'manual', label: 'Manual' },
  { value: 'webhook', label: 'Webhook' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
]

const TRIGGER_FILTER_OPTIONS = [
  { value: '', label: 'All Triggers' },
  ...TRIGGER_TYPES,
]

const EMPTY_FORM: WorkflowCreatePayload = {
  name: '',
  description: '',
  trigger_type: 'event',
  trigger_config: null,
}

export default function WorkflowListPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [triggerFilter, setTriggerFilter] = useState<string | undefined>(undefined)
  const { data, isLoading } = useWorkflows({ status: statusFilter, trigger_type: triggerFilter })
  const createWorkflow = useCreateWorkflow()
  const updateWorkflow = useUpdateWorkflow()
  const deleteWorkflow = useDeleteWorkflow()
  const activateWorkflow = useActivateWorkflow()
  const pauseWorkflow = usePauseWorkflow()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [form, setForm] = useState<WorkflowCreatePayload>(EMPTY_FORM)
  const [triggerConfigStr, setTriggerConfigStr] = useState('{}')

  const workflows: Workflow[] = data?.items ?? data ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setTriggerConfigStr('{}')
    setModalOpen(true)
  }

  const openEdit = (wf: Workflow) => {
    setEditing(wf)
    setForm({
      name: wf.name,
      description: wf.description,
      trigger_type: wf.trigger_type,
      trigger_config: wf.trigger_config,
    })
    setTriggerConfigStr(wf.trigger_config ? JSON.stringify(wf.trigger_config, null, 2) : '{}')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let triggerConfig: Record<string, any> | null = null
    try {
      triggerConfig = JSON.parse(triggerConfigStr)
    } catch {
      toast('error', 'Invalid JSON in trigger config')
      return
    }
    const payload = { ...form, trigger_config: triggerConfig }
    try {
      if (editing) {
        await updateWorkflow.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Workflow updated')
      } else {
        await createWorkflow.mutateAsync(payload)
        toast('success', 'Workflow created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save workflow')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this workflow?')) return
    try {
      await deleteWorkflow.mutateAsync(id)
      toast('success', 'Workflow deleted')
    } catch {
      toast('error', 'Failed to delete workflow')
    }
  }

  const handleToggleStatus = async (wf: Workflow) => {
    try {
      if (wf.status === 'active') {
        await pauseWorkflow.mutateAsync(wf.id)
        toast('info', 'Workflow paused')
      } else {
        await activateWorkflow.mutateAsync(wf.id)
        toast('success', 'Workflow activated')
      }
    } catch {
      toast('error', 'Failed to update workflow status')
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="success">Active</Badge>
      case 'paused': return <Badge variant="warning">Paused</Badge>
      default: return <Badge variant="default">Draft</Badge>
    }
  }

  const triggerBadge = (type: string) => {
    switch (type) {
      case 'event': return <Badge variant="primary">Event</Badge>
      case 'schedule': return <Badge variant="info">Schedule</Badge>
      case 'manual': return <Badge variant="default">Manual</Badge>
      case 'webhook': return <Badge variant="warning">Webhook</Badge>
      default: return <Badge variant="default">{type}</Badge>
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Automation Workflows
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create and manage automated CRM workflows
          </p>
        </div>
        <Button onClick={openCreate}>+ New Workflow</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          label="Status"
          value={statusFilter ?? ''}
          onChange={(e) => setStatusFilter(e.target.value || undefined)}
          options={STATUS_OPTIONS}
        />
        <Select
          label="Trigger Type"
          value={triggerFilter ?? ''}
          onChange={(e) => setTriggerFilter(e.target.value || undefined)}
          options={TRIGGER_FILTER_OPTIONS}
        />
      </div>

      {/* Workflows Table */}
      <Card padding={false}>
        <Table<Workflow>
          loading={isLoading}
          data={workflows}
          keyExtractor={(w) => w.id}
          emptyText="No workflows found."
          columns={[
            {
              key: 'name',
              label: 'Name',
              render: (w) => (
                <span className="font-medium text-gray-900 dark:text-gray-100">{w.name}</span>
              ),
            },
            {
              key: 'trigger_type',
              label: 'Trigger',
              render: (w) => triggerBadge(w.trigger_type),
            },
            {
              key: 'status',
              label: 'Status',
              render: (w) => statusBadge(w.status),
            },
            {
              key: 'execution_count',
              label: 'Executions',
              render: (w) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">{w.execution_count}</span>
              ),
            },
            {
              key: 'last_executed_at',
              label: 'Last Executed',
              render: (w) => (
                <span className="text-sm text-gray-500">
                  {w.last_executed_at ? new Date(w.last_executed_at).toLocaleString() : 'Never'}
                </span>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (w) => (
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(w)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={w.status === 'active' ? 'outline' : 'primary'}
                    onClick={() => handleToggleStatus(w)}
                  >
                    {w.status === 'active' ? 'Pause' : 'Activate'}
                  </Button>
                  <a
                    href={`/crm/workflows/${w.id}/canvas`}
                    className="inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-colors px-3 py-1.5 text-xs"
                    style={{ backgroundColor: '#51459d', color: '#fff' }}
                  >
                    Open Canvas
                  </a>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(w.id)}>
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Workflow' : 'New Workflow'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. New Lead Follow-up"
          />
          <Input
            label="Description"
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional description"
          />
          <Select
            label="Trigger Type"
            required
            value={form.trigger_type}
            onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value }))}
            options={TRIGGER_TYPES}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Trigger Config (JSON)
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={5}
              value={triggerConfigStr}
              onChange={(e) => setTriggerConfigStr(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createWorkflow.isPending || updateWorkflow.isPending}>
              {editing ? 'Save Changes' : 'Create Workflow'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
