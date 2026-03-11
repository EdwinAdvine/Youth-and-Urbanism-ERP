import { useState } from 'react'
import { Button, Card, Badge, Spinner, toast, Modal } from '../../components/ui'
import {
  useHeldTransactions,
  useResumeHeldTransaction,
  useCancelHeldTransaction,
  type POSTransactionDetail,
} from '../../api/pos'

function timeSince(dateStr: string): string {
  const held = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - held.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface HeldTransactionsProps {
  sessionId?: string
}

export default function HeldTransactions({ sessionId }: HeldTransactionsProps) {
  const { data: held, isLoading } = useHeldTransactions(sessionId)
  const resumeMutation = useResumeHeldTransaction()
  const cancelMutation = useCancelHeldTransaction()
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)

  const handleResume = async (txn: POSTransactionDetail) => {
    try {
      await resumeMutation.mutateAsync(txn.id)
      toast('success', `Resumed transaction ${txn.transaction_number}`)
    } catch {
      toast('error', 'Failed to resume transaction')
    }
  }

  const handleCancelConfirm = async () => {
    if (!confirmCancelId) return
    try {
      await cancelMutation.mutateAsync(confirmCancelId)
      toast('success', 'Held transaction cancelled')
    } catch {
      toast('error', 'Failed to cancel transaction')
    } finally {
      setConfirmCancelId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const transactions = held ?? []

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Held Transactions
        </h3>
        <Badge variant="primary">{transactions.length}</Badge>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No held transactions</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {txn.transaction_number}
                  </span>
                  <Badge variant="warning">Held</Badge>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {txn.customer_name || 'Walk-in Customer'}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{txn.lines.length} item{txn.lines.length !== 1 ? 's' : ''}</span>
                  <span>{txn.held_at ? timeSince(txn.held_at) : ''}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-4">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  ${txn.total.toFixed(2)}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  loading={resumeMutation.isPending}
                  onClick={() => handleResume(txn)}
                >
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={cancelMutation.isPending}
                  onClick={() => setConfirmCancelId(txn.id)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!confirmCancelId}
        onClose={() => setConfirmCancelId(null)}
        title="Cancel Held Transaction"
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to cancel this held transaction? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmCancelId(null)}>
            Keep
          </Button>
          <Button
            variant="danger"
            loading={cancelMutation.isPending}
            onClick={handleCancelConfirm}
          >
            Cancel Transaction
          </Button>
        </div>
      </Modal>
    </Card>
  )
}
