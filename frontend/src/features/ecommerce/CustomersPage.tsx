import { useState } from 'react'
import { Button, Spinner, Badge, Card, Table } from '../../components/ui'
import {
  useEcomCustomers,
  useEcomCustomer,
  type EcomCustomer,
} from '../../api/ecommerce'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)

  const { data, isLoading } = useEcomCustomers({
    search: search || undefined,
    page,
    limit: 20,
  })

  const columns = [
    {
      key: 'name',
      label: 'Customer',
      render: (row: EcomCustomer) => (
        <div>
          <span className="font-medium text-gray-900">
            {[row.first_name, row.last_name].filter(Boolean).join(' ') || '-'}
          </span>
          <span className="text-gray-400 text-xs block">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (row: EcomCustomer) => <span className="text-gray-600 text-sm">{row.phone || '-'}</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: EcomCustomer) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'order_count',
      label: 'Orders',
      render: (row: EcomCustomer) => (
        <span className="text-gray-700">{row.order_count ?? '-'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (row: EcomCustomer) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: EcomCustomer) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedCustomer(selectedCustomer === row.id ? null : row.id)}
        >
          {selectedCustomer === row.id ? 'Hide' : 'Details'}
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} customers total</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search customers..."
          className="border border-gray-200 rounded-[10px] px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {/* Customers Table */}
      <Card padding={false}>
        <Table<EcomCustomer>
          columns={columns}
          data={data?.customers ?? []}
          loading={isLoading}
          emptyText="No customers found"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Customer Detail Panel */}
      {selectedCustomer && (
        <CustomerDetailPanel customerId={selectedCustomer} />
      )}

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

function CustomerDetailPanel({ customerId }: { customerId: string }) {
  const { data: customer, isLoading } = useEcomCustomer(customerId)

  if (isLoading) {
    return (
      <Card className="mt-4">
        <div className="flex items-center justify-center py-6">
          <Spinner />
        </div>
      </Card>
    )
  }

  if (!customer) return null

  return (
    <Card className="mt-4">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Customer Details - {[customer.first_name, customer.last_name].filter(Boolean).join(' ')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Contact Info</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p>Email: {customer.email}</p>
            <p>Phone: {customer.phone || '-'}</p>
            <p>Total Orders: {customer.order_count ?? 0}</p>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Addresses</h3>
          {(customer.addresses ?? []).length > 0 ? (
            <div className="space-y-3">
              {customer.addresses!.map((addr: any) => (
                <div key={addr.id} className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
                  {addr.label && <p className="font-medium">{addr.label}</p>}
                  <p>{addr.address_line1}</p>
                  {addr.address_line2 && <p>{addr.address_line2}</p>}
                  <p>{addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.postal_code}</p>
                  <p>{addr.country}</p>
                  {addr.is_default && <Badge variant="primary" className="mt-1">Default</Badge>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No saved addresses</p>
          )}
        </div>
      </div>
    </Card>
  )
}
