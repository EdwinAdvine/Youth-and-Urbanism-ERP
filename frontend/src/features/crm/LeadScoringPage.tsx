import { useState } from 'react'
import {
  useScoringRules,
  useCreateScoringRule,
  useUpdateScoringRule,
  useDeleteScoringRule,
  useBatchRescore,
  useScoringWeights,
  type LeadScoringRule,
  type ScoringRuleCreatePayload,
} from '@/api/crm_v2'
import { Button, Badge, Card, Modal, Input, Select, Table, cn, toast } from '@/components/ui'

const CATEGORIES = ['demographic', 'behavioral', 'engagement', 'firmographic']
const OPERATORS = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in']

const EMPTY_FORM: ScoringRuleCreatePayload = {
  name: '',
  category: 'demographic',
  field_name: '',
  operator: 'equals',
  value: '',
  score_delta: 10,
  is_active: true,
}

export default function LeadScoringPage() {
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const { data: rulesData, isLoading } = useScoringRules(categoryFilter)
  const { data: weightsData } = useScoringWeights()
  const createRule = useCreateScoringRule()
  const updateRule = useUpdateScoringRule()
  const deleteRule = useDeleteScoringRule()
  const batchRescore = useBatchRescore()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LeadScoringRule | null>(null)
  const [form, setForm] = useState<ScoringRuleCreatePayload>(EMPTY_FORM)

  const rules: LeadScoringRule[] = rulesData?.items ?? rulesData ?? []
  const weights: Record<string, number> = weightsData ?? {}

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (rule: LeadScoringRule) => {
    setEditing(rule)
    setForm({
      name: rule.name,
      category: rule.category,
      field_name: rule.field_name,
      operator: rule.operator,
      value: rule.value,
      score_delta: rule.score_delta,
      is_active: rule.is_active,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateRule.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Rule updated')
      } else {
        await createRule.mutateAsync(form)
        toast('success', 'Rule created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save rule')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this scoring rule?')) return
    try {
      await deleteRule.mutateAsync(id)
      toast('success', 'Rule deleted')
    } catch {
      toast('error', 'Failed to delete rule')
    }
  }

  const handleRescore = async () => {
    try {
      const result = await batchRescore.mutateAsync()
      toast('success', `Rescored ${result?.leads_scored ?? 'all'} leads`)
    } catch {
      toast('error', 'Failed to rescore leads')
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Lead Scoring
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure scoring rules to automatically rank your leads
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleRescore} loading={batchRescore.isPending}>
            Rescore All Leads
          </Button>
          <Button onClick={openCreate}>+ New Rule</Button>
        </div>
      </div>

      {/* Scoring Weights Summary */}
      {Object.keys(weights).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(weights).map(([cat, weight]) => (
            <Card key={cat} className="text-center py-3">
              <p className="text-lg font-bold text-primary">{weight}</p>
              <p className="text-xs text-gray-500 capitalize">{cat}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3">
        <Select
          label="Category"
          value={categoryFilter ?? ''}
          onChange={(e) => setCategoryFilter(e.target.value || undefined)}
          options={[
            { value: '', label: 'All Categories' },
            ...CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
          ]}
        />
      </div>

      {/* Rules Table */}
      <Card padding={false}>
        <Table<LeadScoringRule>
          loading={isLoading}
          data={rules}
          keyExtractor={(r) => r.id}
          emptyText="No scoring rules defined."
          columns={[
            { key: 'name', label: 'Rule Name', render: (r) => (
              <span className="font-medium text-gray-900 dark:text-gray-100">{r.name}</span>
            )},
            { key: 'category', label: 'Category', render: (r) => (
              <Badge variant="primary">{r.category}</Badge>
            )},
            { key: 'field_name', label: 'Field', render: (r) => (
              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{r.field_name}</code>
            )},
            { key: 'operator', label: 'Operator', render: (r) => (
              <span className="text-sm text-gray-600 dark:text-gray-400">{r.operator}</span>
            )},
            { key: 'value', label: 'Value' },
            { key: 'score_delta', label: 'Points', render: (r) => (
              <span className={cn('font-semibold text-sm', r.score_delta >= 0 ? 'text-green-600' : 'text-red-600')}>
                {r.score_delta > 0 ? '+' : ''}{r.score_delta}
              </span>
            )},
            { key: 'is_active', label: 'Status', render: (r) => (
              <Badge variant={r.is_active ? 'success' : 'default'}>
                {r.is_active ? 'Active' : 'Inactive'}
              </Badge>
            )},
            { key: 'actions', label: '', render: (r) => (
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}>Delete</Button>
              </div>
            )},
          ]}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Scoring Rule' : 'New Scoring Rule'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Rule Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Enterprise company size"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              required
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              options={CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
            />
            <Input
              label="Score Delta"
              type="number"
              required
              value={form.score_delta}
              onChange={(e) => setForm((f) => ({ ...f, score_delta: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <Input
            label="Field Name"
            required
            value={form.field_name}
            onChange={(e) => setForm((f) => ({ ...f, field_name: e.target.value }))}
            placeholder="e.g. company_size"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Operator"
              required
              value={form.operator}
              onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value }))}
              options={OPERATORS.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }))}
            />
            <Input
              label="Value"
              required
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="e.g. enterprise"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.is_active ?? true}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="rounded"
            />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createRule.isPending || updateRule.isPending}>
              {editing ? 'Save Changes' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
