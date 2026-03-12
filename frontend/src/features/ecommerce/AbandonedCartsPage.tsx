import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Badge, Table, toast } from '../../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AbandonedCartConfig {
  abandonment_hours: number
  enable_recovery_discount: boolean
  discount_amount: number
}

interface AbandonedCart {
  id: string
  customer_email: string
  items_count: number
  cart_value: number
  abandoned_at: string
  emails_sent: number
  is_recovered: boolean
}

interface AbandonedCartStats {
  total_abandoned: number
  recovered: number
  recovery_rate_pct: number
  revenue_recovered: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AbandonedCartsPage() {
  const qc = useQueryClient()
  const [configDirty, setConfigDirty] = useState(false)

  const { data: stats } = useQuery<AbandonedCartStats>({
    queryKey: ['abandoned-carts-stats'],
    queryFn: async () => ({ total_abandoned: 0, recovered: 0, recovery_rate_pct: 0, revenue_recovered: 0 }),
  })

  const { data: config, isLoading: configLoading } = useQuery<AbandonedCartConfig>({
    queryKey: ['abandoned-carts-config'],
    queryFn: async () => ({ abandonment_hours: 1, enable_recovery_discount: false, discount_amount: 0 }),
  })

  const [configForm, setConfigForm] = useState<AbandonedCartConfig | null>(null)
  const activeConfig = configForm ?? config

  const { data: carts = [], isLoading: cartsLoading } = useQuery<AbandonedCart[]>({
    queryKey: ['abandoned-carts'],
    queryFn: async () => [],
  })

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: AbandonedCartConfig) => {
      // PUT /api/v1/ecommerce/abandoned-carts/config
      return payload
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abandoned-carts-config'] })
      toast('success', 'Configuration saved')
      setConfigDirty(false)
    },
    onError: () => toast('error', 'Failed to save configuration'),
  })

  const sendEmailMutation = useMutation({
    mutationFn: async (cartId: string) => {
      // POST /api/v1/ecommerce/abandoned-carts/{id}/send-recovery-email
      return cartId
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['abandoned-carts'] }); toast('success', 'Recovery email sent') },
    onError: () => toast('error', 'Failed to send email'),
  })

  const updateConfig = (partial: Partial<AbandonedCartConfig>) => {
    setConfigForm({ ...(activeConfig!), ...partial })
    setConfigDirty(true)
  }

  const statCards = [
    { label: 'Total Abandoned', value: String(stats?.total_abandoned ?? 0), color: 'text-orange-600 bg-orange-50' },
    { label: 'Recovered', value: String(stats?.recovered ?? 0), color: 'text-green-600 bg-green-50' },
    { label: 'Recovery Rate', value: `${(stats?.recovery_rate_pct ?? 0).toFixed(1)}%`, color: 'text-blue-600 bg-blue-50' },
    { label: 'Revenue Recovered', value: formatCurrency(stats?.revenue_recovered ?? 0), color: 'text-purple-600 bg-purple-50' },
  ]

  const columns = [
    { key: 'customer_email', label: 'Customer', render: (r: AbandonedCart) => <span className="font-medium text-gray-900">{r.customer_email}</span> },
    { key: 'items_count', label: 'Items', render: (r: AbandonedCart) => <span className="text-gray-600">{r.items_count}</span> },
    { key: 'cart_value', label: 'Cart Value', render: (r: AbandonedCart) => <span className="font-medium text-gray-900">{formatCurrency(r.cart_value)}</span> },
    { key: 'abandoned_at', label: 'Abandoned At', render: (r: AbandonedCart) => <span className="text-gray-400 text-xs">{formatDate(r.abandoned_at)}</span> },
    { key: 'emails_sent', label: 'Emails Sent', render: (r: AbandonedCart) => <span className="text-gray-600">{r.emails_sent}</span> },
    {
      key: 'is_recovered', label: 'Status',
      render: (r: AbandonedCart) => (
        <Badge variant={r.is_recovered ? 'success' : 'warning'}>{r.is_recovered ? 'Recovered' : 'Abandoned'}</Badge>
      ),
    },
    {
      key: 'actions', label: '',
      render: (r: AbandonedCart) => (
        <Button
          size="sm"
          variant="outline"
          disabled={r.is_recovered}
          loading={sendEmailMutation.isPending}
          onClick={() => sendEmailMutation.mutate(r.id)}
        >
          Send Email
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abandoned Carts</h1>
        <p className="text-sm text-gray-500 mt-1">Recover lost sales with automated email campaigns</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-[10px] mb-3 ${s.color}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 7h13M10 20a1 1 0 100 2 1 1 0 000-2zm7 0a1 1 0 100 2 1 1 0 000-2z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Config Panel */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recovery Settings</h2>
        {configLoading ? (
          <p className="text-sm text-gray-400">Loading config...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Abandonment Window (hours)</label>
                <input
                  type="number" min="1" max="72"
                  value={activeConfig?.abandonment_hours ?? 1}
                  onChange={(e) => updateConfig({ abandonment_hours: parseInt(e.target.value) || 1 })}
                  className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recovery Discount (KES)</label>
                <input
                  type="number" min="0" step="0.01"
                  disabled={!activeConfig?.enable_recovery_discount}
                  value={activeConfig?.discount_amount ?? 0}
                  onChange={(e) => updateConfig({ discount_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enable-discount"
                  checked={activeConfig?.enable_recovery_discount ?? false}
                  onChange={(e) => updateConfig({ enable_recovery_discount: e.target.checked })}
                  className="rounded w-4 h-4 accent-primary"
                />
                <label htmlFor="enable-discount" className="text-sm font-medium text-gray-700">Include Discount in Email</label>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={!configDirty}
                loading={saveConfigMutation.isPending}
                onClick={() => activeConfig && saveConfigMutation.mutate(activeConfig)}
              >
                Save Settings
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Carts Table */}
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Abandoned Carts</h2>
        </div>
        <Table<AbandonedCart>
          columns={columns}
          data={carts}
          loading={cartsLoading}
          emptyText="No abandoned carts found"
          keyExtractor={(r) => r.id}
        />
      </Card>
    </div>
  )
}
