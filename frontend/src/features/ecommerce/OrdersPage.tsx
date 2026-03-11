import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Table } from '../../components/ui'
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} orders total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search orders..."
          className="border border-gray-200 rounded-[10px] px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <select
          className="border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
      <Card padding={false}>
        <Table<EcomOrder>
          columns={columns}
          data={data?.orders ?? []}
          loading={isLoading}
          emptyText="No orders found"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Pagination */}
      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            Page {page} of {Math.ceil((data?.total ?? 0) / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil((data?.total ?? 0) / 20)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
