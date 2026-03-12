import { useState, useRef, useCallback } from 'react'
import { Button, Card, Input, Badge, Spinner, toast } from '../../components/ui'
import { usePOSProducts, useSearchProducts, useActiveSession, useCreateTransaction, useHoldTransaction, useHeldTransactions, type POSProduct, type TransactionLinePayload, type TransactionPaymentPayload } from '../../api/pos'
import { useLoyaltyMemberByCustomer } from '../../api/loyalty'
import BarcodeScanner from './BarcodeScanner'
import CustomerLookup, { type SelectedCustomer } from './CustomerLookup'
import { SplitPaymentDialog } from './SplitPaymentDialog'
import { TipDialog } from './TipDialog'
import AICashierAssistant from './AICashierAssistant'

interface CartLine extends TransactionLinePayload {
  name: string
  sku: string
}

export default function POSRegister() {
  const { data: session, isLoading: sessionLoading, error: sessionError } = useActiveSession()
  const [search, setSearch] = useState('')
  const [category, _setCategory] = useState('')
  const { data: productsData, isLoading: productsLoading } = usePOSProducts({ category: category || undefined, limit: 50 })
  const { data: searchResults } = useSearchProducts(search)
  const createTransaction = useCreateTransaction()
  const holdTransaction = useHoldTransaction()
  const { data: heldTransactions } = useHeldTransactions()

  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null)
  const [splitPaymentOpen, setSplitPaymentOpen] = useState(false)
  const [tipDialogOpen, setTipDialogOpen] = useState(false)
  const [tipAmount, setTipAmount] = useState(0)
  const barcodeRef = useRef<HTMLInputElement>(null)

  const { data: loyaltyMember } = useLoyaltyMemberByCustomer(selectedCustomer?.id || '')

  const displayProducts = search ? searchResults : productsData?.products
  const subtotal = cart.reduce((sum, l) => sum + l.unit_price * l.quantity - (l.discount_amount || 0), 0)
  const taxRate = 0.16
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount + tipAmount
  const tendered = parseFloat(amountTendered) || 0
  const change = Math.max(0, tendered - total)

  const addToCart = useCallback((product: POSProduct) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.item_id === product.id)
      if (existing) {
        return prev.map((l) =>
          l.item_id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      return [
        ...prev,
        {
          item_id: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unit_price: parseFloat(product.selling_price),
          discount_amount: 0,
        },
      ]
    })
  }, [])

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.item_id === itemId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    )
  }

  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((l) => l.item_id !== itemId))
  }

  const handleBarcode = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const val = (e.target as HTMLInputElement).value.trim()
    if (!val) return
    const product = productsData?.products.find((p) => p.sku === val)
    if (product) {
      addToCart(product)
      setSearch('')
      toast('success', `Added ${product.name}`)
    } else {
      toast('error', 'Product not found')
    }
    ;(e.target as HTMLInputElement).value = ''
  }

  const resetCart = () => {
    setCart([])
    setAmountTendered('')
    setCustomerName('')
    setSelectedCustomer(null)
    setTipAmount(0)
    barcodeRef.current?.focus()
  }

  const handleCheckout = async (payments?: TransactionPaymentPayload[]) => {
    if (cart.length === 0) return toast('error', 'Cart is empty')

    const lines: TransactionLinePayload[] = cart.map(({ name, sku, ...l }) => l)
    const finalPayments: TransactionPaymentPayload[] = payments || [
      {
        payment_method: paymentMethod,
        amount: paymentMethod === 'cash' ? tendered : total,
        reference: paymentMethod !== 'cash' ? `REF-${Date.now()}` : undefined,
      },
    ]

    if (!payments && paymentMethod === 'cash' && tendered < total) {
      return toast('error', 'Insufficient amount tendered')
    }

    try {
      await createTransaction.mutateAsync({
        customer_name: customerName || undefined,
        customer_id: selectedCustomer?.id,
        tip_amount: tipAmount || undefined,
        tax_amount: taxAmount,
        lines,
        payments: finalPayments,
      })
      toast('success', 'Transaction completed')
      resetCart()
    } catch {
      toast('error', 'Transaction failed')
    }
  }

  const handleHold = async () => {
    if (cart.length === 0) return toast('error', 'Cart is empty')
    const lines: TransactionLinePayload[] = cart.map(({ name, sku, ...l }) => l)
    try {
      await createTransaction.mutateAsync({
        customer_name: customerName || undefined,
        customer_id: selectedCustomer?.id,
        tax_amount: taxAmount,
        lines,
        payments: [{ payment_method: 'cash', amount: 0 }],
      })
      await holdTransaction.mutateAsync({ lines: cart.map(({ name: _n, sku: _s, ...l }) => l) })
      toast('success', 'Transaction held')
      resetCart()
    } catch {
      toast('error', 'Failed to hold transaction')
    }
  }

  if (sessionLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size="lg" /></div>
  }

  if (sessionError || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Active Session</h2>
          <p className="text-gray-500 mb-4">Open a POS session first to start selling.</p>
          <Button onClick={() => window.location.href = '/pos/sessions'}>Go to Sessions</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Left: Product Grid — full width on mobile, side-by-side on tablet+ */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 sm:p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 sm:gap-3 items-center">
          <Input
            ref={barcodeRef}
            placeholder="Scan barcode or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleBarcode}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            className="flex-1 min-w-0"
          />
          <BarcodeScanner onProductScanned={addToCart} showIndicator />
          <Badge variant="info" className="hidden sm:inline-flex">Session: {session.session_number}</Badge>
          {(heldTransactions?.length ?? 0) > 0 && (
            <button
              onClick={() => window.location.href = '/pos/held-transactions'}
              className="relative px-3 py-2 min-h-[44px] rounded-[10px] border border-warning/50 bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20 transition-colors"
            >
              Held ({heldTransactions?.length})
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-4">
          {productsLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
              {(displayProducts ?? []).map((p) => (
                <button
                  key={p.id}
                  className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-3 text-left hover:border-primary hover:shadow-sm transition-all active:scale-95 active:bg-primary/5 min-h-[100px]"
                  onClick={() => addToCart(p)}
                >
                  <div className="w-full h-12 sm:h-16 bg-gray-50 dark:bg-gray-950 rounded-lg mb-2 flex items-center justify-center">
                    <svg className="h-6 w-6 sm:h-8 sm:w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.sku}</p>
                  <p className="text-sm font-bold text-primary mt-1">${parseFloat(p.selling_price).toFixed(2)}</p>
                  {p.stock_on_hand <= 5 && (
                    <Badge variant="warning" className="mt-1">{p.stock_on_hand} left</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart & Payment — full width bottom on mobile, sidebar on tablet+ */}
      <div className="w-full md:w-96 bg-white dark:bg-gray-800 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 flex flex-col max-h-[55vh] md:max-h-none">
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <Input
              placeholder="Customer name (optional)"
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomer(null) }}
              className="text-sm flex-1"
            />
            <button
              onClick={() => setCustomerLookupOpen(true)}
              className="px-3 py-2 min-h-[48px] rounded-[10px] border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary hover:text-primary active:bg-primary/5 transition-colors"
              title="Look up customer"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </div>
          {selectedCustomer && (
            <div className="flex items-center justify-between mt-2 px-2 py-1.5 bg-primary/5 rounded-lg">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-primary">{selectedCustomer.name}</span>
                {loyaltyMember && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-semibold">
                    {loyaltyMember.points_balance} pts
                    {loyaltyMember.tier_name && <span>• {loyaltyMember.tier_name}</span>}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setSelectedCustomer(null); setCustomerName('') }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Customer Lookup Dialog */}
        <CustomerLookup
          open={customerLookupOpen}
          onClose={() => setCustomerLookupOpen(false)}
          onSelectCustomer={(customer) => {
            setSelectedCustomer(customer)
            setCustomerName(customer.name)
            setCustomerLookupOpen(false)
          }}
        />

        {/* Cart items */}
        <div className="flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm py-8">
              Scan or tap products to add
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {cart.map((line) => (
                <div key={line.item_id} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{line.name}</p>
                    <p className="text-xs text-gray-400">${line.unit_price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="w-10 h-10 sm:w-8 sm:h-8 rounded-[10px] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
                      onClick={() => updateQty(line.item_id, -1)}
                    >-</button>
                    <span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
                    <button
                      className="w-10 h-10 sm:w-8 sm:h-8 rounded-[10px] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
                      onClick={() => updateQty(line.item_id, 1)}
                    >+</button>
                  </div>
                  <span className="text-sm font-semibold w-16 text-right">
                    ${(line.unit_price * line.quantity).toFixed(2)}
                  </span>
                  <button
                    className="text-gray-400 hover:text-danger active:text-danger transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    onClick={() => removeItem(line.item_id)}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & Payment */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax (16%)</span><span>${taxAmount.toFixed(2)}</span></div>
            {tipAmount > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Tip</span><span className="text-green-600">${tipAmount.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-gray-100 pt-1 border-t border-gray-100 dark:border-gray-800">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleHold}
              disabled={cart.length === 0}
              className="flex-1 min-h-[40px] rounded-[10px] border border-warning text-warning text-xs font-medium hover:bg-warning/10 transition-colors disabled:opacity-40"
            >
              Hold
            </button>
            <button
              onClick={() => setTipDialogOpen(true)}
              disabled={cart.length === 0}
              className="flex-1 min-h-[40px] rounded-[10px] border border-green-500 text-green-600 text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-40"
            >
              {tipAmount > 0 ? `Tip $${tipAmount.toFixed(2)}` : 'Add Tip'}
            </button>
            <button
              onClick={() => setSplitPaymentOpen(true)}
              disabled={cart.length === 0}
              className="flex-1 min-h-[40px] rounded-[10px] border border-primary text-primary text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              Split Pay
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {['cash', 'card', 'mpesa', 'other'].map((m) => (
              <button
                key={m}
                className={`min-h-[48px] py-2 px-3 rounded-[10px] text-xs sm:text-sm font-medium transition-colors border active:scale-95 ${
                  paymentMethod === m
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 active:bg-gray-50 dark:active:bg-gray-800'
                }`}
                onClick={() => setPaymentMethod(m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <Input
                label="Amount Tendered"
                type="number"
                step="0.01"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                placeholder="0.00"
              />
              {tendered > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Change</span>
                  <span className="font-bold text-green-600">${change.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full min-h-[52px] text-base"
            size="lg"
            onClick={() => handleCheckout()}
            loading={createTransaction.isPending}
            disabled={cart.length === 0}
          >
            Complete Sale - ${total.toFixed(2)}
          </Button>
        </div>
      </div>

      {/* Tip Dialog */}
      <TipDialog
        open={tipDialogOpen}
        onClose={() => setTipDialogOpen(false)}
        subtotal={subtotal + taxAmount}
        onConfirm={(tip: number) => {
          setTipAmount(tip)
          setTipDialogOpen(false)
        }}
      />

      {/* Split Payment Dialog */}
      <SplitPaymentDialog
        open={splitPaymentOpen}
        onClose={() => setSplitPaymentOpen(false)}
        total={total}
        onConfirm={(payments: TransactionPaymentPayload[]) => {
          setSplitPaymentOpen(false)
          handleCheckout(payments)
        }}
      />

      {/* AI Cashier Assistant */}
      <AICashierAssistant
        cartItemIds={cart.map((l) => l.item_id)}
        customerId={selectedCustomer?.id}
      />
    </div>
  )
}
