import { useState } from 'react'
import { Button, Badge, Card, Table, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useCostingConfigs, useCreateCostingConfig, useCostLayers, useProfitabilityReport, useInventoryAuditTrail, type CostingConfig, type CostLayer } from '../../api/inventory'

const METHOD_COLORS: Record<string, 'info' | 'warning' | 'success' | 'default'> = {
  fifo: 'info', lifo: 'warning', average: 'success', standard: 'default', specific: 'default',
}

export default function CostingPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'layers' | 'profitability' | 'audit'>('config')
  const [configModal, setConfigModal] = useState(false)
  const [newConfig, setNewConfig] = useState({ item_id: '', method: 'average', standard_cost: '' })

  const { data: configs, isLoading: configsLoading } = useCostingConfigs()
  const { data: layers, isLoading: layersLoading } = useCostLayers()
  const { data: profitability, isLoading: profLoading } = useProfitabilityReport()
  const { data: auditTrail, isLoading: auditLoading } = useInventoryAuditTrail({ limit: 50 })
  const createConfig = useCreateCostingConfig()

  async function handleCreateConfig() {
    if (!newConfig.item_id || !newConfig.method) {
      toast('warning', 'Item and method are required')
      return
    }
    try {
      await createConfig.mutateAsync({
        item_id: newConfig.item_id,
        method: newConfig.method,
        standard_cost: newConfig.standard_cost ? parseFloat(newConfig.standard_cost) : undefined,
      })
      toast('success', 'Costing config created')
      setConfigModal(false)
    } catch {
      toast('error', 'Failed to create config')
    }
  }

  const TABS = [
    { id: 'config', label: 'Costing Config' },
    { id: 'layers', label: 'Cost Layers' },
    { id: 'profitability', label: 'Profitability' },
    { id: 'audit', label: 'Audit Trail' },
  ]

  const configColumns = [
    { key: 'item_name', label: 'Item', render: (row: CostingConfig) => <span className="font-medium">{row.item_name ?? row.item_id}</span> },
    { key: 'method', label: 'Method', render: (row: CostingConfig) => <Badge variant={METHOD_COLORS[row.method] ?? 'default'}>{row.method.toUpperCase()}</Badge> },
    { key: 'standard_cost', label: 'Standard Cost', render: (row: CostingConfig) => row.standard_cost ? `$${row.standard_cost}` : <span className="text-gray-400">—</span> },
  ]

  const layerColumns = [
    { key: 'item_name', label: 'Item', render: (row: CostLayer) => <span className="font-medium">{row.item_name ?? row.item_id}</span> },
    { key: 'receipt_date', label: 'Receipt Date', render: (row: CostLayer) => new Date(row.receipt_date).toLocaleDateString() },
    { key: 'quantity_received', label: 'Received' },
    { key: 'quantity_remaining', label: 'Remaining', render: (row: CostLayer) => <span className={row.quantity_remaining === 0 ? 'text-gray-400' : 'font-medium'}>{row.quantity_remaining}</span> },
    { key: 'unit_cost', label: 'Unit Cost', render: (row: CostLayer) => `$${row.unit_cost}` },
    { key: 'total_value', label: 'Layer Value', render: (row: CostLayer) => `$${(row.quantity_remaining * Number(row.unit_cost)).toFixed(2)}` },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventory Costing</h1>
          <p className="text-sm text-gray-500 mt-1">FIFO/LIFO/Average costing, profitability, and audit trail</p>
        </div>
        {activeTab === 'config' && <Button onClick={() => setConfigModal(true)}>Add Config</Button>}
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-[10px] mb-6 w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium rounded-[8px] transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <Card padding={false}>
          <Table<CostingConfig> columns={configColumns} data={configs ?? []} loading={configsLoading} emptyText="No costing configs. Default method is average cost." keyExtractor={(row) => row.id} />
        </Card>
      )}

      {activeTab === 'layers' && (
        <Card padding={false}>
          <Table<CostLayer> columns={layerColumns} data={layers ?? []} loading={layersLoading} emptyText="No cost layers found." keyExtractor={(row) => row.id} />
        </Card>
      )}

      {activeTab === 'profitability' && (
        <Card padding={false}>
          <Table
            columns={[
              { key: 'name', label: 'Item', render: (row: any) => <span className="font-medium">{row.name}</span> },
              { key: 'sku', label: 'SKU', render: (row: any) => <span className="font-mono text-sm">{row.sku}</span> },
              { key: 'cost_price', label: 'Cost', render: (row: any) => `$${row.cost_price}` },
              { key: 'selling_price', label: 'Selling', render: (row: any) => `$${row.selling_price}` },
              { key: 'margin', label: 'Margin', render: (row: any) => <span className={row.margin >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>${row.margin}</span> },
              { key: 'margin_pct', label: 'Margin %', render: (row: any) => <Badge variant={row.margin_pct >= 30 ? 'success' : row.margin_pct >= 10 ? 'warning' : 'danger'}>{row.margin_pct}%</Badge> },
            ]}
            data={profitability ?? []}
            loading={profLoading}
            emptyText="No items to analyze."
            keyExtractor={(row: any) => row.item_id}
          />
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card padding={false}>
          <Table
            columns={[
              { key: 'entity_type', label: 'Entity', render: (row: any) => <Badge variant="info">{row.entity_type}</Badge> },
              { key: 'field_name', label: 'Field' },
              { key: 'old_value', label: 'Old', render: (row: any) => <span className="text-red-600 font-mono text-xs">{row.old_value ?? '—'}</span> },
              { key: 'new_value', label: 'New', render: (row: any) => <span className="text-green-600 font-mono text-xs">{row.new_value ?? '—'}</span> },
              { key: 'changed_at', label: 'When', render: (row: any) => new Date(row.changed_at).toLocaleString() },
            ]}
            data={auditTrail ?? []}
            loading={auditLoading}
            emptyText="No audit entries."
            keyExtractor={(row: any) => row.id}
          />
        </Card>
      )}

      <Modal open={configModal} onClose={() => setConfigModal(false)} title="Add Costing Config" size="sm">
        <div className="space-y-4">
          <Select label="Method *" options={[{ value: 'average', label: 'Average Cost' }, { value: 'fifo', label: 'FIFO' }, { value: 'lifo', label: 'LIFO' }, { value: 'standard', label: 'Standard Cost' }, { value: 'specific', label: 'Specific Identification' }]} value={newConfig.method} onChange={(e) => setNewConfig({ ...newConfig, method: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setConfigModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateConfig} loading={createConfig.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
