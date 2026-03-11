import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { Button, Card, Badge, Spinner, Modal, Input, Select, Table, toast } from '../../components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommissionTier {
  min_amount: number
  max_amount: number | null
  rate: number
}

interface CommissionRule {
  id: string
  name: string
  rule_type: 'flat' | 'percentage' | 'tiered'
  value: number | null
  category_id: string | null
  category_name: string | null
  tiers: CommissionTier[] | null
  is_active: boolean
  created_at: string
}

interface CommissionRulePayload {
  name: string
  rule_type: 'flat' | 'percentage' | 'tiered'
  value?: number
  category_id?: string
  tiers?: CommissionTier[]
  is_active?: boolean
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useCommissionRules() {
  return useQuery({
    queryKey: ['pos', 'commission-rules'],
    queryFn: async () => {
      const { data } = await apiClient.get<CommissionRule[]>('/pos/commission-rules')
      return data
    },
  })
}

function useCreateCommissionRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CommissionRulePayload) => {
      const { data } = await apiClient.post<CommissionRule>('/pos/commission-rules', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'commission-rules'] }),
  })
}

function useUpdateCommissionRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: CommissionRulePayload & { id: string }) => {
      const { data } = await apiClient.put<CommissionRule>(`/pos/commission-rules/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'commission-rules'] }),
  })
}

function useToggleCommissionRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data } = await apiClient.patch<CommissionRule>(`/pos/commission-rules/${id}`, { is_active })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'commission-rules'] }),
  })
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RULE_TYPE_OPTIONS = [
  { value: 'flat', label: 'Flat Amount' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'tiered', label: 'Tiered' },
]

const EMPTY_TIER: CommissionTier = { min_amount: 0, max_amount: null, rate: 0 }

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommissionRulesPage() {
  const { data: rules, isLoading } = useCommissionRules()
  const createRule = useCreateCommissionRule()
  const updateRule = useUpdateCommissionRule()
  const toggleRule = useToggleCommissionRule()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionRule | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [ruleType, setRuleType] = useState<'flat' | 'percentage' | 'tiered'>('percentage')
  const [value, setValue] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tiers, setTiers] = useState<CommissionTier[]>([{ ...EMPTY_TIER }])

  function resetForm() {
    setName('')
    setRuleType('percentage')
    setValue('')
    setCategoryId('')
    setTiers([{ ...EMPTY_TIER }])
    setEditing(null)
  }

  function openCreate() {
    resetForm()
    setModalOpen(true)
  }

  function openEdit(rule: CommissionRule) {
    setEditing(rule)
    setName(rule.name)
    setRuleType(rule.rule_type)
    setValue(rule.value != null ? String(rule.value) : '')
    setCategoryId(rule.category_id ?? '')
    setTiers(rule.tiers && rule.tiers.length > 0 ? rule.tiers : [{ ...EMPTY_TIER }])
    setModalOpen(true)
  }

  function addTier() {
    setTiers((prev) => [...prev, { ...EMPTY_TIER }])
  }

  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateTier(idx: number, field: keyof CommissionTier, val: string) {
    setTiers((prev) =>
      prev.map((t, i) =>
        i === idx
          ? { ...t, [field]: field === 'max_amount' && val === '' ? null : parseFloat(val) || 0 }
          : t
      )
    )
  }

  async function handleSave() {
    if (!name.trim()) {
      toast('warning', 'Rule name is required')
      return
    }

    const payload: CommissionRulePayload = {
      name: name.trim(),
      rule_type: ruleType,
      is_active: true,
    }

    if (ruleType === 'flat' || ruleType === 'percentage') {
      payload.value = parseFloat(value) || 0
    }
    if (ruleType === 'tiered') {
      payload.tiers = tiers.filter((t) => t.rate > 0)
    }
    if (categoryId) {
      payload.category_id = categoryId
    }

    try {
      if (editing) {
        await updateRule.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Commission rule updated')
      } else {
        await createRule.mutateAsync(payload)
        toast('success', 'Commission rule created')
      }
      setModalOpen(false)
      resetForm()
    } catch {
      toast('error', 'Failed to save commission rule')
    }
  }

  async function handleToggle(rule: CommissionRule) {
    try {
      await toggleRule.mutateAsync({ id: rule.id, is_active: !rule.is_active })
      toast('success', `Rule ${rule.is_active ? 'deactivated' : 'activated'}`)
    } catch {
      toast('error', 'Failed to toggle rule')
    }
  }

  function formatValue(rule: CommissionRule): string {
    if (rule.rule_type === 'flat') return `${rule.value?.toFixed(2) ?? '0.00'} flat`
    if (rule.rule_type === 'percentage') return `${rule.value ?? 0}%`
    if (rule.rule_type === 'tiered' && rule.tiers) {
      return `${rule.tiers.length} tier(s)`
    }
    return '--'
  }

  const columns = [
    {
      key: 'name',
      label: 'Rule Name',
      render: (r: CommissionRule) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{r.name}</span>
      ),
    },
    {
      key: 'rule_type',
      label: 'Type',
      render: (r: CommissionRule) => (
        <Badge variant="primary">{r.rule_type}</Badge>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      render: (r: CommissionRule) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{formatValue(r)}</span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (r: CommissionRule) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{r.category_name ?? 'All'}</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (r: CommissionRule) => (
        <Badge variant={r.is_active ? 'success' : 'default'}>
          {r.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (r: CommissionRule) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleToggle(r)}>
            {r.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
            Edit
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Commission Rules</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure how commissions are calculated for cashiers and sales staff.
          </p>
        </div>
        <Button onClick={openCreate}>New Rule</Button>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table
          columns={columns}
          data={rules ?? []}
          keyExtractor={(r) => r.id}
          emptyText="No commission rules configured yet."
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm() }}
        title={editing ? 'Edit Commission Rule' : 'New Commission Rule'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Rule Name"
            placeholder="e.g. Standard 5% Commission"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Select
            label="Rule Type"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as 'flat' | 'percentage' | 'tiered')}
            options={RULE_TYPE_OPTIONS}
          />

          {(ruleType === 'flat' || ruleType === 'percentage') && (
            <Input
              label={ruleType === 'flat' ? 'Flat Amount per Transaction' : 'Percentage (%)'}
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={ruleType === 'flat' ? '50.00' : '5'}
            />
          )}

          {ruleType === 'tiered' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tiers</label>
                <Button size="sm" variant="ghost" onClick={addTier}>+ Add Tier</Button>
              </div>
              {tiers.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Input
                    placeholder="Min amount"
                    type="number"
                    value={String(tier.min_amount)}
                    onChange={(e) => updateTier(idx, 'min_amount', e.target.value)}
                  />
                  <Input
                    placeholder="Max (blank=unlimited)"
                    type="number"
                    value={tier.max_amount != null ? String(tier.max_amount) : ''}
                    onChange={(e) => updateTier(idx, 'max_amount', e.target.value)}
                  />
                  <Input
                    placeholder="Rate %"
                    type="number"
                    step="0.01"
                    value={String(tier.rate)}
                    onChange={(e) => updateTier(idx, 'rate', e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={tiers.length <= 1}
                    onClick={() => removeTier(idx)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Input
            label="Category ID (optional, leave blank for all)"
            placeholder="Category UUID"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setModalOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={createRule.isPending || updateRule.isPending}
            >
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
