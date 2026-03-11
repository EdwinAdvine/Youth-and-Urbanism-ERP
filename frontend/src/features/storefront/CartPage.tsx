import { Link, useParams } from 'react-router-dom'
import { useCart, useUpdateCartItem, useRemoveFromCart } from '../../api/storefront'

export default function CartPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>()
  const { data: cart, isLoading } = useCart()
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveFromCart()

  if (!sessionStorage.getItem('sf_token')) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Please log in to view your cart.</p>
        <Link to={`/store/${storeSlug}/auth`} className="text-[#51459d] hover:underline text-sm">
          Login / Register
        </Link>
      </div>
    )
  }

  if (isLoading) return <p className="text-gray-500 text-sm">Loading cart...</p>

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Your cart is empty.</p>
        <Link to={`/store/${storeSlug}`} className="text-[#51459d] hover:underline text-sm">
          Continue Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Shopping Cart</h1>

      <div className="bg-white dark:bg-gray-800 rounded-[10px] border divide-y">
        {cart.items.map((item) => (
          <div key={item.id} className="p-4 flex items-center gap-4">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.product_name}</p>
              <p className="text-xs text-gray-500">${item.unit_price.toFixed(2)} each</p>
            </div>

            {/* Quantity controls */}
            <div className="flex items-center border rounded-[10px]">
              <button
                onClick={() =>
                  updateItem.mutate({ cartItemId: item.id, quantity: Math.max(1, item.quantity - 1) })
                }
                className="px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                -
              </button>
              <span className="px-2 py-1 text-sm min-w-[1.5rem] text-center">{item.quantity}</span>
              <button
                onClick={() =>
                  updateItem.mutate({ cartItemId: item.id, quantity: item.quantity + 1 })
                }
                className="px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                +
              </button>
            </div>

            {/* Line total */}
            <span className="text-sm font-medium w-20 text-right">
              ${item.line_total.toFixed(2)}
            </span>

            {/* Remove */}
            <button
              onClick={() => removeItem.mutate(item.id)}
              className="text-[#ff3a6e] hover:opacity-70 text-xs"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 bg-white dark:bg-gray-800 rounded-[10px] border p-4 flex items-center justify-between">
        <span className="font-medium">Subtotal</span>
        <span className="text-lg font-bold text-[#51459d]">${cart.subtotal.toFixed(2)}</span>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <Link to={`/store/${storeSlug}`} className="text-sm text-[#51459d] hover:underline">
          Continue Shopping
        </Link>
        <Link
          to={`/store/${storeSlug}/checkout`}
          className="bg-[#51459d] text-white px-6 py-2.5 rounded-[10px] text-sm font-medium hover:opacity-90 transition"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  )
}
