import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useSLAPolicies,
  useCreateSLAPolicy,
  useUpdateSLAPolicy,
  useDeleteSLAPolicy,
  type SLAPolicy,
  type CreateSLAPolicyPayload,
} from '../../api/support_ext'

const emptyForm: CreateSLAPolicyPayload = {
  name: '',
  priority: 'medium',
  response_time_hours: 4,
  resolution_time_hours: 24,
  escalation_enabled: false,
  notify_on_breach: true,
  is_active: true,
}

export default function SLAConfigPage() {
  const { data: policies, isLoading, error } = useSLAPolicies()
  const createPolicy = useCreateSLAPolicy()
  const updatePolicy = useUpdateSLAPolicy()
  const deletePolicy = useDeleteSLAPolicy()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SLAPolicy | null>(null)
  const [form, setForm] = useState<CreateSLAPolicyPayload>(emptyForm)

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowModal(false) }

  const handleEdit = (p: SLAPolicy) => {
    setEditing(p)
    setForm({
      name: p.name,
      priority: p.priority,
      response_time_hours: p.response_time_hours,
      resolution_time_hours: p.resolution_time_hours,
      escalation_enabled: p.escalation_enabled,
      escalation_after_hours: p.escalation_after_hours || undefined,
      notify_on_breach: p.notify_on_breach,
      is_active: p.is_active,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updatePolicy.mutateAsync({ id: editing.id, ...form })
        toast('success', 'SLA policy updated')
      } else {
        await createPolicy.mutateAsync(form)
        toast('success', 'SLA policy created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save SLA policy')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this SLA policy?')) return
    try {
      await deletePolicy.mutateAsync(id)
      toast('success', 'SLA policy deleted')
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load SLA policies</div>

  const priorityColors: Record<string, 'default' | 'warning' | 'danger' | 'info'> = {
    low: 'default', medium: 'info', high: 'warning', urgent: 'danger', critical: 'danger',
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: SLAPolicy) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'priority', label: 'Priority', render: (r: SLAPolicy) => <Badge variant={priorityColors[r.priority] || 'default'}>{r.priority}</Badge> },
    { key: 'response', label: 'Response Time', render: (r: SLAPolicy) => <span className="text-sm">{r.response_time_hours}h</span> },
    { key: 'resolution', label: 'Resolution Time', render: (r: SLAPolicy) => <span className="text-sm">{r.resolution_time_hours}h</span> },
    { key: 'escalation', label: 'Escalation', render: (r: SLAPolicy) => r.escalation_enabled ? <Badge variant="warning">Enabled</Badge> : <span className="text-gray-400 text-xs">Off</span> },
    { key: 'is_active', label: 'Status', render: (r: SLAPolicy) => <Badge variant={r.is_active ? 'success' : 'default'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', label: '',
      render: (r: SLAPolicy) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SLA Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">Define service level agreement policies by priority</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>Add SLA Policy</Button>
      </div>

      <Card padding={false}>
        <Table columns={columns} data={policies ?? []} loading={isLoading} keyExtractor={(r) => r.id} emptyText="No SLA policies defined" />
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit SLA Policy' : 'Add SLA Policy'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }, { value: 'critical', label: 'Critical' }]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Response Time (hours)" type="number" min="0.5" step="0.5" value={form.response_time_hours} onChange={(e) => setForm({ ...form, response_time_hours: parseFloat(e.target.value) || 0 })} required />
            <Input label="Resolution Time (hours)" type="number" min="0.5" step="0.5" value={form.resolution_time_hours} onChange={(e) => setForm({ ...form, resolution_time_hours: parseFloat(e.target.value) || 0 })} required />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="escalation" checked={form.escalation_enabled} onChange={(e) => setForm({ ...form, escalation_enabled: e.target.checked })} className="rounded" />
              <label htmlFor="escalation" className="text-sm text-gray-700">Enable escalation</label>
            </div>
            {form.escalation_enabled && (
              <Input label="Escalate After (hours)" type="number" min="1" step="1" value={form.escalation_after_hours ?? ''} onChange={(e) => setForm({ ...form, escalation_after_hours: e.target.value ? parseInt(e.target.value) : undefined })} />
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="notify-breach" checked={form.notify_on_breach} onChange={(e) => setForm({ ...form, notify_on_breach: e.target.checked })} className="rounded" />
              <label htmlFor="notify-breach" className="text-sm text-gray-700">Notify on SLA breach</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sla-active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
              <label htmlFor="sla-active" className="text-sm text-gray-700">Active</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createPolicy.isPending || updatePolicy.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
