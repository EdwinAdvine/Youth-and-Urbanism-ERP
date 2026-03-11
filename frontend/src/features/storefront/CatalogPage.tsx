import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCatalogProducts, useAddToCart } from '../../api/storefront'

export default function CatalogPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 12

  const { data, isLoading } = useCatalogProducts(storeSlug!, { page, limit, search: search || undefined })
  const addToCart = useAddToCart()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full max-w-md border border-gray-300 rounded-[10px] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]"
        />
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading products...</p>}

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {data?.products.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-[10px] border overflow-hidden flex flex-col"
          >
            {/* Image placeholder */}
            <Link to={`/store/${storeSlug}/product/${p.id}`}>
              {p.images?.[0] ? (
                <img src={p.images[0]} alt={p.display_name} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                  No image
                </div>
              )}
            </Link>

            <div className="p-4 flex-1 flex flex-col">
              <Link
                to={`/store/${storeSlug}/product/${p.id}`}
                className="font-medium text-sm hover:text-[#51459d] line-clamp-2"
              >
                {p.display_name}
              </Link>

              <div className="mt-2 flex items-center gap-2">
                <span className="font-bold text-[#51459d]">
                  ${p.price.toFixed(2)}
                </span>
                {p.compare_at_price && p.compare_at_price > p.price && (
                  <span className="text-xs text-gray-400 line-through">
                    ${p.compare_at_price.toFixed(2)}
                  </span>
                )}
              </div>

              <button
                onClick={() => addToCart.mutate({ product_id: p.id, quantity: 1 })}
                disabled={addToCart.isPending}
                className="mt-auto pt-3 w-full bg-[#51459d] text-white text-sm py-2 rounded-[10px] hover:opacity-90 disabled:opacity-50 transition"
              >
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>

      {data && data.products.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-12">No products found.</p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border rounded-[10px] disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border rounded-[10px] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
