import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table } from '../../components/ui'
import {
  useEcomProducts,
  useDeleteProduct,
  usePublishProduct,
  exportProductsCSV,
  type EcomProduct,
} from '../../api/ecommerce'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [publishFilter, setPublishFilter] = useState<boolean | undefined>(undefined)

  const { data, isLoading } = useEcomProducts({
    search: search || undefined,
    is_published: publishFilter,
    page,
    limit: 20,
  })
  const deleteProduct = useDeleteProduct()
  const publishProduct = usePublishProduct()

  const togglePublish = async (product: EcomProduct) => {
    await publishProduct.mutateAsync(product.id)
  }

  const handleExportCSV = async () => {
    try {
      await exportProductsCSV()
    } catch {
      // export failed silently
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct.mutateAsync(id)
    }
  }

  const columns = [
    {
      key: 'display_name',
      label: 'Product',
      render: (row: EcomProduct) => (
        <div className="flex items-center gap-2">
          <button
            className="text-primary font-medium hover:underline text-left"
            onClick={() => navigate(`/ecommerce/products/${row.id}/edit`)}
          >
            {row.display_name}
          </button>
          <Badge variant={row.is_published ? 'success' : 'default'} className="text-[10px]">
            {row.is_published ? 'Published' : 'Draft'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'slug',
      label: 'Slug',
      render: (row: EcomProduct) => <span className="text-gray-500 text-sm">{row.slug}</span>,
    },
    {
      key: 'price',
      label: 'Price',
      render: (row: EcomProduct) => (
        <div>
          <span className="font-medium text-gray-900">{formatCurrency(row.price)}</span>
          {row.compare_at_price && (
            <span className="text-gray-400 text-xs line-through ml-2">
              {formatCurrency(row.compare_at_price)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'is_published',
      label: 'Status',
      render: (row: EcomProduct) => (
        <button onClick={() => togglePublish(row)}>
          <Badge variant={row.is_published ? 'success' : 'default'}>
            {row.is_published ? 'Published' : 'Draft'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: EcomProduct) => <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row: EcomProduct) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => togglePublish(row)}>
            {row.is_published ? 'Unpublish' : 'Publish'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/ecommerce/products/${row.id}/edit`)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(row.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} products total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </Button>
          <Button onClick={() => navigate('/ecommerce/products/new')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4 sm:mb-6">
        <input
          type="text"
          placeholder="Search products..."
          className="border border-gray-200 rounded-[10px] px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <select
          className="border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={publishFilter === undefined ? '' : String(publishFilter)}
          onChange={(e) => {
            const val = e.target.value
            setPublishFilter(val === '' ? undefined : val === 'true')
            setPage(1)
          }}
        >
          <option value="">All Status</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
      </div>

      {/* Products Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <Table<EcomProduct>
            columns={columns}
            data={data?.products ?? []}
            loading={isLoading}
            emptyText="No products found"
            keyExtractor={(row) => row.id}
          />
        </div>
      </Card>

      {/* Pagination */}
      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
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
