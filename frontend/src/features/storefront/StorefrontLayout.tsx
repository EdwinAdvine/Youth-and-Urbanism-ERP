import { Link, Outlet, useParams } from 'react-router-dom'
import { useCart } from '../../api/storefront'

export default function StorefrontLayout() {
  const { storeSlug } = useParams<{ storeSlug: string }>()
  const { data: cart } = useCart()
  const isLoggedIn = !!sessionStorage.getItem('sf_token')
  const base = `/store/${storeSlug}`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={base} className="text-lg font-bold text-[#51459d]">
            {storeSlug}
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            {isLoggedIn ? (
              <Link to={`${base}/orders`} className="hover:text-[#51459d]">
                My Orders
              </Link>
            ) : (
              <Link to={`${base}/auth`} className="hover:text-[#51459d]">
                Login
              </Link>
            )}

            <Link
              to={`${base}/cart`}
              className="relative hover:text-[#51459d]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
              {(cart?.item_count ?? 0) > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#ff3a6e] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cart!.item_count}
                </span>
              )}
            </Link>

            {isLoggedIn && (
              <button
                onClick={() => {
                  sessionStorage.removeItem('sf_token')
                  window.location.href = `${base}/auth`
                }}
                className="text-gray-500 hover:text-[#ff3a6e] text-xs"
              >
                Logout
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
