import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Select, Badge, Spinner, toast } from '../../components/ui'
import {
  useCashMovements,
  useCreateCashMovement,
  type POSCashMovement,
  type CreateCashMovementPayload,
} from '../../api/pos_ext'
import { useActiveSession, type POSSessionData } from '../../api/pos'

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
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Cash Movement Modal ────────────────────────────────────────────────────

function CashMovementModal({
  session,
  onSubmit,
  onClose,
  isLoading,
}: {
  session: POSSessionData
  onSubmit: (payload: CreateCashMovementPayload) => void
  onClose: () => void
  isLoading: boolean
}) {
  const [type, setType] = useState<'cash_in' | 'cash_out'>('cash_in')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast('error', 'Please enter a valid amount')
      return
    }
    onSubmit({
      session_id: session.id,
      type,
      amount: parseFloat(amount),
      reason,
      reference: reference || undefined,
    })
  }

  return (
    <Modal open onClose={onClose} title="Record Cash Movement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as 'cash_in' | 'cash_out')}
          options={[
            { value: 'cash_in', label: 'Cash In' },
            { value: 'cash_out', label: 'Cash Out' },
          ]}
        />
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
        <Input
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Petty cash withdrawal"
          required
        />
        <Input
          label="Reference (optional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. Receipt #123"
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            Record Movement
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CashManagementPage() {
  const { data: session, isLoading: sessionLoading } = useActiveSession()
  const { data: movementsData, isLoading: movementsLoading } = useCashMovements({
    session_id: session?.id,
  })
  const createMovement = useCreateCashMovement()
  const [showModal, setShowModal] = useState(false)

  const movements = movementsData?.movements ?? []

  const totalIn = movements
    .filter((m) => m.type === 'cash_in')
    .reduce((sum, m) => sum + m.amount, 0)
  const totalOut = movements
    .filter((m) => m.type === 'cash_out')
    .reduce((sum, m) => sum + m.amount, 0)
  const netMovement = totalIn - totalOut

  const handleCreateMovement = async (payload: CreateCashMovementPayload) => {
    try {
      await createMovement.mutateAsync(payload)
      toast('success', 'Cash movement recorded')
      setShowModal(false)
    } catch {
      toast('error', 'Failed to record cash movement')
    }
  }

  const columns = [
    {
      key: 'created_at',
      label: 'Date / Time',
      render: (row: POSCashMovement) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row: POSCashMovement) => (
        <Badge variant={row.type === 'cash_in' ? 'success' : 'danger'}>
          {row.type === 'cash_in' ? 'Cash In' : 'Cash Out'}
        </Badge>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: POSCashMovement) => (
        <span
          className={`font-medium ${row.type === 'cash_in' ? 'text-green-600' : 'text-red-600'}`}
        >
          {row.type === 'cash_in' ? '+' : '-'}
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row: POSCashMovement) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{row.reason}</span>
      ),
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (row: POSCashMovement) => (
        <span className="text-sm text-gray-500">{row.reference || '-'}</span>
      ),
    },
    {
      key: 'created_by_name',
      label: 'Recorded By',
      render: (row: POSCashMovement) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{row.created_by_name || '-'}</span>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cash Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track cash drawer movements and reconciliation
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          disabled={!session}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Record Movement
        </Button>
      </div>

      {/* Active Session Info */}
      {sessionLoading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : session ? (
        <div className="bg-green-50 border border-green-200 rounded-[10px] p-4">
          <p className="text-sm font-medium text-green-800">
            Active Session: <span className="font-bold">{session.session_number}</span>
          </p>
          <p className="text-xs text-green-600 mt-1">
            Opened {formatDateTime(session.opened_at)} - Opening balance{' '}
            {formatCurrency(session.opening_balance)}
          </p>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-[10px] p-4">
          <p className="text-sm font-medium text-yellow-800">
            No active session. Open a POS session to manage cash.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Opening Balance</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {session ? formatCurrency(session.opening_balance) : '-'}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Cash In</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalIn)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Cash Out</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalOut)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Net Movement</p>
          <p
            className={`text-2xl font-bold mt-1 ${ netMovement >= 0 ? 'text-green-600' : 'text-red-600' }`}
          >
            {netMovement >= 0 ? '+' : ''}
            {formatCurrency(netMovement)}
          </p>
        </Card>
      </div>

      {/* Expected Drawer Balance */}
      {session && (
        <Card className="bg-gray-50 dark:bg-gray-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Expected Drawer Balance</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Opening balance + cash in - cash out (excluding sales)
              </p>
            </div>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(session.opening_balance + netMovement)}
            </p>
          </div>
        </Card>
      )}

      {/* Cash Movements Table */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cash Movements</h2>
        </div>
        <Table<POSCashMovement>
          columns={columns}
          data={movements}
          loading={movementsLoading}
          emptyText="No cash movements recorded"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Cash Movement Modal */}
      {showModal && session && (
        <CashMovementModal
          session={session}
          onSubmit={handleCreateMovement}
          onClose={() => setShowModal(false)}
          isLoading={createMovement.isPending}
        />
      )}
    </div>
  )
}
