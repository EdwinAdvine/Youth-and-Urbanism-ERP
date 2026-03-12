import { useState } from 'react'
import { Button, Spinner, Badge, Card, Table, Modal, Input, toast } from '../../components/ui'
import {
  useInboundEmailRules,
  useCreateInboundRule,
  useUpdateInboundRule,
  useDeleteInboundRule,
  type InboundEmailRule,
  type CreateInboundRulePayload,
} from '../../api/support_phase1'

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent']

const EMPTY_FORM: CreateInboundRulePayload = {
  email_address: '',
  priority: 'medium',
  category_id: '',
  assign_to: '',
  is_active: true,
}

const priorityVariant = (p: string | null): 'default' | 'success' | 'warning' | 'danger' | 'primary' => {
  switch (p) {
    case 'urgent': return 'danger'
    case 'high': return 'warning'
    case 'medium': return 'primary'
    case 'low': return 'success'
    default: return 'default'
  }
}

export default function InboundEmailConfig() {
  const { data: rules, isLoading, error } = useInboundEmailRules()
  const createRule = useCreateInboundRule()
  const updateRule = useUpdateInboundRule()
  const deleteRule = useDeleteInboundRule()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InboundEmailRule | null>(null)
  const [form, setForm] = useState<CreateInboundRulePayload>(EMPTY_FORM)

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setShowModal(false)
  }

  const handleEdit = (rule: InboundEmailRule) => {
    setEditing(rule)
    setForm({
      email_address: rule.email_address,
      priority: rule.priority || 'medium',
      category_id: rule.category_id || '',
      assign_to: rule.assign_to || '',
      is_active: rule.is_active,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email_address.trim()) return
    try {
      const payload = { ...form }
      if (!payload.category_id) delete payload.category_id
      if (!payload.assign_to) delete payload.assign_to
      if (editing) {
        await updateRule.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Rule updated')
      } else {
        await createRule.mutateAsync(payload)
        toast('success', 'Rule created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save rule')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this inbound email rule?')) return
    try {
      await deleteRule.mutateAsync(id)
      toast('success', 'Rule deleted')
    } catch {
      toast('error', 'Failed to delete rule')
    }
  }

  if (error) return <div className="p-6 text-[#ff3a6e]">Failed to load inbound email rules</div>

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const columns = [
    {
      key: 'email_address',
      label: 'Email Address',
      render: (row: InboundEmailRule) => (
        <span className="font-medium text-gray-900">{row.email_address}</span>
      ),
    },
    {
      key: 'category_id',
      label: 'Category',
      render: (row: InboundEmailRule) =>
        row.category_id ? (
          <span className="text-sm text-gray-600 font-mono">{row.category_id}</span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row: InboundEmailRule) =>
        row.priority ? (
          <Badge variant={priorityVariant(row.priority)}>
            {row.priority.charAt(0).toUpperCase() + row.priority.slice(1)}
          </Badge>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        ),
    },
    {
      key: 'assign_to',
      label: 'Assign To',
      render: (row: InboundEmailRule) =>
        row.assign_to ? (
          <span className="text-sm text-gray-600 font-mono">{row.assign_to}</span>
        ) : (
          <span className="text-gray-400 text-xs">Unassigned</span>
        ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: InboundEmailRule) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: InboundEmailRule) => (
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
          <h1 className="text-2xl font-bold text-gray-900">Inbound Email Rules</h1>
          <p className="text-sm text-gray-500 mt-1">Configure how incoming emails are routed to tickets</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>Add Rule</Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={rules ?? []}
          loading={false}
          keyExtractor={(row) => row.id}
          emptyText="No inbound email rules configured"
        />
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Rule' : 'Add Rule'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={form.email_address}
            onChange={(e) => setForm({ ...form, email_address: e.target.value })}
            required
            placeholder="e.g. support@company.com"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority || 'medium'}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Category ID"
              value={form.category_id || ''}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              placeholder="Category ID"
            />
          </div>

          <Input
            label="Assign To (User ID)"
            value={form.assign_to || ''}
            onChange={(e) => setForm({ ...form, assign_to: e.target.value })}
            placeholder="User ID to auto-assign tickets"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rule-active"
              checked={form.is_active ?? true}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
            />
            <label htmlFor="rule-active" className="text-sm text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" loading={createRule.isPending || updateRule.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
