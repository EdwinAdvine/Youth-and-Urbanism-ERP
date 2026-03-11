import { useState } from 'react'
import { Button, Badge, Card, Table, Modal, Input, toast } from '../../components/ui'
import apiClient from '../../api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreCredit {
  id: string
  customer_id: string
  customer_name: string | null
  customer_email: string | null
  current_balance: number
  created_at: string
  updated_at: string
}

interface StoreCreditTransaction {
  id: string
  store_credit_id: string
  amount: number
  balance_after: number
  reason: string
  created_at: string
}

interface StoreCreditDetail extends StoreCredit {
  transactions: StoreCreditTransaction[]
}

interface PaginatedStoreCredits {
  total: number
  store_credits: StoreCredit[]
}

interface AdjustCreditPayload {
  customer_id: string
  amount: number
  reason: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoreCreditLookup() {
  const qc = useQueryClient()

  // ─── Search state ────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [selectedCredit, setSelectedCredit] = useState<StoreCredit | null>(null)

  // ─── Modal state ─────────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUseModal, setShowUseModal] = useState(false)
  const [addForm, setAddForm] = useState({ amount: 0, reason: '' })
  const [useForm, setUseForm] = useState({ amount: 0, reason: '' })

  // ─── Query: list store credits (search by customer) ──────────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey: ['pos', 'store-credits', committedSearch],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (committedSearch) params.customer_id = committedSearch
      const { data } = await apiClient.get<PaginatedStoreCredits>('/pos/store-credits', { params })
      return data
    },
  })

  // ─── Query: fetch detail + transaction history for selected customer ──────────
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['pos', 'store-credits', selectedCredit?.customer_id, 'detail'],
    queryFn: async () => {
      const { data } = await apiClient.get<StoreCreditDetail>(
        `/pos/store-credits`,
        { params: { customer_id: selectedCredit!.customer_id } },
      )
      // The API returns a paginated list; we take the first match
      const list = data as unknown as PaginatedStoreCredits
      return list.store_credits?.[0] as StoreCreditDetail | undefined
    },
    enabled: !!selectedCredit,
  })

  // ─── Mutation: adjust (add/use) store credit ─────────────────────────────────
  const adjustCredit = useMutation({
    mutationFn: async (payload: AdjustCreditPayload) => {
      const { data } = await apiClient.post('/pos/store-credits/adjust', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'store-credits'] })
    },
  })

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCommittedSearch(searchTerm.trim())
    setSelectedCredit(null)
  }

  const resetAddModal = () => {
    setAddForm({ amount: 0, reason: '' })
    setShowAddModal(false)
  }

  const resetUseModal = () => {
    setUseForm({ amount: 0, reason: '' })
    setShowUseModal(false)
  }

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCredit) return
    try {
      await adjustCredit.mutateAsync({
        customer_id: selectedCredit.customer_id,
        amount: addForm.amount,
        reason: addForm.reason,
      })
      toast('success', 'Store credit added')
      resetAddModal()
    } catch {
      toast('error', 'Failed to add store credit')
    }
  }

  const handleUseCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCredit) return
    if (useForm.amount > selectedCredit.current_balance) {
      toast('error', 'Amount exceeds available balance')
      return
    }
    try {
      await adjustCredit.mutateAsync({
        customer_id: selectedCredit.customer_id,
        amount: -Math.abs(useForm.amount),
        reason: useForm.reason,
      })
      toast('success', 'Store credit applied')
      resetUseModal()
    } catch {
      toast('error', 'Failed to use store credit')
    }
  }

  // ─── Transaction history table columns ───────────────────────────────────────
  const txColumns = [
    {
      key: 'amount',
      label: 'Amount',
      render: (r: StoreCreditTransaction) => (
        <span
          className="font-medium text-sm"
          style={{ color: r.amount >= 0 ? '#6fd943' : '#ff3a6e' }}
        >
          {r.amount >= 0 ? '+' : ''}
          {r.amount.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'balance_after',
      label: 'Balance After',
      render: (r: StoreCreditTransaction) => (
        <span className="text-sm text-gray-700">${r.balance_after.toFixed(2)}</span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (r: StoreCreditTransaction) => (
        <span className="text-sm text-gray-600">{r.reason}</span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (r: StoreCreditTransaction) => (
        <span className="text-sm text-gray-500">
          {new Date(r.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ]

  // ─── Result list columns ─────────────────────────────────────────────────────
  const resultColumns = [
    {
      key: 'customer',
      label: 'Customer',
      render: (r: StoreCredit) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{r.customer_name || r.customer_id}</p>
          {r.customer_email && (
            <p className="text-xs text-gray-500">{r.customer_email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'current_balance',
      label: 'Balance',
      render: (r: StoreCredit) => (
        <Badge variant={r.current_balance > 0 ? 'success' : 'default'}>
          ${r.current_balance.toFixed(2)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: StoreCredit) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedCredit(r)}
        >
          View
        </Button>
      ),
    },
  ]

  if (error) return <div className="p-6 text-danger">Failed to load store credits</div>

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Store Credit Lookup</h1>
        <p className="text-sm text-gray-500 mt-1">Search and manage customer store credit balances</p>
      </div>

      {/* Search bar */}
      <Card className="rounded-[10px]">
        <form onSubmit={handleSearch} className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Search by Customer Email or Name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter email address, name, or customer ID..."
            />
          </div>
          <Button type="submit" loading={isLoading}>
            Search
          </Button>
          {committedSearch && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchTerm('')
                setCommittedSearch('')
                setSelectedCredit(null)
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </Card>

      {/* Detail panel for selected customer */}
      {selectedCredit && (
        <Card className="rounded-[10px] space-y-6">
          {/* Customer info + balance */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">Customer</p>
              <p className="text-lg font-bold text-gray-900">
                {selectedCredit.customer_name || selectedCredit.customer_id}
              </p>
              {selectedCredit.customer_email && (
                <p className="text-sm text-gray-500">{selectedCredit.customer_email}</p>
              )}
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">Available Balance</p>
              <p
                className="text-4xl font-bold"
                style={{ color: selectedCredit.current_balance > 0 ? '#51459d' : '#ff3a6e' }}
              >
                ${selectedCredit.current_balance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => { setAddForm({ amount: 0, reason: '' }); setShowAddModal(true) }}
            >
              Add Credit
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setUseForm({ amount: 0, reason: '' }); setShowUseModal(true) }}
              disabled={selectedCredit.current_balance <= 0}
            >
              Use Credit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCredit(null)}
              className="ml-auto"
            >
              Close
            </Button>
          </div>

          {/* Transaction history */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Transaction History
            </h2>
            <Table
              columns={txColumns}
              data={(detailData as StoreCreditDetail | undefined)?.transactions ?? []}
              loading={detailLoading}
              keyExtractor={(r) => r.id}
              emptyText="No transactions yet"
            />
          </div>
        </Card>
      )}

      {/* Search results list */}
      {!selectedCredit && (
        <Card padding={false}>
          <Table
            columns={resultColumns}
            data={data?.store_credits ?? []}
            loading={isLoading}
            keyExtractor={(r) => r.id}
            emptyText={
              committedSearch
                ? 'No store credits found for this customer'
                : 'Search for a customer above to see their store credit'
            }
          />
        </Card>
      )}

      {/* Add Credit Modal */}
      <Modal
        open={showAddModal}
        onClose={resetAddModal}
        title="Add Store Credit"
        size="sm"
      >
        {selectedCredit && (
          <form onSubmit={handleAddCredit} className="space-y-4">
            <div className="rounded-[10px] p-4 bg-gray-50 space-y-1">
              <p className="text-sm text-gray-500">Customer</p>
              <p className="font-medium text-gray-900">
                {selectedCredit.customer_name || selectedCredit.customer_id}
              </p>
              <p className="text-sm text-gray-500 mt-2">Current Balance</p>
              <p className="text-xl font-bold" style={{ color: '#51459d' }}>
                ${selectedCredit.current_balance.toFixed(2)}
              </p>
            </div>
            <Input
              label="Amount to Add ($)"
              type="number"
              step="0.01"
              min="0.01"
              value={addForm.amount || ''}
              onChange={(e) => setAddForm({ ...addForm, amount: parseFloat(e.target.value) || 0 })}
              required
            />
            <Input
              label="Reason"
              value={addForm.reason}
              onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
              placeholder="e.g. Return refund, Loyalty reward..."
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={resetAddModal}>
                Cancel
              </Button>
              <Button type="submit" loading={adjustCredit.isPending}>
                Add Credit
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Use Credit Modal */}
      <Modal
        open={showUseModal}
        onClose={resetUseModal}
        title="Use Store Credit"
        size="sm"
      >
        {selectedCredit && (
          <form onSubmit={handleUseCredit} className="space-y-4">
            <div className="rounded-[10px] p-4 bg-gray-50 space-y-1">
              <p className="text-sm text-gray-500">Customer</p>
              <p className="font-medium text-gray-900">
                {selectedCredit.customer_name || selectedCredit.customer_id}
              </p>
              <p className="text-sm text-gray-500 mt-2">Available Balance</p>
              <p className="text-xl font-bold" style={{ color: '#6fd943' }}>
                ${selectedCredit.current_balance.toFixed(2)}
              </p>
            </div>
            <Input
              label="Amount to Use ($)"
              type="number"
              step="0.01"
              min="0.01"
              max={selectedCredit.current_balance}
              value={useForm.amount || ''}
              onChange={(e) => setUseForm({ ...useForm, amount: parseFloat(e.target.value) || 0 })}
              required
            />
            <Input
              label="Reason"
              value={useForm.reason}
              onChange={(e) => setUseForm({ ...useForm, reason: e.target.value })}
              placeholder="e.g. Applied to order #1234..."
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={resetUseModal}>
                Cancel
              </Button>
              <Button type="submit" loading={adjustCredit.isPending} variant="danger">
                Apply Credit
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
