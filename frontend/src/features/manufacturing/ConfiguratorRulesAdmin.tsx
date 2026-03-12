import { useState } from 'react'
import { Button, Card, Badge, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

interface ConfiguratorRule {
  id: string
  name: string
  bom_id: string
  rule_type: 'include' | 'exclude' | 'substitute' | 'quantity_adjust'
  condition: { feature: string; value: string }
  action: Record<string, unknown>
  priority: number
  is_active: boolean
  created_at: string
}

const RULE_TYPES = [
  { value: 'include', label: 'Include Item' },
  { value: 'exclude', label: 'Exclude Item' },
  { value: 'substitute', label: 'Substitute Item' },
  { value: 'quantity_adjust', label: 'Adjust Quantity' },
]

const typeVariant: Record<string, BadgeVariant> = {
  include: 'success',
  exclude: 'danger',
  substitute: 'info',
  quantity_adjust: 'warning',
}

const defaultForm = {
  name: '',
  bom_id: '',
  rule_type: 'include' as string,
  condition_feature: '',
  condition_value: '',
  action_item_id: '',
  action_factor: '1',
  priority: '10',
}

export default function ConfiguratorRulesAdmin() {
  const [open, setOpen] = useState(false)
  const [filterBom, setFilterBom] = useState('')
  const [form, setForm] = useState(defaultForm)
  const qc = useQueryClient()

  const { data: rules = [], isLoading } = useQuery<ConfiguratorRule[]>({
    queryKey: ['configurator-rules', filterBom],
    queryFn: () =>
      apiClient.get(`/manufacturing/configurator/rules${filterBom ? `?bom_id=${filterBom}` : ''}`).then(r => r.data),
  })

  const createRule = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient.post('/manufacturing/configurator/rules', payload).then(r => r.data),
    onSuccess: () => {
      toast('success', 'Rule created')
      qc.invalidateQueries({ queryKey: ['configurator-rules'] })
      setOpen(false)
      setForm(defaultForm)
    },
    onError: () => toast('error', 'Failed to create rule'),
  })

  const toggleRule = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch(`/manufacturing/configurator/rules/${id}`, { is_active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['configurator-rules'] }),
    onError: () => toast('error', 'Failed to update rule'),
  })

  const deleteRule = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/manufacturing/configurator/rules/${id}`).then(r => r.data),
    onSuccess: () => {
      toast('success', 'Rule deleted')
      qc.invalidateQueries({ queryKey: ['configurator-rules'] })
    },
    onError: () => toast('error', 'Failed to delete rule'),
  })

  const handleSubmit = () => {
    if (!form.bom_id || !form.name || !form.condition_feature || !form.condition_value) {
      return toast('error', 'BOM ID, name, condition feature and value are required')
    }

    const action: Record<string, unknown> = {}
    if (form.rule_type === 'include' || form.rule_type === 'exclude') {
      if (form.action_item_id) action.item_id = form.action_item_id
    } else if (form.rule_type === 'substitute') {
      action.substitute_item_id = form.action_item_id
    } else if (form.rule_type === 'quantity_adjust') {
      action.factor = parseFloat(form.action_factor) || 1
    }

    createRule.mutate({
      name: form.name,
      bom_id: form.bom_id,
      rule_type: form.rule_type,
      condition: { feature: form.condition_feature, value: form.condition_value },
      action,
      priority: parseInt(form.priority) || 10,
    })
  }

  const actionSummary = (rule: ConfiguratorRule) => {
    const a = rule.action
    if (rule.rule_type === 'include') return `Include${a.item_id ? ` item ${String(a.item_id).slice(0, 8)}` : ' matched item'}`
    if (rule.rule_type === 'exclude') return `Exclude${a.item_id ? ` item ${String(a.item_id).slice(0, 8)}` : ' matched item'}`
    if (rule.rule_type === 'substitute') return `Replace with ${String(a.substitute_item_id || '').slice(0, 8)}`
    if (rule.rule_type === 'quantity_adjust') return `×${a.factor} quantity`
    return JSON.stringify(a)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configurator Rules</h1>
          <p className="text-sm text-gray-500 mt-1">CPQ rules that modify BOM items based on feature selections</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ New Rule</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 max-w-sm">
        <Input
          placeholder="Filter by BOM ID..."
          value={filterBom}
          onChange={e => setFilterBom(e.target.value)}
          className="font-mono text-sm"
        />
        {filterBom && <Button variant="ghost" onClick={() => setFilterBom('')}>Clear</Button>}
      </div>

      {/* Rules table */}
      {isLoading ? (
        <Card className="p-8 text-center">Loading...</Card>
      ) : rules.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No configurator rules yet. Create rules to enable CPQ logic for a BOM.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Condition</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-center font-semibold">Priority</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map(rule => (
                <tr key={rule.id} className={`hover:bg-gray-50 ${!rule.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={typeVariant[rule.rule_type] || 'default'} className="text-xs capitalize">
                      {rule.rule_type.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {rule.condition.feature} = <span className="font-bold text-gray-800">{rule.condition.value}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{actionSummary(rule)}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{rule.priority}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={rule.is_active ? 'success' : 'default'} className="text-xs">
                      {rule.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleRule.mutate({ id: rule.id, is_active: !rule.is_active })}
                      >
                        {rule.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => { if (confirm('Delete this rule?')) deleteRule.mutate(rule.id) }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create rule modal */}
      <Modal open={open} onClose={() => { setOpen(false); setForm(defaultForm) }} title="New Configurator Rule">
        <div className="space-y-4">
          <Input label="Rule Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Blue Color Includes Pigment A" />
          <Input label="BOM ID" value={form.bom_id} onChange={e => setForm({ ...form, bom_id: e.target.value })} placeholder="BOM UUID" className="font-mono text-sm" />

          <div>
            <label className="text-sm font-medium block mb-1">Rule Type</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={form.rule_type}
              onChange={e => setForm({ ...form, rule_type: e.target.value as typeof form.rule_type })}
            >
              {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Condition: Feature"
              value={form.condition_feature}
              onChange={e => setForm({ ...form, condition_feature: e.target.value })}
              placeholder="e.g. color"
            />
            <Input
              label="Condition: Value"
              value={form.condition_value}
              onChange={e => setForm({ ...form, condition_value: e.target.value })}
              placeholder="e.g. blue"
            />
          </div>

          {(form.rule_type === 'include' || form.rule_type === 'exclude') && (
            <Input
              label="Item ID (optional — applies to specific item)"
              value={form.action_item_id}
              onChange={e => setForm({ ...form, action_item_id: e.target.value })}
              placeholder="BOM Item UUID (leave empty for all)"
              className="font-mono text-sm"
            />
          )}
          {form.rule_type === 'substitute' && (
            <Input
              label="Substitute Item ID"
              value={form.action_item_id}
              onChange={e => setForm({ ...form, action_item_id: e.target.value })}
              placeholder="Replacement item UUID"
              className="font-mono text-sm"
            />
          )}
          {form.rule_type === 'quantity_adjust' && (
            <Input
              label="Quantity Factor"
              type="number"
              step="0.01"
              value={form.action_factor}
              onChange={e => setForm({ ...form, action_factor: e.target.value })}
              placeholder="e.g. 1.5 (50% more), 0.5 (half)"
            />
          )}

          <Input
            label="Priority (lower = evaluated first)"
            type="number"
            value={form.priority}
            onChange={e => setForm({ ...form, priority: e.target.value })}
            placeholder="10"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setOpen(false); setForm(defaultForm) }}>Cancel</Button>
            <Button onClick={handleSubmit} loading={createRule.isPending}>Create Rule</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
