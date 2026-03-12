import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Badge, Table, Modal, Input, toast } from '../../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface B2BCompany {
  id: string
  name: string
  contact_email: string
  payment_terms: string
  credit_limit: number
  is_approved: boolean
  created_at: string
}

interface B2BQuote {
  id: string
  company_name: string
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'converted'
  items_count: number
  po_number: string | null
  created_at: string
  total_value: number
}

interface PricingTier {
  id: string
  name: string
  discount_pct: number
  min_order_qty: number
}

interface B2BStats {
  total_companies: number
  pending_approval: number
  active_quotes: number
  total_quote_value: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const QUOTE_STATUS_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  draft: 'default', submitted: 'info', reviewed: 'warning',
  approved: 'success', rejected: 'danger', converted: 'primary',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function B2BDashboard() {
  const [activeTab, setActiveTab] = useState<'companies' | 'quotes'>('companies')
  const [showTierModal, setShowTierModal] = useState(false)
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null)
  const [tierForm, setTierForm] = useState({ name: '', discount_pct: 0, min_order_qty: 1 })
  const qc = useQueryClient()

  const { data: stats } = useQuery<B2BStats>({
    queryKey: ['b2b-stats'],
    queryFn: async () => ({ total_companies: 0, pending_approval: 0, active_quotes: 0, total_quote_value: 0 }),
  })

  const { data: companies = [], isLoading: companiesLoading } = useQuery<B2BCompany[]>({
    queryKey: ['b2b-companies'],
    queryFn: async () => [],
  })

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<B2BQuote[]>({
    queryKey: ['b2b-quotes'],
    queryFn: async () => [],
  })

