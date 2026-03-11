import { useState } from 'react'
import { Button, Badge, Card, Table, Modal, Input, toast } from '../../components/ui'
import apiClient from '../../api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GiftCard {
  id: string
  card_number: string
  original_amount: number
  current_balance: number
  customer_id: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

interface PaginatedGiftCards {
  total: number
  gift_cards: GiftCard[]
}

interface IssueGiftCardPayload {
  card_number: string
  original_amount: number
  customer_id?: string
  expires_at?: string
}

interface LoadBalancePayload {
  amount: number
}

// ─── Empty form defaults ──────────────────────────────────────────────────────

const emptyIssueForm: IssueGiftCardPayload = {
  card_number: '',
  original_amount: 0,
  customer_id: '',
  expires_at: '',
}

const emptyLoadForm: LoadBalancePayload = {
  amount: 0,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GiftCardsPage() {
  const qc = useQueryClient()

  // ─── Query ──────────────────────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey: ['pos', 'gift-cards'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedGiftCards>('/pos/gift-cards')
      return data
    },
  })

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const issueCard = useMutation({
    mutationFn: async (payload: IssueGiftCardPayload) => {
      const { data } = await apiClient.post<GiftCard>('/pos/gift-cards', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'gift-cards'] }),
  })

  const loadBalance = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data } = await apiClient.post<GiftCard>(`/pos/gift-cards/${id}/load`, { amount })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'gift-cards'] }),
  })

  const deactivateCard = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<GiftCard>(`/pos/gift-cards/${id}/deactivate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'gift-cards'] }),
  })

  // ─── Modal state ────────────────────────────────────────────────────────────
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState<GiftCard | null>(null)

  const [issueForm, setIssueForm] = useState<IssueGiftCardPayload>(emptyIssueForm)
  const [loadForm, setLoadForm] = useState<LoadBalancePayload>(emptyLoadForm)

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const resetIssueModal = () => {
    setIssueForm(emptyIssueForm)
    setShowIssueModal(false)
  }

  const resetLoadModal = () => {
    setLoadForm(emptyLoadForm)
    setSelectedCard(null)
    setShowLoadModal(false)
  }

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: IssueGiftCardPayload = {
        card_number: issueForm.card_number,
        original_amount: issueForm.original_amount,
        ...(issueForm.customer_id ? { customer_id: issueForm.customer_id } : {}),
        ...(issueForm.expires_at ? { expires_at: issueForm.expires_at } : {}),
      }
      await issueCard.mutateAsync(payload)
      toast('success', 'Gift card issued successfully')
      resetIssueModal()
    } catch {
      toast('error', 'Failed to issue gift card')
    }
  }

  const handleLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCard) return
    try {
      await loadBalance.mutateAsync({ id: selectedCard.id, amount: loadForm.amount })
      toast('success', 'Balance loaded successfully')
      resetLoadModal()
    } catch {
      toast('error', 'Failed to load balance')
    }
  }

  const handleDeactivate = async (card: GiftCard) => {
    if (!confirm(`Deactivate gift card ${card.card_number}?`)) return
    try {
      await deactivateCard.mutateAsync(card.id)
      toast('success', 'Gift card deactivated')
    } catch {
      toast('error', 'Failed to deactivate gift card')
    }
  }

  const openLoadModal = (card: GiftCard) => {
    setSelectedCard(card)
    setLoadForm(emptyLoadForm)
    setShowLoadModal(true)
  }

  // ─── Status badge helper ─────────────────────────────────────────────────────
  const getStatusBadge = (card: GiftCard) => {
    if (!card.is_active) return <Badge variant="default">Inactive</Badge>
    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      return <Badge variant="warning">Expired</Badge>
    }
    return <Badge variant="success">Active</Badge>
  }

  if (error) return <div className="p-6 text-danger">Failed to load gift cards</div>

  // ─── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'card_number',
      label: 'Card Number',
      render: (r: GiftCard) => (
        <span className="font-mono text-sm font-medium text-gray-900">{r.card_number}</span>
      ),
    },
    {
      key: 'original_amount',
      label: 'Original',
      render: (r: GiftCard) => (
        <span className="text-sm text-gray-700">${r.original_amount.toFixed(2)}</span>
      ),
    },
    {
      key: 'current_balance',
      label: 'Balance',
      render: (r: GiftCard) => (
        <span
          className="text-sm font-semibold"
          style={{ color: r.current_balance > 0 ? '#6fd943' : '#ff3a6e' }}
        >
          ${r.current_balance.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'customer_id',
      label: 'Customer',
      render: (r: GiftCard) => (
        <span className="text-sm text-gray-500">{r.customer_id || '-'}</span>
      ),
    },
    {
      key: 'expires_at',
      label: 'Expires',
      render: (r: GiftCard) => (
        <span className="text-sm text-gray-500">
          {r.expires_at ? new Date(r.expires_at).toLocaleDateString() : 'No expiry'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: GiftCard) => getStatusBadge(r),
    },
    {
      key: 'actions',
      label: '',
      render: (r: GiftCard) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => openLoadModal(r)}>
            Load
          </Button>
          {r.is_active && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDeactivate(r)}
              loading={deactivateCard.isPending}
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gift Cards</h1>
          <p className="text-sm text-gray-500 mt-1">Issue and manage POS gift cards</p>
        </div>
        <Button onClick={() => { resetIssueModal(); setShowIssueModal(true) }}>
          Issue Gift Card
        </Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-[10px]">
          <p className="text-sm text-gray-500">Total Issued</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#51459d' }}>
            {data?.total ?? 0}
          </p>
        </Card>
        <Card className="rounded-[10px]">
          <p className="text-sm text-gray-500">Active Cards</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#6fd943' }}>
            {data?.gift_cards.filter((c) => c.is_active && (!c.expires_at || new Date(c.expires_at) >= new Date())).length ?? 0}
          </p>
        </Card>
        <Card className="rounded-[10px]">
          <p className="text-sm text-gray-500">Outstanding Balance</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#3ec9d6' }}>
            ${(data?.gift_cards.reduce((sum, c) => sum + c.current_balance, 0) ?? 0).toFixed(2)}
          </p>
        </Card>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table
          columns={columns}
          data={data?.gift_cards ?? []}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No gift cards found"
        />
      </Card>

      {/* Issue Gift Card Modal */}
      <Modal
        open={showIssueModal}
        onClose={resetIssueModal}
        title="Issue Gift Card"
        size="lg"
      >
        <form onSubmit={handleIssueSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Card Number"
              value={issueForm.card_number}
              onChange={(e) => setIssueForm({ ...issueForm, card_number: e.target.value })}
              placeholder="e.g. GC-20240311-001"
              required
            />
            <Input
              label="Original Amount ($)"
              type="number"
              step="0.01"
              min="0.01"
              value={issueForm.original_amount || ''}
              onChange={(e) =>
                setIssueForm({ ...issueForm, original_amount: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Customer ID (optional)"
              value={issueForm.customer_id || ''}
              onChange={(e) => setIssueForm({ ...issueForm, customer_id: e.target.value })}
              placeholder="Leave blank for anonymous"
            />
            <Input
              label="Expiry Date (optional)"
              type="date"
              value={issueForm.expires_at || ''}
              onChange={(e) => setIssueForm({ ...issueForm, expires_at: e.target.value || undefined })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetIssueModal}>
              Cancel
            </Button>
            <Button type="submit" loading={issueCard.isPending}>
              Issue Card
            </Button>
          </div>
        </form>
      </Modal>

      {/* Load Balance Modal */}
      <Modal
        open={showLoadModal}
        onClose={resetLoadModal}
        title="Load Balance"
        size="sm"
      >
        {selectedCard && (
          <form onSubmit={handleLoadSubmit} className="space-y-4">
            <div className="rounded-[10px] p-4 bg-gray-50 space-y-1">
              <p className="text-sm text-gray-500">Card</p>
              <p className="font-mono font-medium text-gray-900">{selectedCard.card_number}</p>
              <p className="text-sm text-gray-500 mt-2">Current Balance</p>
              <p className="text-xl font-bold" style={{ color: '#51459d' }}>
                ${selectedCard.current_balance.toFixed(2)}
              </p>
            </div>
            <Input
              label="Amount to Load ($)"
              type="number"
              step="0.01"
              min="0.01"
              value={loadForm.amount || ''}
              onChange={(e) => setLoadForm({ amount: parseFloat(e.target.value) || 0 })}
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={resetLoadModal}>
                Cancel
              </Button>
              <Button type="submit" loading={loadBalance.isPending}>
                Load Balance
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
