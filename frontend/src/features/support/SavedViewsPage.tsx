import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Spinner, Badge, Card, Table, Modal, Input, toast } from '../../components/ui'
import {
  useSavedViews,
  useCreateView,
  useUpdateView,
  useDeleteView,
  type SavedView,
  type CreateViewPayload,
} from '../../api/support_phase1'

interface ViewForm {
  name: string
  status: string
  priority: string
  assigned_to: string
  category_id: string
  is_shared: boolean
  is_default: boolean
}

const EMPTY_FORM: ViewForm = {
  name: '',
  status: '',
  priority: '',
  assigned_to: '',
  category_id: '',
  is_shared: false,
  is_default: false,
}

const STATUS_OPTIONS = ['', 'open', 'in_progress', 'pending', 'resolved', 'closed']
const PRIORITY_OPTIONS = ['', 'low', 'medium', 'high', 'urgent']

function formToPayload(form: ViewForm): CreateViewPayload {
  const filters: Record<string, unknown> = {}
  if (form.status) filters.status = form.status
  if (form.priority) filters.priority = form.priority
  if (form.assigned_to) filters.assigned_to = form.assigned_to
  if (form.category_id) filters.category_id = form.category_id
  return {
    name: form.name,
    filters,
    columns: ['id', 'subject', 'status', 'priority', 'assigned_to', 'created_at'],
    is_shared: form.is_shared,
    is_default: form.is_default,
  }
}

function payloadToForm(view: SavedView): ViewForm {
  const f = view.filters || {}
  return {
    name: view.name,
    status: (f.status as string) || '',
    priority: (f.priority as string) || '',
    assigned_to: (f.assigned_to as string) || '',
    category_id: (f.category_id as string) || '',
    is_shared: view.is_shared,
    is_default: view.is_default,
  }
}

function filtersSummary(filters: Record<string, unknown>): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
  return parts.length > 0 ? parts.join(', ') : 'No filters'
}

export default function SavedViewsPage() {
  const navigate = useNavigate()
  const { data: views, isLoading, error } = useSavedViews()
  const createView = useCreateView()
  const updateView = useUpdateView()
  const deleteView = useDeleteView()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SavedView | null>(null)
  const [form, setForm] = useState<ViewForm>(EMPTY_FORM)

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setShowModal(false)
  }

  const handleEdit = (view: SavedView) => {
    setEditing(view)
    setForm(payloadToForm(view))
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      const payload = formToPayload(form)
      if (editing) {
        await updateView.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'View updated')
      } else {
        await createView.mutateAsync(payload)
        toast('success', 'View created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save view')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved view?')) return
    try {
      await deleteView.mutateAsync(id)
      toast('success', 'View deleted')
    } catch {
      toast('error', 'Failed to delete view')
    }
  }

  if (error) return <div className="p-6 text-[#ff3a6e]">Failed to load saved views</div>

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: SavedView) => (
        <button
          onClick={() => navigate(`/support/tickets?view=${row.id}`)}
          className="font-medium text-[#51459d] hover:underline"
        >
          {row.name}
        </button>
      ),
    },
    {
      key: 'filters',
      label: 'Filters',
      render: (row: SavedView) => (
        <span className="text-sm text-gray-600 truncate max-w-xs block">
          {filtersSummary(row.filters)}
        </span>
      ),
    },
    {
      key: 'is_shared',
      label: 'Shared',
      render: (row: SavedView) => (
        <Badge variant={row.is_shared ? 'primary' : 'default'}>
          {row.is_shared ? 'Shared' : 'Private'}
        </Badge>
      ),
    },
    {
      key: 'is_default',
      label: 'Default',
      render: (row: SavedView) =>
        row.is_default ? <Badge variant="success">Default</Badge> : <span className="text-gray-400 text-xs">-</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row: SavedView) => (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)}>
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
          <h1 className="text-2xl font-bold text-gray-900">Saved Views</h1>
          <p className="text-sm text-gray-500 mt-1">Manage saved ticket filter views</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>New View</Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={views ?? []}
          loading={false}
          keyExtractor={(row) => row.id}
          emptyText="No saved views"
        />
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit View' : 'New View'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g. My Open Tickets"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s ? s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Any Status'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Any Priority'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Assigned To"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              placeholder="User ID"
            />
            <Input
              label="Category ID"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              placeholder="Category ID"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="view-shared"
                checked={form.is_shared}
                onChange={(e) => setForm({ ...form, is_shared: e.target.checked })}
                className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
              />
              <label htmlFor="view-shared" className="text-sm text-gray-700">
                Share with team
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="view-default"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
              />
              <label htmlFor="view-default" className="text-sm text-gray-700">
                Set as default
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" loading={createView.isPending || updateView.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