  const { data: tiers = [] } = useQuery<PricingTier[]>({
    queryKey: ['b2b-pricing-tiers'],
    queryFn: async () => [],
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      // PATCH /api/v1/ecommerce/b2b/companies/{id}/approve
      return { id }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['b2b-companies'] }); toast('success', 'Company approved') },
    onError: () => toast('error', 'Failed to approve company'),
  })

  const saveTierMutation = useMutation({
    mutationFn: async (payload: typeof tierForm & { id?: string }) => {
      // POST/PATCH /api/v1/ecommerce/b2b/pricing-tiers
      return payload
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['b2b-pricing-tiers'] })
      toast('success', editingTier ? 'Tier updated' : 'Tier created')
      setShowTierModal(false)
      setEditingTier(null)
      setTierForm({ name: '', discount_pct: 0, min_order_qty: 1 })
    },
    onError: () => toast('error', 'Failed to save tier'),
  })

  const deleteTierMutation = useMutation({
    mutationFn: async (id: string) => {
      // DELETE /api/v1/ecommerce/b2b/pricing-tiers/{id}
      return id
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['b2b-pricing-tiers'] }); toast('success', 'Tier deleted') },
    onError: () => toast('error', 'Failed to delete tier'),
  })

  const handleEditTier = (tier: PricingTier) => {
    setEditingTier(tier)
    setTierForm({ name: tier.name, discount_pct: tier.discount_pct, min_order_qty: tier.min_order_qty })
    setShowTierModal(true)
  }

  const handleDeleteTier = (id: string) => {
    if (!confirm('Delete this pricing tier?')) return
    deleteTierMutation.mutate(id)
  }

  const statCards = [
    { label: 'Total Companies', value: String(stats?.total_companies ?? 0), color: 'text-blue-600 bg-blue-50' },
    { label: 'Pending Approval', value: String(stats?.pending_approval ?? 0), color: 'text-orange-600 bg-orange-50' },
    { label: 'Active Quotes', value: String(stats?.active_quotes ?? 0), color: 'text-purple-600 bg-purple-50' },
    { label: 'Total Quote Value', value: formatCurrency(stats?.total_quote_value ?? 0), color: 'text-green-600 bg-green-50' },
  ]

  const companyColumns = [
    { key: 'name', label: 'Company', render: (r: B2BCompany) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'contact_email', label: 'Email', render: (r: B2BCompany) => <span className="text-gray-600 text-sm">{r.contact_email}</span> },
    { key: 'payment_terms', label: 'Payment Terms', render: (r: B2BCompany) => <span className="text-gray-600 text-sm">{r.payment_terms || '-'}</span> },
    { key: 'credit_limit', label: 'Credit Limit', render: (r: B2BCompany) => <span className="text-gray-700 text-sm">{formatCurrency(r.credit_limit)}</span> },
    {
      key: 'is_approved', label: 'Status',
      render: (r: B2BCompany) => <Badge variant={r.is_approved ? 'success' : 'warning'}>{r.is_approved ? 'Approved' : 'Pending'}</Badge>,
    },
    {
      key: 'actions', label: '',
      render: (r: B2BCompany) => !r.is_approved ? (
        <Button size="sm" onClick={() => approveMutation.mutate(r.id)} loading={approveMutation.isPending}>Approve</Button>
      ) : null,
    },
  ]

  const quoteColumns = [
    { key: 'company_name', label: 'Company', render: (r: B2BQuote) => <span className="font-medium text-gray-900">{r.company_name}</span> },
    { key: 'status', label: 'Status', render: (r: B2BQuote) => <Badge variant={QUOTE_STATUS_BADGE[r.status]}>{r.status}</Badge> },
    { key: 'items_count', label: 'Items', render: (r: B2BQuote) => <span className="text-gray-600">{r.items_count}</span> },
    { key: 'po_number', label: 'PO Number', render: (r: B2BQuote) => <span className="text-gray-500 text-sm">{r.po_number ?? '-'}</span> },
    { key: 'created_at', label: 'Date', render: (r: B2BQuote) => <span className="text-gray-400 text-xs">{formatDate(r.created_at)}</span> },
    {
      key: 'view', label: '',
      render: (r: B2BQuote) => (
        <Button size="sm" variant="ghost" onClick={() => window.location.assign(`/ecommerce/b2b/quotes/${r.id}`)}>View</Button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">B2B Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage B2B companies, quotes, and pricing tiers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-[10px] mb-3 ${s.color}`}>
              <span className="text-lg font-bold">#</span>
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['companies', 'quotes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize border-b-2 -mb-px ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'companies' && (
        <Card padding={false}>
          <Table<B2BCompany>
            columns={companyColumns}
            data={companies}
            loading={companiesLoading}
            emptyText="No companies registered yet"
            keyExtractor={(r) => r.id}
          />
        </Card>
      )}

      {activeTab === 'quotes' && (
        <Card padding={false}>
          <Table<B2BQuote>
            columns={quoteColumns}
            data={quotes}
            loading={quotesLoading}
            emptyText="No quotes found"
            keyExtractor={(r) => r.id}
          />
        </Card>
      )}

      {/* Pricing Tiers */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Pricing Tiers</h2>
          <Button size="sm" onClick={() => { setEditingTier(null); setTierForm({ name: '', discount_pct: 0, min_order_qty: 1 }); setShowTierModal(true) }}>
            Add Tier
          </Button>
        </div>
        {tiers.length === 0 ? (
          <p className="text-sm text-gray-400">No pricing tiers configured.</p>
        ) : (
          <div className="space-y-2">
            {tiers.map((tier) => (
              <div key={tier.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-4">
                  <span className="font-medium text-gray-900">{tier.name}</span>
                  <Badge variant="primary">{tier.discount_pct}% off</Badge>
                  <span className="text-xs text-gray-500">Min qty: {tier.min_order_qty}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleEditTier(tier)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDeleteTier(tier.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tier Modal */}
      <Modal open={showTierModal} onClose={() => setShowTierModal(false)} title={editingTier ? 'Edit Pricing Tier' : 'Add Pricing Tier'}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveTierMutation.mutate(editingTier ? { ...tierForm, id: editingTier.id } : tierForm)
          }}
        >
          <Input label="Tier Name" value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} required placeholder="e.g. Gold" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Discount %" type="number" min="0" max="100" step="0.1" value={tierForm.discount_pct} onChange={(e) => setTierForm({ ...tierForm, discount_pct: parseFloat(e.target.value) || 0 })} required />
            <Input label="Min Order Qty" type="number" min="1" value={tierForm.min_order_qty} onChange={(e) => setTierForm({ ...tierForm, min_order_qty: parseInt(e.target.value) || 1 })} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowTierModal(false)}>Cancel</Button>
            <Button type="submit" loading={saveTierMutation.isPending}>{editingTier ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
