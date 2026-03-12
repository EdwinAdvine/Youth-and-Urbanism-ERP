import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Badge, Modal, Input, toast } from '../../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subscription {
  id: string
  product_id: string
  product_name: string
  frequency_days: number
  quantity: number
  next_billing_date: string
  discount_pct: number
  status: 'active' | 'paused' | 'cancelled'
}

interface SubscriptionOrder {
  id: string
  subscription_id: string
  product_name: string
  created_at: string
  total: number
  status: string
}

interface NewSubscriptionForm {
  product_name: string
  product_id: string
  frequency_days: number
  quantity: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<Subscription['status'], 'success' | 'warning' | 'danger'> = {
  active: 'success', paused: 'warning', cancelled: 'danger',
}

const FREQUENCY_OPTIONS = [
  { value: '7', label: 'Weekly (7 days)' },
  { value: '14', label: 'Bi-weekly (14 days)' },
  { value: '30', label: 'Monthly (30 days)' },
  { value: '60', label: 'Every 2 months' },
  { value: '90', label: 'Quarterly (90 days)' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionManagement() {
  const qc = useQueryClient()
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)
  const [subForm, setSubForm] = useState<NewSubscriptionForm>({ product_name: '', product_id: '', frequency_days: 30, quantity: 1 })

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<Subscription[]>({
    queryKey: ['my-subscriptions'],
    queryFn: async () => [],
  })

  const { data: orders = [], isLoading: ordersLoading } = useQuery<SubscriptionOrder[]>({
    queryKey: ['my-subscription-orders'],
    queryFn: async () => [],
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'pause' | 'resume' | 'skip' | 'cancel' }) => {
      // POST /api/v1/ecommerce/subscriptions/{id}/{action}
      return { id, action }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['my-subscriptions'] })
      const labels = { pause: 'paused', resume: 'resumed', skip: 'next cycle skipped', cancel: 'cancelled' }
      toast('success', `Subscription ${labels[vars.action]}`)
    },
    onError: () => toast('error', 'Action failed'),
  })

  const createMutation = useMutation({
    mutationFn: async (payload: NewSubscriptionForm) => {
      // POST /api/v1/ecommerce/subscriptions
      return payload
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-subscriptions'] })
      toast('success', 'Subscription created')
      setShowSubscribeModal(false)
      setSubForm({ product_name: '', product_id: '', frequency_days: 30, quantity: 1 })
    },
    onError: () => toast('error', 'Failed to create subscription'),
  })

  const handleAction = (id: string, action: 'pause' | 'resume' | 'skip' | 'cancel') => {
    if (action === 'cancel' && !confirm('Cancel this subscription?')) return
    actionMutation.mutate({ id, action })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your recurring product orders</p>
        </div>
        <Button onClick={() => setShowSubscribeModal(true)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Subscribe
        </Button>
      </div>

      {/* Active Subscriptions */}
      {subsLoading ? (
        <Card><p className="text-sm text-gray-400 text-center py-8">Loading subscriptions...</p></Card>
      ) : subscriptions.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 mb-3">No active subscriptions</p>
            <Button size="sm" onClick={() => setShowSubscribeModal(true)}>Add Your First Subscription</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <Card key={sub.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{sub.product_name}</h3>
                    <Badge variant={STATUS_BADGE[sub.status]}>{sub.status}</Badge>
                    {sub.discount_pct > 0 && <Badge variant="success">{sub.discount_pct}% off</Badge>}
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Every {sub.frequency_days} days</span>
                    <span>Qty: {sub.quantity}</span>
                    {sub.status !== 'cancelled' && (
                      <span>Next billing: <span className="font-medium text-gray-700">{formatDate(sub.next_billing_date)}</span></span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  {sub.status === 'active' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleAction(sub.id, 'pause')} loading={actionMutation.isPending}>Pause</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleAction(sub.id, 'skip')} loading={actionMutation.isPending}>Skip Next</Button>
                    </>
                  )}
                  {sub.status === 'paused' && (
                    <Button size="sm" className="bg-[#6fd943] hover:bg-[#5ec835] text-white" onClick={() => handleAction(sub.id, 'resume')} loading={actionMutation.isPending}>Resume</Button>
                  )}
                  {sub.status !== 'cancelled' && (
                    <Button size="sm" variant="danger" onClick={() => handleAction(sub.id, 'cancel')} loading={actionMutation.isPending}>Cancel</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Order History */}
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Subscription Order History</h2>
        </div>
        {ordersLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No subscription orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Product', 'Date', 'Status', 'Total'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900">{order.product_name}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(order.created_at)}</td>
                    <td className="py-3 px-4"><Badge variant="info">{order.status}</Badge></td>
                    <td className="py-3 px-4 font-medium text-gray-900">{formatCurrency(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Subscribe Modal */}
      <Modal open={showSubscribeModal} onClose={() => setShowSubscribeModal(false)} title="New Subscription">
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(subForm) }}
        >
          <Input
            label="Product Name"
            value={subForm.product_name}
            onChange={(e) => setSubForm({ ...subForm, product_name: e.target.value })}
            required
            placeholder="Search for a product..."
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={String(subForm.frequency_days)}
              onChange={(e) => setSubForm({ ...subForm, frequency_days: parseInt(e.target.value) })}
            >
              {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Input
            label="Quantity"
            type="number"
            min="1"
            value={subForm.quantity}
            onChange={(e) => setSubForm({ ...subForm, quantity: parseInt(e.target.value) || 1 })}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowSubscribeModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Subscribe</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
