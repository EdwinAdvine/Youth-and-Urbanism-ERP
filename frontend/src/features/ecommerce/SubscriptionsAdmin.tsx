import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Badge, Table, Select, toast } from '../../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

type SubStatus = 'all' | 'active' | 'paused' | 'cancelled'

interface AdminSubscription {
  id: string
  customer_email: string
  product_name: string
  frequency_days: number
  next_billing_date: string
  status: 'active' | 'paused' | 'cancelled'
  total_value: number
}

interface SubscriptionMetrics {
  mrr: number
  arr: number
  active_count: number
  paused_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<AdminSubscription['status'], 'success' | 'warning' | 'danger'> = {
  active: 'success', paused: 'warning', cancelled: 'danger',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionsAdmin() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<SubStatus>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: metrics } = useQuery<SubscriptionMetrics>({
    queryKey: ['subscriptions-metrics'],
    queryFn: async () => ({ mrr: 0, arr: 0, active_count: 0, paused_count: 0 }),
  })

  const { data: subscriptions = [], isLoading } = useQuery<AdminSubscription[]>({
    queryKey: ['admin-subscriptions', statusFilter],
    queryFn: async () => [],
  })

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: 'pause' | 'cancel' }) => {
      // POST /api/v1/ecommerce/subscriptions/bulk/{action}
      return { ids, action }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] })
      qc.invalidateQueries({ queryKey: ['subscriptions-metrics'] })
      toast('success', `${vars.ids.length} subscription(s) ${vars.action === 'pause' ? 'paused' : 'cancelled'}`)
      setSelected(new Set())
    },
    onError: () => toast('error', 'Bulk action failed'),
  })

  const handleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((s) => s.id)))
    }
  }

  const handleToggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const filtered = statusFilter === 'all'
    ? subscriptions
    : subscriptions.filter((s) => s.status === statusFilter)

  const mrrCards = [
    { label: 'Monthly Recurring Revenue', value: formatCurrency(metrics?.mrr ?? 0), color: 'text-green-600 bg-green-50', span: true },
    { label: 'Annual Recurring Revenue', value: formatCurrency(metrics?.arr ?? 0), color: 'text-blue-600 bg-blue-50', span: true },
    { label: 'Active Subscriptions', value: String(metrics?.active_count ?? 0), color: 'text-purple-600 bg-purple-50', span: false },
    { label: 'Paused Subscriptions', value: String(metrics?.paused_count ?? 0), color: 'text-orange-600 bg-orange-50', span: false },
  ]

  const columns = [
    {
      key: 'select', label: '',
      render: (r: AdminSubscription) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => handleToggle(r.id)}
          className="rounded w-4 h-4 accent-primary"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    { key: 'customer_email', label: 'Customer', render: (r: AdminSubscription) => <span className="font-medium text-gray-900">{r.customer_email}</span> },
    { key: 'product_name', label: 'Product', render: (r: AdminSubscription) => <span className="text-gray-700">{r.product_name}</span> },
    {
      key: 'frequency_days', label: 'Frequency',
      render: (r: AdminSubscription) => <span className="text-gray-600 text-sm">Every {r.frequency_days}d</span>,
    },
    {
      key: 'next_billing_date', label: 'Next Billing',
      render: (r: AdminSubscription) => <span className="text-gray-500 text-xs">{r.status !== 'cancelled' ? formatDate(r.next_billing_date) : '—'}</span>,
    },
    { key: 'status', label: 'Status', render: (r: AdminSubscription) => <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge> },
    {
      key: 'total_value', label: 'Value',
      render: (r: AdminSubscription) => <span className="font-medium text-gray-900">{formatCurrency(r.total_value)}</span>,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-sm text-gray-500 mt-1">Manage recurring subscription orders across all customers</p>
      </div>

      {/* MRR / ARR + Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mrrCards.map((card) => (
          <Card key={card.label}>
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-[10px] mb-3 ${card.color}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters + Bulk Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as SubStatus); setSelected(new Set()) }}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{selected.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              loading={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ ids: Array.from(selected), action: 'pause' })}
            >
              Pause Selected
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={bulkMutation.isPending}
              onClick={() => {
                if (confirm(`Cancel ${selected.size} subscription(s)?`))
                  bulkMutation.mutate({ ids: Array.from(selected), action: 'cancel' })
              }}
            >
              Cancel Selected
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={filtered.length > 0 && selected.size === filtered.length}
              onChange={handleSelectAll}
              className="rounded w-4 h-4 accent-primary"
            />
            <span className="text-sm text-gray-500">{filtered.length} subscription{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <Table<AdminSubscription>
          columns={columns}
          data={filtered}
          loading={isLoading}
          emptyText="No subscriptions found"
          keyExtractor={(r) => r.id}
        />
      </Card>
    </div>
  )
}
