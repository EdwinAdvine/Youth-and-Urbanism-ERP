import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useAutomationRules, useCreateAutomationRule, useUpdateAutomationRule, useDeleteAutomationRule, useInventoryInsights, type InventoryAutomationRule } from '../../api/inventory'

const TRIGGER_OPTIONS = [
  { value: 'stock_below_reorder', label: 'Stock Below Reorder Level' },
  { value: 'po_received', label: 'PO Received' },
  { value: 'count_discrepancy', label: 'Count Discrepancy' },
  { value: 'expiry_approaching', label: 'Expiry Approaching' },
]

const ACTION_OPTIONS = [
  { value: 'create_po', label: 'Create Purchase Order' },
  { value: 'send_alert', label: 'Send Alert' },
  { value: 'update_bin', label: 'Update Bin Location' },
  { value: 'adjust_stock', label: 'Adjust Stock' },
]

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<'rules' | 'insights'>('insights')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', trigger_event: 'stock_below_reorder', action_type: 'create_po' })

  const { data: rules, isLoading } = useAutomationRules()
  const { data: insights, isLoading: insightsLoading } = useInventoryInsights()
  const createRule = useCreateAutomationRule()
  const updateRule = useUpdateAutomationRule()
  const deleteRule = useDeleteAutomationRule()

  async function handleCreate() {
    if (!form.name || !form.trigger_event || !form.action_type) {
      toast('warning', 'Name, trigger event, and action are required')
      return
    }
    try {
      await createRule.mutateAsync(form)
      toast('success', 'Automation rule created')
      setModalOpen(false)
      setForm({ name: '', trigger_event: 'stock_below_reorder', action_type: 'create_po' })
    } catch {
      toast('error', 'Failed to create rule')
    }
  }

  async function handleToggle(rule: InventoryAutomationRule) {
    try {
      await updateRule.mutateAsync({ id: rule.id, is_active: !rule.is_active })
      toast('success', `Rule ${rule.is_active ? 'deactivated' : 'activated'}`)
    } catch {
      toast('error', 'Failed to update rule')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRule.mutateAsync(id)
      toast('success', 'Rule deleted')
    } catch {
      toast('error', 'Failed to delete rule')
    }
  }

  const ruleColumns = [
    { key: 'name', label: 'Rule', render: (row: InventoryAutomationRule) => <span className="font-medium">{row.name}</span> },
    { key: 'trigger_event', label: 'Trigger', render: (row: InventoryAutomationRule) => <Badge variant="info">{row.trigger_event.replace(/_/g, ' ')}</Badge> },
    { key: 'action_type', label: 'Action', render: (row: InventoryAutomationRule) => <Badge variant="warning">{row.action_type.replace(/_/g, ' ')}</Badge> },
    { key: 'is_active', label: 'Status', render: (row: InventoryAutomationRule) => <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'last_triggered_at', label: 'Last Triggered', render: (row: InventoryAutomationRule) => row.last_triggered_at ? new Date(row.last_triggered_at).toLocaleString() : <span className="text-gray-400">Never</span> },
    {
      key: 'actions', label: '',
      render: (row: InventoryAutomationRule) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => handleToggle(row)}>{row.is_active ? 'Disable' : 'Enable'}</Button>
          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(row.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  const INSIGHT_COLORS: Record<string, string> = { critical: 'text-red-600 bg-red-50', warning: 'text-amber-600 bg-amber-50', info: 'text-blue-600 bg-blue-50', success: 'text-green-600 bg-green-50' }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Automation & AI Insights</h1>
          <p className="text-sm text-gray-500 mt-1">Inventory automation rules and AI-powered analysis</p>
        </div>
        {activeTab === 'rules' && <Button onClick={() => setModalOpen(true)}>New Rule</Button>}
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-[10px] mb-6 w-fit">
        {[{ id: 'insights', label: 'AI Insights' }, { id: 'rules', label: 'Automation Rules' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium rounded-[8px] transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'insights' && (
        <div className="space-y-4">
          {insightsLoading ? (
            <Card><p className="text-gray-500 text-sm">Loading insights...</p></Card>
          ) : insights ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(insights.summary).map(([key, value]) => (
                  <Card key={key}>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{String(value)}</p>
                  </Card>
                ))}
              </div>
              <div className="space-y-2">
                {insights.insights.map((insight, i) => (
                  <div key={i} className={`p-4 rounded-[10px] ${INSIGHT_COLORS[insight.type] ?? 'bg-gray-50 text-gray-600'}`}>
                    <p className="text-sm font-medium">{insight.message}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">Generated at {new Date(insights.generated_at).toLocaleString()}</p>
            </>
          ) : null}
        </div>
      )}

      {activeTab === 'rules' && (
        <Card padding={false}>
          <Table<InventoryAutomationRule>
            columns={ruleColumns}
            data={rules ?? []}
            loading={isLoading}
            emptyText="No automation rules defined."
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Automation Rule" size="sm">
        <div className="space-y-4">
          <Input label="Rule Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Auto-PO on low stock" />
          <Select label="Trigger Event *" options={TRIGGER_OPTIONS} value={form.trigger_event} onChange={(e) => setForm({ ...form, trigger_event: e.target.value })} />
          <Select label="Action *" options={ACTION_OPTIONS} value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createRule.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
