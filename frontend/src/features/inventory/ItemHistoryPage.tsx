import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Spinner, Table, Select, Badge } from '../../components/ui'
import {
  useInventoryItems,
  useInventoryItem,
  useItemHistory,
  type StockMovement,
} from '../../api/inventory'

const movementVariant: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  in: 'success',
  out: 'danger',
  receipt: 'success',
  issue: 'danger',
  adjustment: 'warning',
  transfer: 'info',
  transfer_in: 'info',
  transfer_out: 'warning',
  return: 'default',
}

export default function ItemHistoryPage() {
  const { itemId: routeItemId } = useParams<{ itemId: string }>()
  const [selectedItemId, setSelectedItemId] = useState(routeItemId ?? '')
  const activeItemId = routeItemId || selectedItemId

  const { data: itemsData, isLoading: itemsLoading } = useInventoryItems({ limit: 500 })
  const { data: item } = useInventoryItem(activeItemId)
  const { data: movements, isLoading: historyLoading } = useItemHistory(activeItemId)

  const columns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (row: StockMovement) => (
        <div>
          <div className="text-sm">{new Date(row.created_at).toLocaleDateString()}</div>
          <div className="text-xs text-gray-400">{new Date(row.created_at).toLocaleTimeString()}</div>
        </div>
      ),
    },
    {
      key: 'movement_type',
      label: 'Type',
      render: (row: StockMovement) => (
        <Badge variant={movementVariant[row.movement_type] ?? 'default'}>
          {row.movement_type.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (row: StockMovement) => <span className="font-medium text-gray-900">{row.quantity}</span>,
    },
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      render: (row: StockMovement) => row.warehouse_name ?? row.warehouse_id,
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (row: StockMovement) => {
        if (!row.reference_type && !row.reference_id) return <span className="text-gray-400">&mdash;</span>
        return (
          <span className="text-sm">
            {row.reference_type && <Badge variant="default">{row.reference_type}</Badge>}
            {row.reference_id && <span className="ml-1 text-gray-500">{row.reference_id.slice(0, 8)}</span>}
          </span>
        )
      },
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (row: StockMovement) => row.notes ? <span className="text-sm text-gray-600 truncate max-w-xs block">{row.notes}</span> : <span className="text-gray-400">&mdash;</span>,
    },
  ]

  if (itemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Item History</h1>
        <p className="text-sm text-gray-500 mt-1">Stock movement history for a specific item</p>
      </div>

      {/* Item selector (shown when no itemId in URL) */}
      {!routeItemId && (
        <Select
          label="Select Item"
          options={[
            { value: '', label: 'Choose an item...' },
            ...(itemsData?.items?.map((i) => ({ value: i.id, label: `${i.sku} - ${i.name}` })) ?? []),
          ]}
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
          className="w-80"
        />
      )}

      {/* Item info card */}
      {item && (
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[10px] bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {item.name[0]}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{item.name}</h3>
              <p className="text-sm text-gray-500">
                SKU: {item.sku}
                {item.category && <> &middot; Category: {item.category}</>}
                &middot; UOM: {item.unit_of_measure}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Movements</p>
              <p className="text-2xl font-bold text-gray-900">{movements?.length ?? 0}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Movements table */}
      {!activeItemId ? (
        <Card>
          <div className="text-center py-12 text-gray-400">
            Select an item to view its movement history
          </div>
        </Card>
      ) : historyLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card padding={false}>
          <Table<StockMovement>
            columns={columns}
            data={movements ?? []}
            emptyText="No movement history for this item"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}
    </div>
  )
}
