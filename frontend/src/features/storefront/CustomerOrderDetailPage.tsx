import { useParams, useNavigate } from 'react-router-dom'
import { useCustomerOrder } from '../../api/storefront'

const statusSteps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']

export default function CustomerOrderDetailPage() {
  const { storeSlug, orderId } = useParams<{ storeSlug: string; orderId: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading } = useCustomerOrder(orderId!)

  if (isLoading) return <p className="text-gray-500 text-sm">Loading order...</p>
  if (!order) return <p className="text-gray-500 text-sm">Order not found.</p>

  const currentStep = statusSteps.indexOf(order.status)

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate(`/store/${storeSlug}/orders`)}
        className="text-sm text-[#51459d] mb-4 hover:underline"
      >
        &larr; Back to Orders
      </button>

      <div className="bg-white rounded-[10px] border p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Order #{order.order_number}</h1>
          <span className="text-xs text-gray-400">
            {new Date(order.created_at).toLocaleString()}
          </span>
        </div>

        {/* Status timeline */}
        {order.status !== 'cancelled' && (
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {statusSteps.map((step, i) => {
                const reached = i <= currentStep
                return (
                  <div key={step} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        reached
                          ? 'bg-[#51459d] text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={`mt-1 text-[10px] capitalize ${
                        reached ? 'text-[#51459d] font-medium' : 'text-gray-400'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Progress bar */}
            <div className="mt-2 mx-6 h-1 bg-gray-200 rounded-full relative">
              <div
                className="absolute left-0 top-0 h-full bg-[#51459d] rounded-full transition-all"
                style={{
                  width: `${currentStep >= 0 ? (currentStep / (statusSteps.length - 1)) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {order.status === 'cancelled' && (
          <div className="mb-6 bg-red-50 text-[#ff3a6e] text-sm px-4 py-2 rounded-[10px]">
            This order has been cancelled.
          </div>
        )}

        {/* Line items */}
        {order.lines && order.lines.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium mb-3">Items</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b">
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{line.product_name}</td>
                    <td className="py-2 text-right">{line.quantity}</td>
                    <td className="py-2 text-right">${line.unit_price.toFixed(2)}</td>
                    <td className="py-2 text-right font-medium">${line.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="border-t pt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Tax</span>
            <span>${order.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Shipping</span>
            <span>${order.shipping_cost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t">
            <span>Total</span>
            <span className="text-[#51459d]">${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
