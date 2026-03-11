import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Badge, toast } from '../../components/ui'
import {
  useTerminals,
  useCreateTerminal,
  useUpdateTerminal,
  useDeleteTerminal,
  type POSTerminalType,
  type CreateTerminalPayload,
} from '../../api/pos_ext'

const emptyForm: CreateTerminalPayload = {
  name: '',
  code: '',
  description: '',
  location: '',
  is_active: true,
}

export default function TerminalsPage() {
  const { data, isLoading, error } = useTerminals()
  const createTerminal = useCreateTerminal()
  const updateTerminal = useUpdateTerminal()
  const deleteTerminal = useDeleteTerminal()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<POSTerminalType | null>(null)
  const [form, setForm] = useState<CreateTerminalPayload>(emptyForm)

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowModal(false) }

  const handleEdit = (t: POSTerminalType) => {
    setEditing(t)
    setForm({ name: t.name, code: t.code, description: t.description || '', location: t.location || '', is_active: t.is_active })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateTerminal.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Terminal updated')
      } else {
        await createTerminal.mutateAsync(form)
        toast('success', 'Terminal created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save terminal')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this terminal?')) return
    try {
      await deleteTerminal.mutateAsync(id)
      toast('success', 'Terminal deleted')
    } catch {
      toast('error', 'Failed to delete terminal')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load terminals</div>

  const columns = [
    { key: 'name', label: 'Name', render: (r: POSTerminalType) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'code', label: 'Code', render: (r: POSTerminalType) => <span className="font-mono text-sm text-gray-500">{r.code}</span> },
    { key: 'location', label: 'Location', render: (r: POSTerminalType) => <span className="text-sm text-gray-600">{r.location || '-'}</span> },
    { key: 'is_active', label: 'Status', render: (r: POSTerminalType) => <Badge variant={r.is_active ? 'success' : 'default'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (r: POSTerminalType) => (
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
          <h1 className="text-2xl font-bold text-gray-900">POS Terminals</h1>
          <p className="text-sm text-gray-500 mt-1">Manage point-of-sale terminals</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>Add Terminal</Button>
      </div>

      <Card padding={false}>
        <Table columns={columns} data={data?.terminals ?? []} loading={isLoading} keyExtractor={(r) => r.id} emptyText="No terminals found" />
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Terminal' : 'Add Terminal'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="e.g. POS-001" />
          <Input label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Location" value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Main Store Counter 1" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="terminal-active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            <label htmlFor="terminal-active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createTerminal.isPending || updateTerminal.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
