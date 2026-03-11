import { useParams, useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table } from '../../components/ui'
import { useState } from 'react'
import {
  usePOSSession,
  useSessionReconciliation,
  usePOSTransactions,
  useVoidTransaction,
  type POSTransactionData,
} from '../../api/pos'

function formatCurrency(amount: number | string | null) {
  if (amount === null || amount === undefined) return '-'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const TXN_STATUS_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  completed: 'success',
  refunded: 'warning',
  voided: 'danger',
}

export default function POSSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: session, isLoading: sessionLoading } = usePOSSession(id ?? '')
  const { data: reconciliation, isLoading: reconLoading } = useSessionReconciliation(id ?? '')
  const { data: txnData, isLoading: txnLoading } = usePOSTransactions({ session_id: id, limit: 100 })
  const voidTransaction = useVoidTransaction()
  const [voidConfirmId, setVoidConfirmId] = useState<string | null>(null)
  const [voidSuccess, setVoidSuccess] = useState<string | null>(null)

  if (sessionLoading || reconLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Session not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/pos/sessions')}>
          Back to Sessions
        </Button>
      </div>
    )
  }

  const txnCounts = reconciliation?.transaction_counts ?? {}
  const paymentMethods = reconciliation?.payment_methods ?? {}
  const totalSales = reconciliation?.total_sales ?? '0'

  const difference = session.difference !== null && session.difference !== undefined
    ? (typeof session.difference === 'string' ? parseFloat(session.difference) : session.difference)
    : null

  const handleVoidTransaction = async (txnId: string) => {
    try {
      await voidTransaction.mutateAsync(txnId)
      setVoidConfirmId(null)
      setVoidSuccess('Transaction voided successfully.')
      setTimeout(() => setVoidSuccess(null), 3000)
    } catch {
      alert('Failed to void transaction.')
      setVoidConfirmId(null)
    }
  }

  const txnColumns = [
    {
      key: 'transaction_number',
      label: 'TXN #',
      render: (row: POSTransactionData) => (
        <span className="font-medium text-primary">{row.transaction_number}</span>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: POSTransactionData) => (
        <span className="text-gray-700">{row.customer_name || 'Walk-in'}</span>
      ),
    },
    {
      key: 'subtotal',
      label: 'Subtotal',
      render: (row: POSTransactionData) => (
        <span className="text-gray-600">{formatCurrency(row.subtotal)}</span>
      ),
    },
    {
      key: 'discount_amount',
      label: 'Discount',
      render: (row: POSTransactionData) => {
        const d = typeof row.discount_amount === 'string' ? parseFloat(row.discount_amount) : row.discount_amount
        return d > 0 ? <span className="text-orange-600">-{formatCurrency(d)}</span> : <span className="text-gray-400">-</span>
      },
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: POSTransactionData) => (
        <span className="font-semibold text-gray-900">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: POSTransactionData) => (
        <Badge variant={TXN_STATUS_BADGE[row.status] ?? 'default'}>{row.status}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Time',
      render: (row: POSTransactionData) => (
        <span className="text-gray-500 text-xs">{formatTime(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: POSTransactionData) => {
        if (row.status !== 'completed') return null
        if (voidConfirmId === row.id) {
          return (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleVoidTransaction(row.id)}
                disabled={voidTransaction.isPending}
                className="px-2 py-1 text-xs font-medium text-white bg-[#ff3a6e] rounded-[6px] hover:bg-[#e6335f] disabled:opacity-50"
              >
                {voidTransaction.isPending ? 'Voiding...' : 'Confirm'}
              </button>
              <button
                onClick={() => setVoidConfirmId(null)}
                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-[6px] hover:bg-gray-200"
              >
                No
              </button>
            </div>
          )
        }
        return (
          <button
            onClick={() => setVoidConfirmId(row.id)}
            className="px-2 py-1 text-xs font-medium text-[#ff3a6e] border border-[#ff3a6e] rounded-[6px] hover:bg-red-50"
          >
            Void
          </button>
        )
      },
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/pos/sessions')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{session.session_number}</h1>
            <p className="text-sm text-gray-500 mt-1">Session Detail and Reconciliation</p>
          </div>
        </div>
        <Badge
          variant={session.status === 'open' ? 'success' : 'default'}
          className="text-sm px-3 py-1"
        >
          {session.status.toUpperCase()}
        </Badge>
      </div>

      {/* Session Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Opened</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDateTime(session.opened_at)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Closed</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDateTime(session.closed_at)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Opening Balance</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(session.opening_balance)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Closing Balance</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(session.closing_balance)}</p>
        </Card>
      </div>

      {/* Reconciliation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Sales Summary */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Sales Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Sales</span>
              <span className="text-sm font-semibold text-gray-900">{formatCurrency(totalSales)}</span>
            </div>
            {Object.entries(txnCounts).map(([status, count]) => (
              <div key={status} className="flex justify-between">
                <span className="text-sm text-gray-600 capitalize">{status}</span>
                <Badge variant={TXN_STATUS_BADGE[status] ?? 'default'}>{count}</Badge>
              </div>
            ))}
            {Object.keys(txnCounts).length === 0 && (
              <p className="text-sm text-gray-400">No transactions</p>
            )}
          </div>
        </Card>

        {/* Payment Method Breakdown */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Payment Methods</h2>
          <div className="space-y-3">
            {Object.entries(paymentMethods).map(([method, amount]) => {
              const totalNum = parseFloat(totalSales) || 1
              const amountNum = parseFloat(amount)
              const pct = Math.round((amountNum / totalNum) * 100)
              const colors: Record<string, string> = {
                cash: 'bg-green-500',
                card: 'bg-blue-500',
                mobile_money: 'bg-purple-500',
              }
              return (
                <div key={method}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">{method.replace(/_/g, ' ')}</span>
                    <span className="text-sm text-gray-500">{formatCurrency(amount)} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', colors[method] || 'bg-gray-400')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {Object.keys(paymentMethods).length === 0 && (
              <p className="text-sm text-gray-400">No payment data</p>
            )}
          </div>
        </Card>

        {/* Cash Reconciliation */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Cash Reconciliation</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Opening Balance</span>
              <span className="text-sm font-medium">{formatCurrency(session.opening_balance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Expected Balance</span>
              <span className="text-sm font-medium">{formatCurrency(session.expected_balance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Actual Closing</span>
              <span className="text-sm font-medium">{formatCurrency(session.closing_balance)}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="text-sm font-semibold text-gray-900">Difference</span>
              {difference !== null ? (
                <span
                  className={cn(
                    'text-sm font-bold',
                    difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600'
                  )}
                >
                  {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                </span>
              ) : (
                <span className="text-sm text-gray-400">-</span>
              )}
            </div>
            {difference !== null && difference !== 0 && (
              <div className={cn(
                'rounded-[10px] p-3 text-sm',
                difference > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              )}>
                {difference > 0
                  ? 'Cash drawer has excess funds. Verify counts.'
                  : 'Cash drawer is short. Review transactions.'
                }
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Session Notes */}
      {session.notes && (
        <Card className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{session.notes}</p>
        </Card>
      )}

      {/* Void success toast */}
      {voidSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-[10px] px-4 py-3 text-sm text-green-700">
          {voidSuccess}
        </div>
      )}

      {/* Transactions Table */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Transactions
            {txnData && <span className="text-sm font-normal text-gray-500 ml-2">({txnData.total} total)</span>}
          </h2>
        </div>
        <Table<POSTransactionData>
          columns={txnColumns}
          data={txnData?.transactions ?? []}
          loading={txnLoading}
          emptyText="No transactions in this session"
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  )
}
