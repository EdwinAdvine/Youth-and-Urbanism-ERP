import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table } from '../../components/ui'
import { useEcomDashboard, type EcomOrder } from '../../api/ecommerce'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'primary',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

export default function EcommerceDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading } = useEcomDashboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(stats?.total_revenue ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Total Orders',
      value: String(stats?.total_orders ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Pending Orders',
      value: String(stats?.pending_orders ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-orange-600 bg-orange-50',
    },
    {
      label: 'Customers',
      value: String(stats?.total_customers ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'text-purple-600 bg-purple-50',
    },
  ]

  const orderColumns = [
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
        <span className="text-gray-600">{row.customer_name || row.customer_email || '-'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: EcomOrder) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status}
        </Badge>
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
      key: 'created_at',
      label: 'Date',
      render: (row: EcomOrder) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Commerce</h1>
          <p className="text-sm text-gray-500 mt-1">Manage stores, products, orders, and customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/ecommerce/products/new')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'Stores', path: '/ecommerce/stores' },
          { label: 'Products', path: '/ecommerce/products' },
          { label: 'Orders', path: '/ecommerce/orders' },
          { label: 'Customers', path: '/ecommerce/customers' },
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
                <p className="text-lg font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Two-column: Products summary + Top sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Products summary */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Products Overview</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-700">Total Products</span>
              <Badge variant="primary">{stats?.total_products ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-700">Published</span>
              <Badge variant="success">{stats?.published_products ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-700">Shipped Orders</span>
              <Badge variant="info">{stats?.shipped_orders ?? 0}</Badge>
            </div>
          </div>
        </Card>

        {/* Top products */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Top Selling Products</h2>
          <div className="space-y-3">
            {(stats?.top_products ?? []).map((p, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-gray-700">{p.name}</span>
                <span className="text-sm text-gray-500">{p.sold} sold</span>
              </div>
            ))}
            {(stats?.top_products ?? []).length === 0 && (
              <p className="text-sm text-gray-400">No sales data yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/ecommerce/orders')}>
            View All
          </Button>
        </div>
        <Table<EcomOrder>
          columns={orderColumns}
          data={stats?.recent_orders ?? []}
          loading={false}
          emptyText="No orders yet"
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  )
}
