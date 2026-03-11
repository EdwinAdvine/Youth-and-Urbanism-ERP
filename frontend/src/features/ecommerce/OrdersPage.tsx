import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Badge, Spinner, Table } from '../../components/ui'
import {
  useEcomOrders,
  useUpdateOrderStatus,
  type EcomOrder,
} from '../../api/ecommerce'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']

const STATUS_BADGE: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger' | 'primary'> = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'primary',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

// ---- Mobile Order Card ----

function OrderCard({
  order,
  onStatusChange,
  onView,
}: {
  order: EcomOrder
  onStatusChange: (newStatus: string) => void
  onView: () => void
}) {
  return (
    <div className="bg-white rounded-[10px] border border-gray-200 overflow-hidden">
      {/* Swipe hint line */}
      <div className={`h-1 ${
        order.status === 'delivered' ? 'bg-green-500' :
        order.status === 'cancelled' ? 'bg-red-500' :
        order.status === 'shipped' ? 'bg-blue-500' :
        'bg-yellow-500'
      }`} />
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <button
              onClick={onView}
              className="text-sm font-bold text-primary hover:underline active:opacity-70"
            >
              {order.order_number}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
          </div>
          <Badge variant={STATUS_BADGE[order.status] ?? 'default'} className="shrink-0">
            {order.status}
          </Badge>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Customer</span>
            <span className="text-gray-900 font-medium truncate ml-4">{order.customer_name || 'Guest'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="text-gray-900 font-bold">{formatCurrency(order.total)}</span>
          </div>
          {order.tracking_number && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tracking</span>
              <span className="text-gray-600 font-mono text-xs">{order.tracking_number}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <select
            className="flex-1 min-h-[44px] border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white"
            value={order.status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] px-4"
            onClick={onView}
          >
            View
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useEcomOrders({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
    limit: 20,
  })
  const updateStatus = useUpdateOrderStatus()

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    await updateStatus.mutateAsync({ id: orderId, status: newStatus })
  }

  const columns = [
    {
      key: 'order_number',
      label: 'Order',
      render: (row: EcomOrder) => (
        <button
          className="text-primary font-medium hover:underline"
          onClick={() => navigate(`/ecommerce/orders/${row.id}`)}
        >
          {row.order_number}
        </button>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: EcomOrder) => (
        <div>
          <span className="text-gray-700 text-sm">{row.customer_name || '-'}</span>
          {row.customer_email && (
            <span className="text-gray-400 text-xs block">{row.customer_email}</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: EcomOrder) => (
        <select
          className="border border-gray-200 rounded-[10px] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={row.status}
          onChange={(e) => handleStatusChange(row.id, e.target.value)}
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: EcomOrder) => (
        <span className="font-medium text-gray-900">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'tracking_number',
      label: 'Tracking',
      render: (row: EcomOrder) => (
        <span className="text-gray-500 text-sm">{row.tracking_number || '-'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (row: EcomOrder) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: EcomOrder) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/ecommerce/orders/${row.id}`)}>
          View
        </Button>
      ),
    },
  ]

  const orders = data?.orders ?? []

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5 md:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} orders total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-5 md:mb-6">
        <input
          type="text"
          placeholder="Search orders..."
          className="min-h-[44px] border border-gray-200 rounded-[10px] px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        {/* Status filter pills on mobile, dropdown on desktop */}
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 sm:hidden">
          <button
            onClick={() => { setStatusFilter(''); setPage(1) }}
            className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-medium shrink-0 transition-colors active:scale-95 ${
              !statusFilter ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            All
          </button>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-medium shrink-0 transition-colors active:scale-95 ${
                statusFilter === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select
          className="hidden sm:block min-h-[44px] border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-400">No orders found</div>
        </Card>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="sm:hidden space-y-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={(status) => handleStatusChange(order.id, status)}
                onView={() => navigate(`/ecommerce/orders/${order.id}`)}
              />
            ))}
          </div>

          {/* Desktop table layout */}
          <Card padding={false} className="hidden sm:block">
            <div className="overflow-x-auto">
              <Table<EcomOrder>
                columns={columns}
                data={orders}
                loading={false}
                emptyText="No orders found"
                keyExtractor={(row) => row.id}
              />
            </div>
          </Card>
        </>
      )}

      {/* Pagination */}
      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} className="min-h-[44px]">
            Previous
          </Button>
          <span className="px-3 py-1.5 text-sm text-gray-600 flex items-center">
            Page {page} of {Math.ceil((data?.total ?? 0) / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil((data?.total ?? 0) / 20)}
            onClick={() => setPage(page + 1)}
            className="min-h-[44px]"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
