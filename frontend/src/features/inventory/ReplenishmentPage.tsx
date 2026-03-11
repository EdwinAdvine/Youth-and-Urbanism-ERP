import { useState } from 'react'
import { Button, Badge, Card, Table } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  usePurchaseSuggestions, useRunReplenishmentCheck, useAcceptSuggestion, useDismissSuggestion,
  useABCAnalysis, useCalculateABC, useOverstockAlerts,
  type PurchaseSuggestion, type ItemClassification,
} from '../../api/inventory'

const ABC_COLORS: Record<string, 'danger' | 'warning' | 'default'> = { A: 'danger', B: 'warning', C: 'default' }

export default function ReplenishmentPage() {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'abc' | 'overstock'>('suggestions')

  const { data: suggestions, isLoading: suggestionsLoading } = usePurchaseSuggestions('pending')
  const { data: abcData, isLoading: abcLoading } = useABCAnalysis()
  const { data: overstockAlerts } = useOverstockAlerts()
  const runCheck = useRunReplenishmentCheck()
  const acceptSuggestion = useAcceptSuggestion()
  const dismissSuggestion = useDismissSuggestion()
  const calculateABC = useCalculateABC()

  async function handleRunCheck() {
    try {
      const result = await runCheck.mutateAsync()
      toast('success', `Created ${result.suggestions_created} new suggestions`)
    } catch {
      toast('error', 'Failed to run replenishment check')
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptSuggestion.mutateAsync(id)
      toast('success', 'Suggestion accepted')
    } catch {
      toast('error', 'Failed to accept suggestion')
    }
  }

  async function handleDismiss(id: string) {
    try {
      await dismissSuggestion.mutateAsync(id)
      toast('success', 'Suggestion dismissed')
    } catch {
      toast('error', 'Failed to dismiss suggestion')
    }
  }

  async function handleCalculateABC() {
    try {
      const result = await calculateABC.mutateAsync()
      toast('success', `Classified ${result.classified} items`)
    } catch {
      toast('error', 'Failed to calculate ABC')
    }
  }

  const suggestionColumns = [
    { key: 'item_name', label: 'Item', render: (row: PurchaseSuggestion) => <span className="font-medium">{row.item_name ?? row.item_id}</span> },
    { key: 'warehouse_name', label: 'Warehouse', render: (row: PurchaseSuggestion) => row.warehouse_name ?? '—' },
    { key: 'suggested_qty', label: 'Suggested Qty', render: (row: PurchaseSuggestion) => <span className="font-semibold text-primary">{row.suggested_qty}</span> },
    { key: 'reason', label: 'Reason', render: (row: PurchaseSuggestion) => <span className="text-xs text-gray-500">{row.reason ?? '—'}</span> },
    {
      key: 'actions', label: '',
      render: (row: PurchaseSuggestion) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => handleAccept(row.id)}>Accept</Button>
          <Button size="sm" variant="ghost" className="text-gray-500" onClick={() => handleDismiss(row.id)}>Dismiss</Button>
        </div>
      ),
    },
  ]

  const abcColumns = [
    { key: 'item_name', label: 'Item', render: (row: ItemClassification) => row.item_name ?? row.item_id },
    { key: 'abc_class', label: 'ABC', render: (row: ItemClassification) => row.abc_class ? <Badge variant={ABC_COLORS[row.abc_class] ?? 'default'}>{row.abc_class}</Badge> : <span className="text-gray-400">—</span> },
    { key: 'combined_class', label: 'Combined', render: (row: ItemClassification) => row.combined_class ? <Badge variant="info">{row.combined_class}</Badge> : <span className="text-gray-400">—</span> },
    { key: 'annual_consumption_value', label: 'Annual Value', render: (row: ItemClassification) => `$${Number(row.annual_consumption_value).toLocaleString()}` },
  ]

  const TABS = [
    { id: 'suggestions', label: `Suggestions${suggestions && suggestions.length > 0 ? ` (${suggestions.length})` : ''}` },
    { id: 'abc', label: 'ABC Analysis' },
    { id: 'overstock', label: `Overstock${overstockAlerts && overstockAlerts.length > 0 ? ` (${overstockAlerts.length})` : ''}` },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Replenishment</h1>
          <p className="text-sm text-gray-500 mt-1">Purchase suggestions, ABC analysis, and overstock management</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'suggestions' && (
            <Button onClick={handleRunCheck} loading={runCheck.isPending} variant="outline">Run Check</Button>
          )}
          {activeTab === 'abc' && (
            <Button onClick={handleCalculateABC} loading={calculateABC.isPending} variant="outline">Calculate ABC</Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-[10px] mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium rounded-[8px] transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'suggestions' && (
        <Card padding={false}>
          <Table<PurchaseSuggestion>
            columns={suggestionColumns}
            data={suggestions ?? []}
            loading={suggestionsLoading}
            emptyText="No pending suggestions. Run a check to generate suggestions."
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      {activeTab === 'abc' && (
        <Card padding={false}>
          <Table<ItemClassification>
            columns={abcColumns}
            data={abcData ?? []}
            loading={abcLoading}
            emptyText="No classifications. Click Calculate ABC to analyze."
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      {activeTab === 'overstock' && (
        <Card padding={false}>
          <Table
            columns={[
              { key: 'item_name', label: 'Item', render: (row: any) => <span className="font-medium">{row.item_name}</span> },
              { key: 'sku', label: 'SKU', render: (row: any) => <span className="font-mono text-sm">{row.sku}</span> },
              { key: 'quantity_on_hand', label: 'On Hand' },
              { key: 'max_stock_level', label: 'Max Level' },
              { key: 'excess', label: 'Excess', render: (row: any) => <span className="font-semibold text-amber-600">{row.excess}</span> },
            ]}
            data={overstockAlerts ?? []}
            loading={false}
            emptyText="No overstock alerts."
            keyExtractor={(row: any) => row.item_id}
          />
        </Card>
      )}
    </div>
  )
}
