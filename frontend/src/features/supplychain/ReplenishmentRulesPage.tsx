import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useReplenishmentRules, useCreateReplenishmentRule, useUpdateReplenishmentRule,
  useCheckReplenishment, type ReplenishmentRuleItem,
} from '../../api/supplychain_ops'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

interface RuleFormState {
  item_id: string
  warehouse_id: string
  rule_type: string
  reorder_point: string
  reorder_quantity: string
  min_level: string
  max_level: string
  lead_time_days: string
  supplier_id: string
  auto_generate_po: boolean
}

const defaultForm: RuleFormState = {
  item_id: '',
  warehouse_id: '',
  rule_type: 'reorder_point',
  reorder_point: '10',
  reorder_quantity: '50',
  min_level: '0',
  max_level: '0',
  lead_time_days: '7',
  supplier_id: '',
  auto_generate_po: false,
}

export default function ReplenishmentRulesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editRule, setEditRule] = useState<ReplenishmentRuleItem | null>(null)
  const [form, setForm] = useState<RuleFormState>(defaultForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useReplenishmentRules({ skip, limit })
  const createMutation = useCreateReplenishmentRule()
  const updateMutation = useUpdateReplenishmentRule()
  const checkMutation = useCheckReplenishment()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const handleCreate = async () => {
    if (!form.item_id.trim() || !form.warehouse_id.trim()) {
      toast('warning', 'Item ID and Warehouse ID are required')
      return
    }
    try {
      await createMutation.mutateAsync({
        item_id: form.item_id.trim(),
        warehouse_id: form.warehouse_id.trim(),
        rule_type: form.rule_type,
        reorder_point: Number(form.reorder_point) || 0,
        reorder_quantity: Number(form.reorder_quantity) || 0,
        min_level: Number(form.min_level) || 0,
        max_level: Number(form.max_level) || 0,
        lead_time_days: Number(form.lead_time_days) || 7,
        supplier_id: form.supplier_id.trim() || undefined,
        auto_generate_po: form.auto_generate_po,
      })
      toast('success', 'Rule created')
      setShowCreate(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to create rule')
    }
  }

  const openEdit = (rule: ReplenishmentRuleItem) => {
    setForm({
      item_id: rule.item_id,
      warehouse_id: rule.warehouse_id,
      rule_type: rule.rule_type,
      reorder_point: String(rule.reorder_point),
      reorder_quantity: String(rule.reorder_quantity),
      min_level: String(rule.min_level),
      max_level: String(rule.max_level),
      lead_time_days: String(rule.lead_time_days),
      supplier_id: rule.supplier_id || '',
      auto_generate_po: rule.auto_generate_po,
    })
    setEditRule(rule)
  }

  const handleEdit = async () => {
    if (!editRule) return
    try {
      await updateMutation.mutateAsync({
        id: editRule.id,
        rule_type: form.rule_type,
        reorder_point: Number(form.reorder_point) || 0,
        reorder_quantity: Number(form.reorder_quantity) || 0,
        min_level: Number(form.min_level) || 0,
        max_level: Number(form.max_level) || 0,
        lead_time_days: Number(form.lead_time_days) || 7,
        supplier_id: form.supplier_id.trim() || undefined,
        auto_generate_po: form.auto_generate_po,
      })
      toast('success', 'Rule updated')
      setEditRule(null)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to update rule')
    }
  }

  const handleToggleActive = async (rule: ReplenishmentRuleItem) => {
    try {
      await updateMutation.mutateAsync({
        id: rule.id,
        is_active: !rule.is_active,
      })
      toast('success', `Rule ${rule.is_active ? 'deactivated' : 'activated'}`)
    } catch {
      toast('error', 'Failed to toggle rule')
    }
  }

  const handleCheckAll = async () => {
    try {
      const result = await checkMutation.mutateAsync()
      toast('success', `Replenishment check complete: ${(result as { triggered: number }).triggered ?? 0} rules triggered`)
    } catch {
      toast('error', 'Replenishment check failed')
    }
  }

  const filteredRules = data?.rules?.filter((r) =>
    !search || r.item_id.toLowerCase().includes(search.toLowerCase()) ||
    r.rule_type.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const columns = [
    {
      key: 'item_id',
      label: 'Item',
      render: (row: ReplenishmentRuleItem) => (
        <span className="font-medium text-[#51459d]">{row.item_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'warehouse_id',
      label: 'Warehouse',
      render: (row: ReplenishmentRuleItem) => (
        <span className="text-gray-600 dark:text-gray-400">{row.warehouse_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'rule_type',
      label: 'Type',
      render: (row: ReplenishmentRuleItem) => (
        <span className="text-gray-900 dark:text-gray-100 capitalize">{row.rule_type.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'reorder_point',
      label: 'Reorder Pt',
      render: (row: ReplenishmentRuleItem) => (
        <span className="text-gray-700 dark:text-gray-300 font-medium">{row.reorder_point}</span>
      ),
    },
    {
      key: 'reorder_quantity',
      label: 'Reorder Qty',
      render: (row: ReplenishmentRuleItem) => (
        <span className="text-gray-700 dark:text-gray-300 font-medium">{row.reorder_quantity}</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Active',
      render: (row: ReplenishmentRuleItem) => (
        <button
          onClick={() => handleToggleActive(row)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${row.is_active ? 'bg-[#6fd943]' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${row.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
      ),
    },
    {
      key: 'last_triggered_at',
      label: 'Last Triggered',
      render: (row: ReplenishmentRuleItem) => (
        <span className="text-gray-500 text-xs">{row.last_triggered_at ? formatDate(row.last_triggered_at) : '-'}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: ReplenishmentRuleItem) => (
        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Replenishment Rules</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total rules</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button variant="secondary" onClick={handleCheckAll} loading={checkMutation.isPending}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Check All Rules
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Rule
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-72">
          <Input
            placeholder="Search rules..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <span className="text-sm text-gray-500">{data?.total ?? 0} rules</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<ReplenishmentRuleItem>
          columns={columns}
          data={filteredRules}
          loading={isLoading}
          emptyText="No replenishment rules found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Replenishment Rule" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Item ID *"
              value={form.item_id}
              onChange={(e) => setForm({ ...form, item_id: e.target.value })}
              placeholder="UUID of the item"
            />
            <Input
              label="Warehouse ID *"
              value={form.warehouse_id}
              onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
              placeholder="UUID of the warehouse"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rule Type</label>
              <select
                value={form.rule_type}
                onChange={(e) => setForm({ ...form, rule_type: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                <option value="reorder_point">Reorder Point</option>
                <option value="min_max">Min/Max</option>
                <option value="periodic">Periodic</option>
              </select>
            </div>
            <Input
              label="Lead Time (days)"
              type="number"
              min="1"
              value={form.lead_time_days}
              onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Reorder Point"
              type="number"
              min="0"
              value={form.reorder_point}
              onChange={(e) => setForm({ ...form, reorder_point: e.target.value })}
            />
            <Input
              label="Reorder Quantity"
              type="number"
              min="0"
              value={form.reorder_quantity}
              onChange={(e) => setForm({ ...form, reorder_quantity: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Level"
              type="number"
              min="0"
              value={form.min_level}
              onChange={(e) => setForm({ ...form, min_level: e.target.value })}
            />
            <Input
              label="Max Level"
              type="number"
              min="0"
              value={form.max_level}
              onChange={(e) => setForm({ ...form, max_level: e.target.value })}
            />
          </div>
          <Input
            label="Supplier ID"
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            placeholder="Optional preferred supplier UUID"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.auto_generate_po}
              onChange={(e) => setForm({ ...form, auto_generate_po: e.target.checked })}
              className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
            />
            <span className="text-gray-700 dark:text-gray-300">Auto-generate Purchase Order</span>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create Rule
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editRule} onClose={() => { setEditRule(null); setForm(defaultForm) }} title="Edit Replenishment Rule" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rule Type</label>
              <select
                value={form.rule_type}
                onChange={(e) => setForm({ ...form, rule_type: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                <option value="reorder_point">Reorder Point</option>
                <option value="min_max">Min/Max</option>
                <option value="periodic">Periodic</option>
              </select>
            </div>
            <Input
              label="Lead Time (days)"
              type="number"
              min="1"
              value={form.lead_time_days}
              onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Reorder Point"
              type="number"
              min="0"
              value={form.reorder_point}
              onChange={(e) => setForm({ ...form, reorder_point: e.target.value })}
            />
            <Input
              label="Reorder Quantity"
              type="number"
              min="0"
              value={form.reorder_quantity}
              onChange={(e) => setForm({ ...form, reorder_quantity: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Level"
              type="number"
              min="0"
              value={form.min_level}
              onChange={(e) => setForm({ ...form, min_level: e.target.value })}
            />
            <Input
              label="Max Level"
              type="number"
              min="0"
              value={form.max_level}
              onChange={(e) => setForm({ ...form, max_level: e.target.value })}
            />
          </div>
          <Input
            label="Supplier ID"
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            placeholder="Optional preferred supplier UUID"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.auto_generate_po}
              onChange={(e) => setForm({ ...form, auto_generate_po: e.target.checked })}
              className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
            />
            <span className="text-gray-700 dark:text-gray-300">Auto-generate Purchase Order</span>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => { setEditRule(null); setForm(defaultForm) }}>Cancel</Button>
            <Button size="sm" onClick={handleEdit} loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
