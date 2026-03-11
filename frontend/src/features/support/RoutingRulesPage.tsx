import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Badge, toast } from '../../components/ui'
import {
  useRoutingRules,
  useCreateRoutingRule,
  useUpdateRoutingRule,
  useDeleteRoutingRule,
  type RoutingRule,
  type CreateRoutingRulePayload,
} from '../../api/support_ext'

const emptyForm: CreateRoutingRulePayload = {
  name: '',
  description: '',
  conditions: {},
  assign_to: undefined,
  priority_override: undefined,
  category_override: undefined,
  is_active: true,
  priority_order: 0,
}

export default function RoutingRulesPage() {
  const { data, isLoading, error } = useRoutingRules()
  const createRule = useCreateRoutingRule()
  const updateRule = useUpdateRoutingRule()
  const deleteRule = useDeleteRoutingRule()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<RoutingRule | null>(null)
  const [form, setForm] = useState<CreateRoutingRulePayload>(emptyForm)
  const [conditionsText, setConditionsText] = useState('{}')

  const resetForm = () => {
    setForm(emptyForm)
    setConditionsText('{}')
    setEditing(null)
    setShowModal(false)
  }

  const handleEdit = (rule: RoutingRule) => {
    setEditing(rule)
    setForm({
      name: rule.name,
      description: rule.description || '',
      conditions: rule.conditions || {},
      assign_to: rule.assign_to || undefined,
      priority_override: rule.priority_override || undefined,
      category_override: rule.category_override || undefined,
      is_active: rule.is_active,
      priority_order: rule.priority_order,
    })
    setConditionsText(JSON.stringify(rule.conditions || {}, null, 2))
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      let parsedConditions: Record<string, unknown> = {}
      try {
        parsedConditions = JSON.parse(conditionsText)
      } catch {
        toast('error', 'Invalid JSON in conditions field')
        return
      }

      const payload = { ...form, conditions: parsedConditions }

      if (editing) {
        await updateRule.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Routing rule updated')
      } else {
        await createRule.mutateAsync(payload)
        toast('success', 'Routing rule created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save routing rule')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this routing rule?')) return
    try {
      await deleteRule.mutateAsync(id)
      toast('success', 'Routing rule deleted')
    } catch {
      toast('error', 'Failed to delete routing rule')
    }
  }

  if (error) return <p className="text-red-500">Error loading routing rules</p>

  const rules = data?.routing_rules || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ticket Routing Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure automatic ticket assignment and prioritization based on conditions.
            Rules are evaluated in priority order; the first match wins.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
        >
          + New Rule
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <p className="p-4 text-gray-500">Loading...</p>
        ) : rules.length === 0 ? (
          <p className="p-4 text-gray-500">No routing rules configured yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Conditions</th>
                <th className="text-left p-3">Assign To</th>
                <th className="text-left p-3">Priority Override</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t">
                  <td className="p-3 text-sm">{rule.priority_order}</td>
                  <td className="p-3">
                    <div className="font-medium text-sm">{rule.name}</div>
                    {rule.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{rule.description}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs font-mono text-gray-600 max-w-xs truncate">
                    {JSON.stringify(rule.conditions)}
                  </td>
                  <td className="p-3 text-sm">{rule.assign_to || '--'}</td>
                  <td className="p-3 text-sm">{rule.priority_override || '--'}</td>
                  <td className="p-3">
                    <Badge variant={rule.is_active ? 'success' : 'default'}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-3 space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(rule)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(rule.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {showModal && (
        <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Routing Rule' : 'New Routing Rule'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Rule Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Description"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conditions (JSON)
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 p-2 text-sm font-mono"
                rows={5}
                value={conditionsText}
                onChange={(e) => setConditionsText(e.target.value)}
                placeholder='{"subject_contains": "urgent", "priority": "high", "customer_email_domain": "vip.com"}'
              />
              <p className="text-xs text-gray-400 mt-1">
                Keys: subject_contains, priority, customer_email_domain, tags_include, category_id
              </p>
            </div>
            <Input
              label="Assign To (User ID)"
              value={form.assign_to || ''}
              onChange={(e) => setForm({ ...form, assign_to: e.target.value || undefined })}
              placeholder="Leave empty to skip auto-assignment"
            />
            <Input
              label="Priority Override"
              value={form.priority_override || ''}
              onChange={(e) => setForm({ ...form, priority_override: e.target.value || undefined })}
              placeholder="low, medium, high, urgent"
            />
            <Input
              label="Priority Order"
              type="number"
              value={String(form.priority_order ?? 0)}
              onChange={(e) => setForm({ ...form, priority_order: parseInt(e.target.value) || 0 })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" type="button" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" loading={createRule.isPending || updateRule.isPending}>
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
