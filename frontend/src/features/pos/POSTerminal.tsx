import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge } from '../../components/ui'
import {
  useActiveSession,
  usePOSProducts,
  useSearchProducts,
  useCreateTransaction,
  type POSProduct,
  type TransactionLinePayload,
  type TransactionPaymentPayload,
} from '../../api/pos'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | string) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

// ─── Cart Item Type ───────────────────────────────────────────────────────────

interface CartItem {
  product: POSProduct
  quantity: number
  discount: number
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({
  total,
  onConfirm,
  onClose,
  isLoading,
}: {
  total: number
  onConfirm: (payments: TransactionPaymentPayload[], customerName?: string) => void
  onClose: () => void
  isLoading: boolean
}) {
  const [method, setMethod] = useState('cash')
  const [amount, setAmount] = useState(total.toFixed(2))
  const [reference, setReference] = useState('')
  const [customerName, setCustomerName] = useState('')

  const change = Math.max(0, parseFloat(amount || '0') - total)

  const handleConfirm = () => {
    const payments: TransactionPaymentPayload[] = [
      {
        payment_method: method,
        amount: parseFloat(amount || '0'),
        ...(reference ? { reference } : {}),
      },
    ]
    onConfirm(payments, customerName || undefined)
  }

  const quickAmounts = [
    total,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-md p-4 sm:p-6 mx-4 sm:mx-0">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Payment</h2>

        <div className="text-center mb-6">
          <p className="text-sm text-gray-500">Total Due</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(total)}</p>
        </div>

        {/* Customer Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name (optional)</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Walk-in Customer"
            className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Payment Method */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'mobile_money', label: 'Mobile' },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value)}
                className={cn(
                  'px-3 py-2 min-h-[48px] rounded-[10px] border text-sm font-medium transition-colors active:scale-95',
                  method === m.value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 active:bg-gray-100'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount Tendered</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {method === 'cash' && (
            <div className="flex gap-2 mt-2">
              {quickAmounts.map((qa) => (
                <button
                  key={qa}
                  onClick={() => setAmount(qa.toFixed(2))}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-gray-100 text-sm font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors"
                >
                  {formatCurrency(qa)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reference for card/mobile */}
        {method !== 'cash' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference #</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction reference"
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {/* Change */}
        {method === 'cash' && change > 0 && (
          <div className="bg-green-50 rounded-[10px] p-3 mb-4 text-center">
            <p className="text-sm text-green-700">Change Due</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(change)}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 min-h-[52px]" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="flex-1 min-h-[52px]"
            onClick={handleConfirm}
            disabled={isLoading || parseFloat(amount || '0') < total}
          >
            {isLoading ? <Spinner size="sm" /> : 'Complete Sale'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onAdd,
}: {
  product: POSProduct
  onAdd: (product: POSProduct) => void
}) {
  const outOfStock = product.stock_on_hand <= 0

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={cn(
        'flex flex-col items-center justify-center p-3 sm:p-4 rounded-[10px] border transition-all text-center h-full min-h-[120px] sm:min-h-[120px]',
        outOfStock
          ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
          : 'bg-white border-gray-200 hover:border-primary hover:shadow-md cursor-pointer active:scale-95'
      )}
    >
      <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</p>
      <p className="text-xs text-gray-500 mt-1">{product.sku}</p>
      <p className="text-base font-bold text-primary mt-2">{formatCurrency(product.selling_price)}</p>
      <Badge
        variant={outOfStock ? 'danger' : product.stock_on_hand <= 5 ? 'warning' : 'success'}
        className="mt-1"
      >
        {outOfStock ? 'Out of stock' : `${product.stock_on_hand} in stock`}
      </Badge>
    </button>
  )
}

// ─── Main POS Terminal ────────────────────────────────────────────────────────

export default function POSTerminal() {
  const navigate = useNavigate()
  const { data: session, isLoading: sessionLoading, error: sessionError } = useActiveSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showPayment, setShowPayment] = useState(false)

  const { data: productsData, isLoading: productsLoading } = usePOSProducts({
    category: selectedCategory || undefined,
    limit: 100,
  })
  const { data: searchResults } = useSearchProducts(searchQuery)

  const createTransaction = useCreateTransaction()

  const products = searchQuery ? searchResults : productsData?.products
  const categories = useMemo(() => {
    const cats = new Set<string>()
    productsData?.products?.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats).sort()
  }, [productsData])

  // Cart operations
  const addToCart = useCallback((product: POSProduct) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock_on_hand) return prev
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [...prev, { product, quantity: 1, discount: 0 }]
    })
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((c) => c.product.id !== productId))
    } else {
      setCart((prev) =>
        prev.map((c) =>
          c.product.id === productId ? { ...c, quantity: Math.min(quantity, c.product.stock_on_hand) } : c
        )
      )
    }
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  // Totals
  const subtotal = useMemo(
    () => cart.reduce((sum, c) => sum + parseFloat(c.product.selling_price) * c.quantity - c.discount, 0),
    [cart]
  )
  const total = subtotal // Tax and discounts can be added here

  // Payment
  const handlePayment = async (payments: TransactionPaymentPayload[], customerName?: string) => {
    const lines: TransactionLinePayload[] = cart.map((c) => ({
      item_id: c.product.id,
      quantity: c.quantity,
      unit_price: parseFloat(c.product.selling_price),
      discount_amount: c.discount,
    }))

    try {
      await createTransaction.mutateAsync({
        customer_name: customerName,
        lines,
        payments,
      })
      setCart([])
      setShowPayment(false)
    } catch {
      // Error handled by mutation
    }
  }

  // No active session
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (sessionError || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-20 h-20 rounded-3xl bg-orange-100 flex items-center justify-center text-4xl mb-4">
          <svg className="h-10 w-10 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Active Session</h2>
        <p className="text-gray-500 mb-4">You need to open a POS session before making sales.</p>
        <Button onClick={() => navigate('/pos/sessions')}>Open Session</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)]">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or SKU..."
                className="w-full pl-10 pr-4 py-2 rounded-[10px] border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <Badge variant="info">Session: {session.session_number}</Badge>
          </div>

          {/* Category filters */}
          {categories.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'px-3 py-1.5 sm:py-1 rounded-full text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 active:scale-95',
                  !selectedCategory ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 sm:py-1 rounded-full text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 active:scale-95',
                    selectedCategory === cat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {productsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {(products ?? []).map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} />
              ))}
              {(products ?? []).length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-12">
                  No products found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart Sidebar */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50 flex flex-col max-h-[50vh] lg:max-h-none">
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Cart
            {cart.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({cart.reduce((s, c) => s + c.quantity, 0)} items)
              </span>
            )}
          </h2>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart}>
              Clear
            </Button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <p className="text-sm">Add products to get started</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="bg-white rounded-[10px] border border-gray-200 p-3"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.product.selling_price)} each</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-gray-400 hover:text-red-500 ml-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      -
                    </button>
                    <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock_on_hand}
                      className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(parseFloat(item.product.selling_price) * item.quantity - item.discount)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer / Totals */}
        <div className="p-4 border-t border-gray-200 bg-white space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-gray-100 pt-3">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0}
            onClick={() => setShowPayment(true)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Charge {formatCurrency(total)}
          </Button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          total={total}
          onConfirm={handlePayment}
          onClose={() => setShowPayment(false)}
          isLoading={createTransaction.isPending}
        />
      )}
    </div>
  )
}
