import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Spinner, toast } from '../../components/ui'
import {
  useActiveSession,
  useCreateTransaction,
  type TransactionPaymentPayload,
} from '../../api/pos'

type PaymentMethod = 'cash' | 'card' | 'split'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

interface MobilePaymentProps {
  total: number
  lines: { item_id: string; quantity: number; unit_price: number; discount_amount?: number }[]
  taxAmount?: number
  customerName?: string
  onComplete?: () => void
  onCancel?: () => void
}

export default function MobilePayment({
  total,
  lines,
  taxAmount = 0,
  customerName,
  onComplete,
  onCancel,
}: MobilePaymentProps) {
  const navigate = useNavigate()
  const { data: session, isLoading: sessionLoading } = useActiveSession()
  const createTransaction = useCreateTransaction()

  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState('')
  const [splitCash, setSplitCash] = useState('')
  const [splitCard, setSplitCard] = useState('')

  const displayAmount = amount || '0'
  const numericAmount = parseFloat(amount) || 0
  const change = method === 'cash' ? Math.max(0, numericAmount - total) : 0

  const handleKeypad = useCallback((key: string) => {
    if (key === 'clear') {
      setAmount('')
      return
    }
    if (key === 'backspace') {
      setAmount((prev) => prev.slice(0, -1))
      return
    }
    if (key === '.' && amount.includes('.')) return
    if (key === '.' && amount === '') {
      setAmount('0.')
      return
    }
    setAmount((prev) => prev + key)
  }, [amount])

  const handleQuickAmount = useCallback((value: number) => {
    setAmount(value.toFixed(2))
  }, [])

  const handleConfirm = async () => {
    let payments: TransactionPaymentPayload[]

    if (method === 'split') {
      const cashAmt = parseFloat(splitCash) || 0
      const cardAmt = parseFloat(splitCard) || 0
      if (cashAmt + cardAmt < total) {
        toast('error', 'Split amounts must cover the total')
        return
      }
      payments = [
        { payment_method: 'cash', amount: cashAmt },
        { payment_method: 'card', amount: cardAmt, reference: `SPLIT-${Date.now()}` },
      ]
    } else if (method === 'cash') {
      if (numericAmount < total) {
        toast('error', 'Insufficient amount tendered')
        return
      }
      payments = [{ payment_method: 'cash', amount: numericAmount }]
    } else {
      payments = [{ payment_method: 'card', amount: total, reference: `CARD-${Date.now()}` }]
    }

    try {
      await createTransaction.mutateAsync({
        customer_name: customerName || undefined,
        tax_amount: taxAmount,
        lines,
        payments,
      })
      toast('success', 'Payment completed')
      onComplete?.()
    } catch {
      toast('error', 'Payment failed')
    }
  }

  if (sessionLoading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Active Session</h2>
        <p className="text-gray-500 mb-4 text-center">Open a POS session before accepting payments.</p>
        <Button onClick={() => navigate('/pos/sessions')} className="min-h-[52px] w-full max-w-xs">
          Go to Sessions
        </Button>
      </div>
    )
  }

  const quickAmounts = [
    total,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4)

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col safe-area-inset">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <button
          onClick={onCancel}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-[10px] text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Payment</h1>
        <div className="w-12" />
      </div>

      {/* Total Display */}
      <div className="text-center py-6 bg-white border-b border-gray-100">
        <p className="text-sm text-gray-500 mb-1">Total Due</p>
        <p className="text-4xl font-bold text-gray-900">{formatCurrency(total)}</p>
      </div>

      {/* Payment Method Tabs */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50">
        {([
          { key: 'cash' as const, label: 'Cash', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
          { key: 'card' as const, label: 'Card', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
          { key: 'split' as const, label: 'Split', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
        ]).map((m) => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            className={`min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-[10px] border text-sm font-medium transition-all active:scale-95 ${
              method === m.key
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 active:bg-gray-50'
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.icon} />
            </svg>
            {m.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {method === 'cash' && (
          <div className="p-4 space-y-4">
            {/* Amount display */}
            <div className="text-center bg-gray-50 rounded-[10px] p-4">
              <p className="text-sm text-gray-500 mb-1">Amount Tendered</p>
              <p className="text-3xl font-bold text-gray-900">${displayAmount}</p>
              {change > 0 && (
                <p className="text-lg font-semibold text-green-600 mt-2">Change: {formatCurrency(change)}</p>
              )}
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((qa) => (
                <button
                  key={qa}
                  onClick={() => handleQuickAmount(qa)}
                  className="min-h-[48px] rounded-[10px] bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 active:bg-primary/30 active:scale-95 transition-all"
                >
                  {formatCurrency(qa)}
                </button>
              ))}
            </div>

            {/* Number Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeypad(key)}
                  className="min-h-[56px] rounded-[10px] bg-white border border-gray-200 text-lg font-semibold text-gray-900 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all"
                >
                  {key === 'backspace' ? (
                    <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l7-7 12 0 0 14-12 0z" />
                    </svg>
                  ) : key}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleKeypad('clear')}
              className="w-full min-h-[48px] rounded-[10px] bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {method === 'card' && (
          <div className="p-4 space-y-6">
            <div className="text-center bg-blue-50 rounded-[10px] p-8">
              <svg className="h-16 w-16 mx-auto text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-lg font-semibold text-blue-900">Card Payment</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{formatCurrency(total)}</p>
              <p className="text-sm text-blue-600 mt-3">Tap, insert, or swipe card on terminal</p>
            </div>
          </div>
        )}

        {method === 'split' && (
          <div className="p-4 space-y-4">
            <div className="bg-gray-50 rounded-[10px] p-4">
              <p className="text-sm text-gray-500 mb-1">Remaining to allocate</p>
              <p className={`text-2xl font-bold ${
                (total - (parseFloat(splitCash) || 0) - (parseFloat(splitCard) || 0)) <= 0
                  ? 'text-green-600'
                  : 'text-gray-900'
              }`}>
                {formatCurrency(Math.max(0, total - (parseFloat(splitCash) || 0) - (parseFloat(splitCard) || 0)))}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-h-[52px] rounded-[10px] border border-gray-300 px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={splitCard}
                  onChange={(e) => setSplitCard(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-h-[52px] rounded-[10px] border border-gray-300 px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <button
                onClick={() => {
                  const cash = parseFloat(splitCash) || 0
                  setSplitCard(Math.max(0, total - cash).toFixed(2))
                }}
                className="w-full min-h-[48px] rounded-[10px] bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors"
              >
                Auto-fill remaining to card
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <Button
          className="w-full min-h-[56px] text-lg font-semibold"
          size="lg"
          onClick={handleConfirm}
          loading={createTransaction.isPending}
          disabled={
            (method === 'cash' && numericAmount < total) ||
            (method === 'split' && ((parseFloat(splitCash) || 0) + (parseFloat(splitCard) || 0)) < total)
          }
        >
          {method === 'cash'
            ? `Pay ${formatCurrency(total)} (Cash)`
            : method === 'card'
            ? `Charge ${formatCurrency(total)} (Card)`
            : `Pay ${formatCurrency(total)} (Split)`}
        </Button>
      </div>
    </div>
  )
}
