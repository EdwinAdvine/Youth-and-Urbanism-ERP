import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useSequences,
  useCreateSequence,
  useDeleteSequence,
  useActivateSequence,
  usePauseSequence,
  type SalesSequence,
  type SequenceCreatePayload,
} from '@/api/crm_v2'
import { Button, Badge, Card, Modal, Input, Select, Table, toast } from '@/components/ui'

const TRIGGER_TYPES = ['manual', 'form_submit', 'lead_score', 'deal_stage', 'tag_added']

export default function SequencesPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const { data, isLoading } = useSequences(statusFilter, page)
  const createSequence = useCreateSequence()
  const deleteSequence = useDeleteSequence()
  const activateSequence = useActivateSequence()
  const pauseSequence = usePauseSequence()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<SequenceCreatePayload>({
    name: '',
    description: '',
    trigger_type: 'manual',
  })

  const sequences: SalesSequence[] = data?.items ?? data ?? []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await createSequence.mutateAsync(form)
      toast('success', 'Sequence created')
      setModalOpen(false)
      if (result?.id) {
        navigate(`/crm/sequences/${result.id}`)
      }
    } catch {
      toast('error', 'Failed to create sequence')
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await activateSequence.mutateAsync(id)
      toast('success', 'Sequence activated')
    } catch {
      toast('error', 'Failed to activate sequence')
    }
  }

  const handlePause = async (id: string) => {
    try {
      await pauseSequence.mutateAsync(id)
      toast('info', 'Sequence paused')
    } catch {
      toast('error', 'Failed to pause sequence')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this sequence?')) return
    try {
      await deleteSequence.mutateAsync(id)
      toast('success', 'Sequence deleted')
    } catch {
      toast('error', 'Failed to delete sequence')
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'paused': return 'warning'
      case 'draft': return 'default'
      default: return 'info'
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Sales Sequences
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Automate multi-step outreach to your contacts
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New Sequence</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select
          label="Status"
          value={statusFilter ?? ''}
          onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1) }}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
          ]}
        />
      </div>

      {/* Sequences Table */}
      <Card padding={false}>
        <Table<SalesSequence>
          loading={isLoading}
          data={sequences}
          keyExtractor={(s) => s.id}
          emptyText="No sequences yet. Create your first one."
          columns={[
            { key: 'name', label: 'Name', render: (s) => (
              <button
                className="font-medium text-primary hover:underline text-left"
                onClick={() => navigate(`/crm/sequences/${s.id}`)}
              >
                {s.name}
              </button>
            )},
            { key: 'status', label: 'Status', render: (s) => (
              <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
            )},
            { key: 'trigger_type', label: 'Trigger', render: (s) => (
              <Badge variant="info">{s.trigger_type.replace(/_/g, ' ')}</Badge>
            )},
            { key: 'created_at', label: 'Created', render: (s) => (
              <span className="text-sm text-gray-500">
                {new Date(s.created_at).toLocaleDateString()}
              </span>
            )},
            { key: 'actions', label: '', render: (s) => (
              <div className="flex gap-2 justify-end">
                {s.status !== 'active' && (
                  <Button size="sm" variant="ghost" onClick={() => handleActivate(s.id)} loading={activateSequence.isPending}>
                    Activate
                  </Button>
                )}
                {s.status === 'active' && (
                  <Button size="sm" variant="ghost" onClick={() => handlePause(s.id)} loading={pauseSequence.isPending}>
                    Pause
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/crm/sequences/${s.id}`)}
                >
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(s.id)}>
                  Delete
                </Button>
              </div>
            )},
          ]}
        />
      </Card>

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Sequence">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Sequence Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. New Lead Onboarding"
          />
          <Input
            label="Description"
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Brief description..."
          />
          <Select
            label="Trigger Type"
            value={form.trigger_type ?? 'manual'}
            onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value }))}
            options={TRIGGER_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createSequence.isPending}>
              Create Sequence
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
