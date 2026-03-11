import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table } from '../../components/ui'
import {
  useEcomOrder,
  useUpdateOrderStatus,
  type EcomOrderLine,
} from '../../api/ecommerce'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'primary',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']

const STATUS_TIMELINE = [
  { key: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { key: 'confirmed', label: 'Confirmed', color: 'bg-blue-500' },
  { key: 'processing', label: 'Processing', color: 'bg-purple-500' },
  { key: 'shipped', label: 'Shipped', color: 'bg-indigo-500' },
  { key: 'delivered', label: 'Delivered', color: 'bg-green-500' },
]

export default function OrderDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data: order, isLoading } = useEcomOrder(id || '')
  const updateStatus = useUpdateOrderStatus()

  const [trackingNumber, setTrackingNumber] = useState('')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-6 text-center text-gray-500">Order not found</div>
    )
  }

  const handleStatusUpdate = async (newStatus: string) => {
    await updateStatus.mutateAsync({
      id: order.id,
      status: newStatus,
      tracking_number: trackingNumber || undefined,
    })
  }

  const currentStatusIdx = ORDER_STATUSES.indexOf(order.status)

  const lineColumns = [
    {
      key: 'product_name',
      label: 'Product',
      render: (row: EcomOrderLine) => <span className="font-medium text-gray-900">{row.product_name}</span>,
    },
    {
      key: 'quantity',
      label: 'Qty',
      render: (row: EcomOrderLine) => <span className="text-gray-700">{row.quantity}</span>,
    },
    {
      key: 'unit_price',
      label: 'Unit Price',
      render: (row: EcomOrderLine) => <span className="text-gray-700">{formatCurrency(row.unit_price)}</span>,
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: EcomOrderLine) => <span className="font-medium text-gray-900">{formatCurrency(row.total)}</span>,
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order {order.order_number}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Placed on {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={STATUS_BADGE[order.status] ?? 'default'} className="text-sm px-3 py-1">
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
          <Button variant="ghost" onClick={() => navigate('/ecommerce/orders')}>
            Back
          </Button>
        </div>
      </div>

      {/* Status Timeline */}
      {order.status !== 'cancelled' && (
        <Card className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Order Progress</h2>
          <div className="flex items-center justify-between">
            {STATUS_TIMELINE.map((step, idx) => {
              const isActive = ORDER_STATUSES.indexOf(step.key) <= currentStatusIdx
              const isCurrent = step.key === order.status
              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                      isActive
                        ? `${step.color} text-white`
                        : 'bg-gray-200 text-gray-400'
                    )}
                  >
                    {isActive ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs mt-1',
                      isCurrent ? 'font-semibold text-gray-900' : 'text-gray-400'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Customer Info */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Customer</h2>
          <div className="space-y-2 text-sm">
            <p className="text-gray-700">{order.customer_name || '-'}</p>
            <p className="text-gray-500">{order.customer_email || '-'}</p>
          </div>
        </Card>

        {/* Shipping Address */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Shipping Address</h2>
          {order.shipping_address ? (
            <div className="space-y-1 text-sm text-gray-600">
              <p>{order.shipping_address.address_line1}</p>
              {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
              <p>{order.shipping_address.city}{order.shipping_address.state ? `, ${order.shipping_address.state}` : ''}</p>
              <p>{order.shipping_address.postal_code} {order.shipping_address.country}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No address provided</p>
          )}
        </Card>

        {/* Order Summary */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax</span>
              <span className="text-gray-700">{formatCurrency(order.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Shipping</span>
              <span className="text-gray-700">{formatCurrency(order.shipping_cost)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Order Lines */}
      <Card padding={false} className="mb-6">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Order Items</h2>
        </div>
        <Table<EcomOrderLine>
          columns={lineColumns}
          data={order.lines ?? []}
          loading={false}
          emptyText="No items"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Status Update */}
      {order.status !== 'delivered' && order.status !== 'cancelled' && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Update Order</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
              <input
                type="text"
                className="border border-gray-200 rounded-[10px] px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number..."
              />
            </div>
            <div className="flex gap-2">
              {currentStatusIdx < ORDER_STATUSES.length - 2 && (
                <Button
                  onClick={() => handleStatusUpdate(ORDER_STATUSES[currentStatusIdx + 1])}
                  loading={updateStatus.isPending}
                >
                  Mark as {ORDER_STATUSES[currentStatusIdx + 1].charAt(0).toUpperCase() + ORDER_STATUSES[currentStatusIdx + 1].slice(1)}
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => handleStatusUpdate('cancelled')}
                loading={updateStatus.isPending}
              >
                Cancel Order
              </Button>
            </div>
          </div>
          {order.tracking_number && (
            <p className="text-sm text-gray-500 mt-3">
              Current tracking: <span className="font-medium text-gray-700">{order.tracking_number}</span>
            </p>
          )}
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card className="mt-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-600">{order.notes}</p>
        </Card>
      )}
    </div>
  )
}
