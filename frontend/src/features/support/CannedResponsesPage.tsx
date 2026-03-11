import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Badge, toast } from '../../components/ui'
import {
  useCannedResponses,
  useCreateCannedResponse,
  useUpdateCannedResponse,
  useDeleteCannedResponse,
  type CannedResponse,
  type CreateCannedResponsePayload,
} from '../../api/support_ext'

const emptyForm: CreateCannedResponsePayload = { title: '', content: '', category: '', shortcut: '', is_shared: true }

export default function CannedResponsesPage() {
  const [search, setSearch] = useState('')
  const { data: responses, isLoading, error } = useCannedResponses({ search: search || undefined })
  const createResponse = useCreateCannedResponse()
  const updateResponse = useUpdateCannedResponse()
  const deleteResponse = useDeleteCannedResponse()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CannedResponse | null>(null)
  const [form, setForm] = useState<CreateCannedResponsePayload>(emptyForm)

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowModal(false) }

  const handleEdit = (r: CannedResponse) => {
    setEditing(r)
    setForm({ title: r.title, content: r.content, category: r.category || '', shortcut: r.shortcut || '', is_shared: r.is_shared })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateResponse.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Response updated')
      } else {
        await createResponse.mutateAsync(form)
        toast('success', 'Response created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save response')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this response?')) return
    try {
      await deleteResponse.mutateAsync(id)
      toast('success', 'Response deleted')
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load canned responses</div>

  const columns = [
    { key: 'title', label: 'Title', render: (r: CannedResponse) => <span className="font-medium text-gray-900">{r.title}</span> },
    { key: 'shortcut', label: 'Shortcut', render: (r: CannedResponse) => r.shortcut ? <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-0.5 rounded">{r.shortcut}</span> : <span className="text-gray-400 text-xs">-</span> },
    { key: 'category', label: 'Category', render: (r: CannedResponse) => r.category ? <Badge variant="primary">{r.category}</Badge> : <span className="text-gray-400 text-xs">-</span> },
    { key: 'content', label: 'Preview', render: (r: CannedResponse) => <span className="text-sm text-gray-600 truncate max-w-xs block">{r.content.slice(0, 80)}{r.content.length > 80 ? '...' : ''}</span> },
    { key: 'usage', label: 'Used', render: (r: CannedResponse) => <span className="text-sm text-gray-500">{r.usage_count}x</span> },
    { key: 'shared', label: 'Shared', render: (r: CannedResponse) => <Badge variant={r.is_shared ? 'success' : 'default'}>{r.is_shared ? 'Shared' : 'Private'}</Badge> },
    {
      key: 'actions', label: '',
      render: (r: CannedResponse) => (
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
          <h1 className="text-2xl font-bold text-gray-900">Canned Responses</h1>
          <p className="text-sm text-gray-500 mt-1">Predefined replies for quick ticket responses</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>Add Response</Button>
      </div>

      <div className="flex gap-3">
        <Input placeholder="Search responses..." value={search} onChange={(e) => setSearch(e.target.value)}
          leftIcon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} />
      </div>

      <Card padding={false}>
        <Table columns={columns} data={responses ?? []} loading={isLoading} keyExtractor={(r) => r.id} emptyText="No canned responses" />
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Response' : 'Add Response'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Category" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Billing, Technical" />
            <Input label="Shortcut" value={form.shortcut || ''} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} placeholder="e.g. /thanks" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[120px]"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
              placeholder="Type the canned response content..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="shared" checked={form.is_shared} onChange={(e) => setForm({ ...form, is_shared: e.target.checked })} className="rounded" />
            <label htmlFor="shared" className="text-sm text-gray-700">Share with team</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createResponse.isPending || updateResponse.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
