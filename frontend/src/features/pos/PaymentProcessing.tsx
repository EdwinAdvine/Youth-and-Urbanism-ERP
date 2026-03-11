import { useState, useEffect, useRef } from 'react'
import { Button, Badge, Input, Spinner, toast } from '../../components/ui'
import apiClient from '../../api/client'
import { useMutation } from '@tanstack/react-query'

// ─── Types ─────────────────────────────────────────────────────────────────────

type PaymentMethod = 'mpesa' | 'stripe' | 'manual'
type PaymentStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed'

interface InitiatePaymentPayload {
  transaction_id: string
  amount: number
  method: PaymentMethod
  phone?: string
}

interface PaymentStatusResponse {
  id: string
  status: PaymentStatus
  message?: string
  receipt_number?: string
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PaymentProcessingProps {
  open: boolean
  onClose: () => void
  amount: number
  transactionId: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { variant: 'default' | 'warning' | 'info' | 'success' | 'danger'; label: string }> = {
    idle:       { variant: 'default',  label: 'Ready' },
    pending:    { variant: 'warning',  label: 'Pending' },
    processing: { variant: 'info',     label: 'Processing' },
    completed:  { variant: 'success',  label: 'Completed' },
    failed:     { variant: 'danger',   label: 'Failed' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PaymentProcessing({ open, onClose, amount, transactionId }: PaymentProcessingProps) {
  const [method, setMethod] = useState<PaymentMethod>('mpesa')
  const [phone, setPhone] = useState('')
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stop polling when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Reset state when dialog reopens
  useEffect(() => {
    if (open) {
      setMethod('mpesa')
      setPhone('')
      setPaymentId(null)
      setStatus('idle')
      setStatusMessage('')
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [open])

  // Initiate payment mutation
  const initiateMutation = useMutation({
    mutationFn: async (payload: InitiatePaymentPayload) => {
      const { data } = await apiClient.post<{ id: string; status: PaymentStatus; message?: string }>(
        '/pos/payments/initiate',
        payload,
      )
      return data
    },
    onSuccess: (data) => {
      setPaymentId(data.id)
      setStatus(data.status ?? 'pending')
      setStatusMessage(data.message ?? '')
      startPolling(data.id)
    },
    onError: () => {
      setStatus('failed')
      setStatusMessage('Failed to initiate payment. Please try again.')
      toast('error', 'Payment initiation failed')
    },
  })

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await apiClient.get<PaymentStatusResponse>(`/pos/payments/${id}/status`)
        setStatus(data.status)
        setStatusMessage(data.message ?? '')

        if (data.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current)
          toast('success', 'Payment completed successfully')
          setTimeout(() => onClose(), 1200)
        } else if (data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
          toast('error', data.message ?? 'Payment failed')
        }
      } catch {
        // polling errors are silent — will retry on next interval
      }
    }, 3000)
  }

  const handleSendSTKPush = () => {
    if (!phone.trim()) {
      toast('error', 'Please enter a phone number')
      return
    }
    setStatus('pending')
    initiateMutation.mutate({
      transaction_id: transactionId,
      amount,
      method: 'mpesa',
      phone: phone.trim(),
    })
  }

  const handleManualOrStripe = () => {
    setStatus('pending')
    initiateMutation.mutate({
      transaction_id: transactionId,
      amount,
      method,
    })
  }

  const isProcessing = status === 'pending' || status === 'processing'
  const isTerminal = status === 'completed' || status === 'failed'

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-[10px] shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Process Payment</h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Amount Banner */}
        <div className="bg-[#51459d] text-white text-center py-6 px-6">
          <p className="text-sm font-medium opacity-80 mb-1">Amount Due</p>
          <p className="text-4xl font-bold tracking-tight">{formatCurrency(amount)}</p>
          <p className="text-xs opacity-60 mt-1">Txn: {transactionId}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Payment Method Selector */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'mpesa' as const,  label: 'M-Pesa',          icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
                { key: 'stripe' as const, label: 'Stripe Terminal', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                { key: 'manual' as const, label: 'Manual',           icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => !isProcessing && !isTerminal && setMethod(m.key)}
                  disabled={isProcessing || isTerminal}
                  className={`min-h-[64px] flex flex-col items-center justify-center gap-1.5 rounded-[10px] border text-xs font-medium transition-all ${
                    method === m.key
                      ? 'border-[#51459d] bg-[#51459d] text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.icon} />
                  </svg>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* M-Pesa: Phone input */}
          {method === 'mpesa' && (
            <div className="space-y-3">
              <Input
                label="M-Pesa Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0712 345 678"
                disabled={isProcessing || isTerminal}
                type="tel"
              />
              {!isProcessing && !isTerminal && (
                <Button
                  className="w-full"
                  onClick={handleSendSTKPush}
                  loading={initiateMutation.isPending}
                  disabled={!phone.trim()}
                >
                  Send STK Push
                </Button>
              )}
            </div>
          )}

          {/* Stripe Terminal */}
          {method === 'stripe' && (
            <div className="rounded-[10px] bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 text-center space-y-3">
              <svg className="h-10 w-10 mx-auto text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">Tap, insert, or swipe on terminal</p>
              {!isProcessing && !isTerminal && (
                <Button className="w-full" onClick={handleManualOrStripe} loading={initiateMutation.isPending}>
                  Charge {formatCurrency(amount)}
                </Button>
              )}
            </div>
          )}

          {/* Manual */}
          {method === 'manual' && (
            <div className="rounded-[10px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center space-y-3">
              <svg className="h-10 w-10 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-400">Record a manual payment entry</p>
              {!isProcessing && !isTerminal && (
                <Button className="w-full" variant="ghost" onClick={handleManualOrStripe} loading={initiateMutation.isPending}>
                  Record Manual Payment
                </Button>
              )}
            </div>
          )}

          {/* Status Section */}
          {status !== 'idle' && (
            <div
              className={`rounded-[10px] border p-4 flex items-center gap-4 transition-colors ${
                status === 'completed'
                  ? 'bg-green-50 dark:bg-green-950 border-[#6fd943]/40'
                  : status === 'failed'
                  ? 'bg-red-50 dark:bg-red-950 border-[#ff3a6e]/40'
                  : 'bg-amber-50 dark:bg-amber-950 border-[#ffa21d]/40'
              }`}
            >
              {isProcessing ? (
                <Spinner size="sm" />
              ) : status === 'completed' ? (
                <svg className="h-6 w-6 flex-shrink-0 text-[#6fd943]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-6 w-6 flex-shrink-0 text-[#ff3a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <StatusBadge status={status} />
                  {paymentId && (
                    <span className="text-xs text-gray-400 font-mono truncate">#{paymentId}</span>
                  )}
                </div>
                {statusMessage && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{statusMessage}</p>
                )}
                {isProcessing && (
                  <p className="text-xs text-gray-400 mt-0.5">Checking every 3 seconds…</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          {status === 'failed' && (
            <Button
              variant="ghost"
              onClick={() => {
                setStatus('idle')
                setStatusMessage('')
                setPaymentId(null)
                if (pollRef.current) clearInterval(pollRef.current)
              }}
            >
              Try Again
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            {isTerminal ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export { PaymentProcessing }
