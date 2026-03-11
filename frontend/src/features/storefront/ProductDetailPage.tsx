import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCatalogProduct, useAddToCart } from '../../api/storefront'

export default function ProductDetailPage() {
  const { storeSlug, productId } = useParams<{ storeSlug: string; productId: string }>()
  const navigate = useNavigate()
  const { data: product, isLoading } = useCatalogProduct(storeSlug!, productId!)
  const addToCart = useAddToCart()
  const [qty, setQty] = useState(1)

  if (isLoading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!product) return <p className="text-gray-500 text-sm">Product not found.</p>

  const handleAdd = () => {
    addToCart.mutate(
      { product_id: product.id, quantity: qty },
      { onSuccess: () => navigate(`/store/${storeSlug}/cart`) },
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-[#51459d] mb-4 hover:underline"
      >
        &larr; Back
      </button>

      <div className="bg-white rounded-[10px] border p-6 grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div>
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.display_name}
              className="w-full rounded-[10px] object-cover max-h-96"
            />
          ) : (
            <div className="w-full h-72 bg-gray-100 rounded-[10px] flex items-center justify-center text-gray-400">
              No image
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">{product.display_name}</h1>

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-bold text-[#51459d]">
              ${product.price.toFixed(2)}
            </span>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <span className="text-base text-gray-400 line-through">
                ${product.compare_at_price.toFixed(2)}
              </span>
            )}
          </div>

          {product.description && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Quantity selector */}
          <div className="mt-6 flex items-center gap-3">
            <span className="text-sm font-medium">Qty:</span>
            <div className="flex items-center border rounded-[10px]">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-1 text-lg hover:bg-gray-50"
              >
                -
              </button>
              <span className="px-3 py-1 text-sm min-w-[2rem] text-center">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="px-3 py-1 text-lg hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={addToCart.isPending}
            className="mt-6 bg-[#51459d] text-white py-3 rounded-[10px] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {addToCart.isPending ? 'Adding...' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
