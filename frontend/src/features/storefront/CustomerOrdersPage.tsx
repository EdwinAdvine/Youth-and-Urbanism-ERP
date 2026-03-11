import { Link, useParams } from 'react-router-dom'
import { useCustomerOrders } from '../../api/storefront'

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function CustomerOrdersPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>()
  const { data, isLoading } = useCustomerOrders()

  if (isLoading) return <p className="text-gray-500 text-sm">Loading orders...</p>

  const orders = data?.orders ?? []

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">You have no orders yet.</p>
          <Link to={`/store/${storeSlug}`} className="text-[#51459d] hover:underline text-sm">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to={`/store/${storeSlug}/orders/${o.id}`}
              className="block bg-white dark:bg-gray-800 rounded-[10px] border p-4 hover:border-[#51459d] transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">#{o.order_number}</span>
                  <span className="ml-3 text-xs text-gray-400">
                    {new Date(o.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ statusColor[o.status] ?? 'bg-gray-100 text-gray-600' }`}
                  >
                    {o.status}
                  </span>
                  <span className="font-bold text-sm text-[#51459d]">
                    ${o.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
