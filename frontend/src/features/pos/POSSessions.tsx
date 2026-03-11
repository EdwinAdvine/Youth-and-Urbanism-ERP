import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table } from '../../components/ui'
import {
  usePOSSessions,
  useOpenSession,
  useCloseSession,
  useActiveSession,
  type POSSessionData,
} from '../../api/pos'
import { useWarehouses, type Warehouse } from '../../api/inventory'

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

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  open: 'success',
  closed: 'default',
  reconciled: 'info',
}

// ─── Open Session Modal ──────────────────────────────────────────────────────

function OpenSessionModal({
  warehouses,
  onOpen,
  onClose,
  isLoading,
}: {
  warehouses: Warehouse[]
  onOpen: (warehouseId: string, openingBalance: number) => void
  onClose: () => void
  isLoading: boolean
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '')
  const [openingBalance, setOpeningBalance] = useState('0')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Open POS Session</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse / Location</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.location ? `(${w.location})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opening Cash Balance</label>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => onOpen(warehouseId, parseFloat(openingBalance || '0'))}
            disabled={isLoading || !warehouseId}
          >
            {isLoading ? <Spinner size="sm" /> : 'Open Session'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Close Session Modal ────────────────────────────────────────────────────

function CloseSessionModal({
  session,
  onConfirm,
  onClose,
  isLoading,
}: {
  session: POSSessionData
  onConfirm: (closingBalance: number, notes?: string) => void
  onClose: () => void
  isLoading: boolean
}) {
  const [closingBalance, setClosingBalance] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Close Session</h2>
        <p className="text-sm text-gray-500 mb-4">
          Session <span className="font-medium">{session.session_number}</span> - Opened{' '}
          {formatDateTime(session.opened_at)}
        </p>

        <div className="bg-gray-50 rounded-[10px] p-3 mb-4">
          <p className="text-sm text-gray-600">
            Opening Balance: <span className="font-semibold">{formatCurrency(session.opening_balance)}</span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Closing Cash Balance</label>
            <input
              type="number"
              step="0.01"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              placeholder="Count your cash drawer"
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => onConfirm(parseFloat(closingBalance || '0'), notes || undefined)}
            disabled={isLoading || !closingBalance}
          >
            {isLoading ? <Spinner size="sm" /> : 'Close Session'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function POSSessions() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [closingSession, setClosingSession] = useState<POSSessionData | null>(null)

  const { data: sessionsData, isLoading } = usePOSSessions({ status: statusFilter })
  const { data: activeSession } = useActiveSession()
  const { data: warehouses } = useWarehouses()
  const openSession = useOpenSession()
  const closeSession = useCloseSession()

  const handleOpenSession = async (warehouseId: string, openingBalance: number) => {
    try {
      await openSession.mutateAsync({ warehouse_id: warehouseId, opening_balance: openingBalance })
      setShowOpenModal(false)
    } catch {
      // Error handled by mutation
    }
  }

  const handleCloseSession = async (closingBalance: number, notes?: string) => {
    if (!closingSession) return
    try {
      await closeSession.mutateAsync({ id: closingSession.id, closing_balance: closingBalance, notes })
      setClosingSession(null)
    } catch {
      // Error handled by mutation
    }
  }

  const columns = [
    {
      key: 'session_number',
      label: 'Session #',
      render: (row: POSSessionData) => (
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => navigate(`/pos/sessions/${row.id}`)}
        >
          {row.session_number}
        </button>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: POSSessionData) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>{row.status}</Badge>
      ),
    },
    {
      key: 'opened_at',
      label: 'Opened',
      render: (row: POSSessionData) => formatDateTime(row.opened_at),
    },
    {
      key: 'closed_at',
      label: 'Closed',
      render: (row: POSSessionData) => formatDateTime(row.closed_at),
    },
    {
      key: 'opening_balance',
      label: 'Opening',
      render: (row: POSSessionData) => formatCurrency(row.opening_balance),
    },
    {
      key: 'closing_balance',
      label: 'Closing',
      render: (row: POSSessionData) => formatCurrency(row.closing_balance),
    },
    {
      key: 'difference',
      label: 'Difference',
      render: (row: POSSessionData) => {
        if (row.difference === null || row.difference === undefined) return '-'
        const diff = typeof row.difference === 'string' ? parseFloat(row.difference) : row.difference
        return (
          <span className={cn('font-medium', diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600')}>
            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: '',
      render: (row: POSSessionData) =>
        row.status === 'open' ? (
          <Button size="sm" variant="outline" onClick={() => setClosingSession(row)}>
            Close
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Sessions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage register sessions and cash reconciliation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/pos')}>
            Dashboard
          </Button>
          {activeSession ? (
            <Button onClick={() => navigate('/pos/terminal')}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Go to Terminal
            </Button>
          ) : (
            <Button onClick={() => setShowOpenModal(true)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Open Session
            </Button>
          )}
        </div>
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <div className="bg-green-50 border border-green-200 rounded-[10px] p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800">
              Active Session: <span className="font-bold">{activeSession.session_number}</span>
            </p>
            <p className="text-xs text-green-600 mt-1">
              Opened {formatDateTime(activeSession.opened_at)} - Opening balance{' '}
              {formatCurrency(activeSession.opening_balance)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/pos/terminal')}>
              Go to Terminal
            </Button>
            <Button size="sm" variant="outline" onClick={() => setClosingSession(activeSession)}>
              Close Session
            </Button>
          </div>
        </div>
      )}

      {/* Status Filters */}
      <div className="flex gap-2 mb-4">
        {[
          { label: 'All', value: undefined },
          { label: 'Open', value: 'open' },
          { label: 'Closed', value: 'closed' },
          { label: 'Reconciled', value: 'reconciled' },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      <Card padding={false}>
        <Table<POSSessionData>
          columns={columns}
          data={sessionsData?.sessions ?? []}
          loading={isLoading}
          emptyText="No POS sessions found"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Open Session Modal */}
      {showOpenModal && warehouses && (
        <OpenSessionModal
          warehouses={warehouses}
          onOpen={handleOpenSession}
          onClose={() => setShowOpenModal(false)}
          isLoading={openSession.isPending}
        />
      )}

      {/* Close Session Modal */}
      {closingSession && (
        <CloseSessionModal
          session={closingSession}
          onConfirm={handleCloseSession}
          onClose={() => setClosingSession(null)}
          isLoading={closeSession.isPending}
        />
      )}
    </div>
  )
}
