import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Table, Modal, Badge, Spinner } from '../../components/ui'
import apiClient from '@/api/client'

interface TransportOrder {
  id: string
  reference: string
  carrier_name: string
  status: string
  origin: string
  destination: string
  estimated_delivery: string | null
  actual_delivery: string | null
}

interface TrackingEvent {
  id: string
  status: string
  location: string
  description: string
  timestamp: string
}

const STATUS_TABS = ['all', 'draft', 'confirmed', 'in_transit', 'delivered']

const statusVariant: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  draft: 'default',
  confirmed: 'warning',
  in_transit: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

export default function TransportOrdersPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sc', 'transport-orders', activeTab],
    queryFn: () =>
      apiClient
        .get('/supply-chain/logistics/transport-orders', {
          params: activeTab !== 'all' ? { status: activeTab } : {},
        })
        .then((r) => r.data),
  })

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['sc', 'transport-order-events', selectedId],
    queryFn: () =>
      apiClient
        .get(`/supply-chain/logistics/transport-orders/${selectedId}/events`)
        .then((r) => r.data),
    enabled: !!selectedId,
  })

  const orders: TransportOrder[] = data?.items ?? data ?? []
  const selectedOrder = orders.find((o) => o.id === selectedId)

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (r: TransportOrder) => (
        <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{r.reference}</span>
      ),
    },
    {
      key: 'carrier',
      label: 'Carrier',
      render: (r: TransportOrder) => <span className="text-sm">{r.carrier_name || '-'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: TransportOrder) => (
        <Badge variant={statusVariant[r.status] ?? 'default'}>{r.status.replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      key: 'route',
      label: 'Route',
      render: (r: TransportOrder) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {r.origin} → {r.destination}
        </span>
      ),
    },
    {
      key: 'eta',
      label: 'Est. Delivery',
      render: (r: TransportOrder) => (
        <span className="text-sm text-gray-500">
          {r.estimated_delivery ? new Date(r.estimated_delivery).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: TransportOrder) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedId(r.id)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Transport Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track transport orders</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={orders}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No transport orders found"
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={selectedOrder ? `Order: ${selectedOrder.reference}` : 'Transport Order'}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Carrier:</span>{' '}
                <span className="font-medium">{selectedOrder.carrier_name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>{' '}
                <Badge variant={statusVariant[selectedOrder.status] ?? 'default'}>
                  {selectedOrder.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div>
                <span className="text-gray-500">Origin:</span>{' '}
                <span className="font-medium">{selectedOrder.origin}</span>
              </div>
              <div>
                <span className="text-gray-500">Destination:</span>{' '}
                <span className="font-medium">{selectedOrder.destination}</span>
              </div>
              <div>
                <span className="text-gray-500">Est. Delivery:</span>{' '}
                <span className="font-medium">
                  {selectedOrder.estimated_delivery
                    ? new Date(selectedOrder.estimated_delivery).toLocaleDateString()
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Actual Delivery:</span>{' '}
                <span className="font-medium">
                  {selectedOrder.actual_delivery
                    ? new Date(selectedOrder.actual_delivery).toLocaleDateString()
                    : '-'}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Tracking Events
              </h3>
              {eventsLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : !events || events.length === 0 ? (
                <p className="text-center text-gray-400 py-4 text-sm">No tracking events yet</p>
              ) : (
                <div className="relative pl-8">
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                  {(events as TrackingEvent[]).map((ev, i) => (
                    <div key={ev.id} className="relative pb-5 last:pb-0">
                      <div
                        className={`absolute left-[-1.25rem] w-3 h-3 rounded-full border-2 ${
                          i === 0
                            ? 'bg-primary border-primary'
                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {ev.status}
                        </p>
                        {ev.location && <p className="text-xs text-gray-500">{ev.location}</p>}
                        <p className="text-xs text-gray-400">{ev.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(ev.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
