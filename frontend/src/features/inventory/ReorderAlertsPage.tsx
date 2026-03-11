import { useNavigate } from 'react-router-dom'
import { Button, Spinner, Badge, Card, Table } from '../../components/ui'
import { useReorderAlerts, type ReorderAlert } from '../../api/inventory'

export default function ReorderAlertsPage() {
  const navigate = useNavigate()
  const { data: alerts, isLoading } = useReorderAlerts()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const columns = [
    {
      key: 'name',
      label: 'Item Name',
      render: (row: ReorderAlert) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    { key: 'sku', label: 'SKU' },
    {
      key: 'category',
      label: 'Category',
      render: (row: ReorderAlert) => row.category ?? <span className="text-gray-400">—</span>,
    },
    {
      key: 'reorder_level',
      label: 'Reorder Level',
      render: (row: ReorderAlert) => <span className="font-medium">{row.reorder_level}</span>,
    },
    {
      key: 'quantity_on_hand',
      label: 'On Hand',
      render: (row: ReorderAlert) => (
        <span className="font-semibold text-red-600">{row.quantity_on_hand}</span>
      ),
    },
    {
      key: 'shortfall',
      label: 'Shortfall',
      render: (row: ReorderAlert) => (
        <span className="font-bold text-red-700">{row.shortfall}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_row: ReorderAlert) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/inventory/purchase-orders')}
        >
          Create PO
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reorder Alerts</h1>
            <p className="text-sm text-gray-500 mt-1">Items at or below their reorder level</p>
          </div>
          {(alerts?.length ?? 0) > 0 && (
            <Badge variant="danger" className="text-sm px-3 py-1">
              {alerts?.length} {alerts?.length === 1 ? 'alert' : 'alerts'}
            </Badge>
          )}
        </div>
        <Button onClick={() => navigate('/inventory/purchase-orders')}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Purchase Order
        </Button>
      </div>

      {(alerts?.length ?? 0) === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900">All stocked up!</h3>
            <p className="text-sm text-gray-500 mt-1">No items are currently at or below their reorder level.</p>
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          <Table<ReorderAlert>
            columns={columns}
            data={alerts ?? []}
            loading={isLoading}
            emptyText="No reorder alerts"
            keyExtractor={(row) => row.item_id}
          />
        </Card>
      )}
    </div>
  )
}
