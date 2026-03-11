import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCart, useCheckout } from '../../api/storefront'

export default function CheckoutPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>()
  const navigate = useNavigate()
  const { data: cart } = useCart()
  const checkout = useCheckout()

  const [form, setForm] = useState({
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  })
  const [notes, setNotes] = useState('')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    checkout.mutate(
      {
        shipping_address: {
          address_line1: form.address_line1,
          city: form.city,
          state: form.state || undefined,
          postal_code: form.postal_code || undefined,
          country: form.country,
        },
        notes: notes || undefined,
      },
      {
        onSuccess: (order) => navigate(`/store/${storeSlug}/orders/${order.id}`),
      },
    )
  }

  if (!cart || cart.items.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-16">Your cart is empty.</p>
  }

  const inputCls =
    'w-full border border-gray-300 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]'

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid md:grid-cols-5 gap-6">
        {/* Shipping form */}
        <div className="md:col-span-3 bg-white rounded-[10px] border p-6 space-y-4">
          <h2 className="font-medium text-sm mb-2">Shipping Address</h2>

          <input placeholder="Address" required value={form.address_line1} onChange={set('address_line1')} className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="City" required value={form.city} onChange={set('city')} className={inputCls} />
            <input placeholder="State / Province" value={form.state} onChange={set('state')} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Postal Code" value={form.postal_code} onChange={set('postal_code')} className={inputCls} />
            <input placeholder="Country" required value={form.country} onChange={set('country')} className={inputCls} />
          </div>

          <textarea
            placeholder="Order notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </div>

        {/* Order summary */}
        <div className="md:col-span-2 bg-white rounded-[10px] border p-6 self-start">
          <h2 className="font-medium text-sm mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="truncate mr-2">
                  {item.product_name} x{item.quantity}
                </span>
                <span className="font-medium">${item.line_total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-3 flex justify-between font-bold">
            <span>Subtotal</span>
            <span className="text-[#51459d]">${cart.subtotal.toFixed(2)}</span>
          </div>

          {checkout.isError && (
            <p className="text-[#ff3a6e] text-xs mt-3">
              Failed to place order. Please try again.
            </p>
          )}

          <button
            type="submit"
            disabled={checkout.isPending}
            className="mt-4 w-full bg-[#51459d] text-white py-2.5 rounded-[10px] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {checkout.isPending ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  )
}
