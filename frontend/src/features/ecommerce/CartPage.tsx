import { useNavigate } from 'react-router-dom'
import { Button, Card, Spinner, toast } from '../../components/ui'
import {
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  type CartItem,
} from '../../api/ecommerce_ext'

export default function CartPage() {
  const navigate = useNavigate()
  const { data: cart, isLoading, error } = useCart()
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()

  const handleQuantityChange = async (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta
    if (newQty < 1) return
    try {
      await updateItem.mutateAsync({ item_id: item.id, quantity: newQty })
    } catch {
      toast('error', 'Failed to update quantity')
    }
  }

  const handleRemove = async (itemId: string) => {
    try {
      await removeItem.mutateAsync(itemId)
      toast('success', 'Item removed from cart')
    } catch {
      toast('error', 'Failed to remove item')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) return <div className="p-6 text-danger">Failed to load cart</div>

  const items = cart?.items ?? []

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>

      {items.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <p className="text-gray-500 mb-4">Your cart is empty</p>
            <Button onClick={() => navigate('/ecommerce/catalog')}>Browse Products</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-[10px] flex items-center justify-center flex-shrink-0">
                    {item.product_image ? (
                      <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover rounded-[10px]" />
                    ) : (
                      <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{item.product_name}</h3>
                    <p className="text-sm text-gray-500">${item.unit_price.toFixed(2)} each</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="w-8 h-8 rounded-[10px] border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => handleQuantityChange(item, -1)}
                      disabled={item.quantity <= 1 || updateItem.isPending}
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-medium">{item.quantity}</span>
                    <button
                      className="w-8 h-8 rounded-[10px] border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => handleQuantityChange(item, 1)}
                      disabled={updateItem.isPending}
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right min-w-[80px]">
                    <p className="font-semibold text-gray-900">${item.total.toFixed(2)}</p>
                  </div>

                  <button
                    className="text-gray-400 hover:text-danger transition-colors"
                    onClick={() => handleRemove(item.id)}
                    disabled={removeItem.isPending}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-1">
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">${cart?.subtotal.toFixed(2)}</span>
                </div>
                {(cart?.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-${cart!.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span className="font-medium">${cart?.tax_amount.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-lg text-gray-900">${cart?.total.toFixed(2)}</span>
                </div>
              </div>
              {cart?.coupon_code && (
                <div className="mt-3 p-2 bg-green-50 rounded-[10px] text-sm text-green-700">
                  Coupon applied: <span className="font-mono font-medium">{cart.coupon_code}</span>
                </div>
              )}
              <Button className="w-full mt-4" onClick={() => navigate('/ecommerce/checkout')}>
                Proceed to Checkout
              </Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
