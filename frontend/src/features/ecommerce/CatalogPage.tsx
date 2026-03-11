import { useState } from 'react'
import { Button, Card, Input, Badge, Spinner, toast } from '../../components/ui'
import { useEcomProducts, type EcomProduct } from '../../api/ecommerce'
import { useAddToCart } from '../../api/ecommerce_ext'

export default function CatalogPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [priceRange, setPriceRange] = useState<'all' | 'under25' | '25to50' | '50to100' | 'over100'>('all')
  const limit = 12

  const { data, isLoading, error } = useEcomProducts({
    search: search || undefined,
    is_published: true,
    page,
    limit,
  })
  const addToCart = useAddToCart()

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart.mutateAsync({ product_id: productId, quantity: 1 })
      toast('success', 'Added to cart')
    } catch {
      toast('error', 'Failed to add to cart')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load products</div>

  let products = data?.products ?? []
  const total = data?.total ?? 0
  const pages = Math.ceil(total / limit)

  // Client-side price filter
  if (priceRange !== 'all') {
    products = products.filter((p) => {
      switch (priceRange) {
        case 'under25': return p.price < 25
        case '25to50': return p.price >= 25 && p.price <= 50
        case '50to100': return p.price > 50 && p.price <= 100
        case 'over100': return p.price > 100
        default: return true
      }
    })
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">{total} products available</p>
        </div>
        <div className="flex gap-2 sm:gap-3 items-center w-full sm:w-auto">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            className="flex-1"
          />
          {/* Mobile filter toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="sm:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] border border-gray-200 text-gray-500 hover:border-primary active:bg-primary/5 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsible filters - always visible on sm+, toggle on mobile */}
      <div className={`${filtersOpen ? 'block' : 'hidden'} sm:block`}>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'all' as const, label: 'All Prices' },
            { key: 'under25' as const, label: 'Under $25' },
            { key: '25to50' as const, label: '$25 - $50' },
            { key: '50to100' as const, label: '$50 - $100' },
            { key: 'over100' as const, label: '$100+' },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setPriceRange(f.key)}
              className={`min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all active:scale-95 ${
                priceRange === f.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : products.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-400">
            No products found{search ? ` for "${search}"` : ''}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} loading={addToCart.isPending} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)} className="min-h-[44px]">
            Previous
          </Button>
          {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === page ? 'primary' : 'ghost'}
              onClick={() => setPage(p)}
              className="min-h-[44px] min-w-[44px]"
            >
              {p}
            </Button>
          ))}
          <Button size="sm" variant="ghost" disabled={page === pages} onClick={() => setPage(page + 1)} className="min-h-[44px]">
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

function ProductCard({
  product,
  onAddToCart,
  loading,
}: {
  product: EcomProduct
  onAddToCart: (id: string) => void
  loading: boolean
}) {
  return (
    <Card className="flex flex-col overflow-hidden group" padding={false}>
      <div className="w-full h-40 sm:h-48 bg-gray-100 flex items-center justify-center relative overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.display_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <svg className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
        {product.compare_at_price && product.compare_at_price > product.price && (
          <Badge variant="danger" className="absolute top-2 right-2">
            {Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)}% OFF
          </Badge>
        )}
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <h3 className="font-medium text-gray-900 text-sm truncate">{product.display_name}</h3>
        {product.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-lg font-bold text-gray-900">${product.price.toFixed(2)}</span>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <span className="text-sm text-gray-400 line-through ml-1 sm:ml-2">${product.compare_at_price.toFixed(2)}</span>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => onAddToCart(product.id)}
            loading={loading}
            className="min-h-[48px] px-4 active:scale-95 transition-transform shrink-0"
          >
            <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <span className="hidden sm:inline">Add to Cart</span>
          </Button>
        </div>
      </div>
    </Card>
  )
}
