import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table } from '../../components/ui'
import {
  useInventoryStats,
  useReorderAlerts,
  useStockMovements,
  type ReorderAlert,
  type StockMovement,
} from '../../api/inventory'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const MOVEMENT_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning'> = {
  receipt: 'success',
  issue: 'danger',
  transfer: 'info',
  adjustment: 'warning',
}

export default function InventoryDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useInventoryStats()
  const { data: alerts, isLoading: alertsLoading } = useReorderAlerts()
  const { data: movements, isLoading: movementsLoading } = useStockMovements({ limit: 10 })

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Items',
      value: String(stats?.total_items ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'text-primary bg-primary/10',
      badge: null,
    },
    {
      label: 'Low Stock',
      value: String(stats?.low_stock_count ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: (stats?.low_stock_count ?? 0) > 0 ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50',
      badge: (stats?.low_stock_count ?? 0) > 0 ? 'danger' : null,
    },
    {
      label: 'Pending POs',
      value: String(stats?.pending_pos ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      color: 'text-orange-600 bg-orange-50',
      badge: null,
    },
    {
      label: 'Inventory Value',
      value: formatCurrency(stats?.total_inventory_value ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-600 bg-green-50',
      badge: null,
    },
  ]

  const alertColumns = [
    { key: 'name', label: 'Item' },
    { key: 'sku', label: 'SKU' },
    {
      key: 'quantity_on_hand',
      label: 'On Hand',
      render: (row: ReorderAlert) => <span className="font-medium text-red-600">{row.quantity_on_hand}</span>,
    },
    { key: 'reorder_level', label: 'Reorder Level' },
    {
      key: 'shortfall',
      label: 'Shortfall',
      render: (row: ReorderAlert) => <span className="font-semibold text-red-700">{row.shortfall}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (_row: ReorderAlert) => (
        <Button size="sm" variant="outline" onClick={() => navigate('/inventory/purchase-orders')}>
          Create PO
        </Button>
      ),
    },
  ]

  const movementColumns = [
    {
      key: 'movement_type',
      label: 'Type',
      render: (row: StockMovement) => (
        <Badge variant={MOVEMENT_BADGE[row.movement_type] ?? 'default'}>{row.movement_type}</Badge>
      ),
    },
    {
      key: 'item_name',
      label: 'Item',
      render: (row: StockMovement) => <span className="text-gray-700">{row.item_name ?? row.item_id}</span>,
    },
    {
      key: 'quantity',
      label: 'Qty',
      render: (row: StockMovement) => (
        <span className={cn('font-medium', row.movement_type === 'issue' ? 'text-red-600' : 'text-green-600')}>
          {row.movement_type === 'issue' ? '-' : '+'}{row.quantity}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (row: StockMovement) => formatDate(row.created_at),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Stock management and purchase orders</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/inventory/purchase-orders')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New PO
          </Button>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'Items', path: '/inventory/items' },
          { label: 'Warehouses', path: '/inventory/warehouses' },
          { label: 'Stock Movements', path: '/inventory/stock-movements' },
          { label: 'Purchase Orders', path: '/inventory/purchase-orders' },
          { label: 'Reorder Alerts', path: '/inventory/reorder-alerts' },
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
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-lg font-bold text-gray-900 truncate">{stat.value}</p>
                  {stat.badge === 'danger' && (
                    <Badge variant="danger">Alert</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Two-column grid: Reorder Alerts + Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reorder Alerts */}
        <Card padding={false}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">Reorder Alerts</h2>
              {(alerts?.length ?? 0) > 0 && (
                <Badge variant="danger">{alerts?.length}</Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/reorder-alerts')}>
              View All
            </Button>
          </div>
          <Table<ReorderAlert>
            columns={alertColumns}
            data={alerts?.slice(0, 5) ?? []}
            loading={alertsLoading}
            emptyText="No items below reorder level"
            keyExtractor={(row) => row.item_id}
          />
        </Card>

        {/* Recent Stock Movements */}
        <Card padding={false}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Recent Movements</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/stock-movements')}>
              View All
            </Button>
          </div>
          <Table<StockMovement>
            columns={movementColumns}
            data={movements?.items?.slice(0, 8) ?? []}
            loading={movementsLoading}
            emptyText="No stock movements yet"
            keyExtractor={(row) => row.id}
          />
        </Card>
      </div>
    </div>
  )
}
