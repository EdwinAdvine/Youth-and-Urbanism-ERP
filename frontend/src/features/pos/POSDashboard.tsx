import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table, Modal, Input, toast } from '../../components/ui'
import {
  usePOSDashboardStats,
  usePOSTransactions,
  useActiveSession,
  type POSTransactionData,
} from '../../api/pos'
import { useSyncFromEcommerce } from '../../api/pos_ext'
import { useWarehouses } from '../../api/inventory'

function formatCurrency(amount: number | string) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  completed: 'success',
  refunded: 'warning',
  voided: 'danger',
}

export default function POSDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = usePOSDashboardStats()
  const { data: transactions, isLoading: txnLoading } = usePOSTransactions({ limit: 10 })
  const { data: activeSession } = useActiveSession()

  // E-Commerce sync
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [syncWarehouseId, setSyncWarehouseId] = useState('')
  const { data: warehouses } = useWarehouses()
  const syncFromEcommerce = useSyncFromEcommerce()

  const handleSync = async () => {
    if (!syncWarehouseId) {
      toast('error', 'Please select a warehouse')
      return
    }
    try {
      const result = await syncFromEcommerce.mutateAsync({ warehouse_id: syncWarehouseId })
      toast('success', `Synced ${result.synced} products (${result.skipped} skipped)`)
      setShowSyncModal(false)
    } catch {
      toast('error', 'Failed to sync products from E-Commerce')
    }
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const statCards = [
    {
      label: "Today's Sales",
      value: formatCurrency(stats?.today_sales_total ?? '0'),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Transactions',
      value: String(stats?.today_sales_count ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      color: 'text-primary bg-primary/10',
    },
    {
      label: 'Avg. Sale',
      value: formatCurrency(stats?.today_avg_sale ?? '0'),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Session',
      value: activeSession ? 'Active' : 'Closed',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      color: activeSession ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-50',
    },
  ]

  const txnColumns = [
    {
      key: 'transaction_number',
      label: 'TXN #',
      render: (row: POSTransactionData) => (
        <span className="font-medium text-primary">{row.transaction_number}</span>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: POSTransactionData) => (
        <span className="text-gray-700 dark:text-gray-300">{row.customer_name || 'Walk-in'}</span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: POSTransactionData) => (
        <span className="font-semibold">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: POSTransactionData) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>{row.status}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Time',
      render: (row: POSTransactionData) => (
        <span className="text-gray-500 text-sm">{formatTime(row.created_at)}</span>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Point of Sale</h1>
          <p className="text-sm text-gray-500 mt-1">Sales terminal and session management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSyncModal(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync from E-Commerce
          </Button>
          <Button variant="outline" onClick={() => navigate('/pos/sessions')}>
            Sessions
          </Button>
          <Button onClick={() => navigate('/pos/terminal')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Open Terminal
          </Button>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'POS Terminal', path: '/pos/terminal' },
          { label: 'Sessions', path: '/pos/sessions' },
        ].map((item) => (
          <Button key={item.path} variant="outline" size="sm" onClick={() => navigate(item.path)}>
            {item.label}
          </Button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-start gap-4">
              <div className={cn('p-3 rounded-[10px]', stat.color)}>
                {stat.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate mt-1">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card padding={false}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Transactions</h2>
          </div>
          <Table<POSTransactionData>
            columns={txnColumns}
            data={transactions?.transactions?.slice(0, 8) ?? []}
            loading={txnLoading}
            emptyText="No transactions yet"
            keyExtractor={(row) => row.id}
          />
        </Card>

        {/* Top Products */}
        <Card padding={false}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Top Products Today</h2>
          </div>
          <div className="p-4">
            {(stats?.top_products ?? []).length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No sales today yet</p>
            ) : (
              <div className="space-y-3">
                {stats?.top_products.map((product, i) => (
                  <div
                    key={product.item_sku}
                    className="flex items-center gap-3 p-3 rounded-[10px] bg-gray-50 dark:bg-gray-950"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.item_name}</p>
                      <p className="text-xs text-gray-500">{product.item_sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{product.quantity_sold} sold</p>
                      <p className="text-xs text-gray-500">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Sync from E-Commerce Modal */}
      {showSyncModal && (
        <Modal
          open={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          title="Sync Products from E-Commerce"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Import your e-commerce product catalog into the POS system. Products will be created
              as inventory items in the selected warehouse.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Warehouse
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                value={syncWarehouseId}
                onChange={(e) => setSyncWarehouseId(e.target.value)}
              >
                <option value="">Select a warehouse...</option>
                {(warehouses ?? []).map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}{wh.location ? ` (${wh.location})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setShowSyncModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSync}
                loading={syncFromEcommerce.isPending}
                disabled={!syncWarehouseId}
              >
                Sync Products
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
