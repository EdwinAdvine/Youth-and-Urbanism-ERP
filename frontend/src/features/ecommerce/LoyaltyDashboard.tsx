import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Badge, Table, Modal, Input, toast } from '../../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoyaltyConfig {
  points_per_unit_spent: number
  currency_per_point: number
  referral_bonus_points: number
  is_active: boolean
}

interface LoyaltyTier {
  id: string
  name: string
  min_lifetime_points: number
  discount_pct: number
  free_shipping: boolean
  badge_color: string
}

interface LeaderboardEntry {
  id: string
  customer_name: string
  customer_email: string
  points_balance: number
  tier_name: string
}

interface LoyaltyStats {
  total_active_accounts: number
  total_points_issued: number
  total_points_redeemed: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoyaltyDashboard() {
  const qc = useQueryClient()
  const [showTierModal, setShowTierModal] = useState(false)
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null)
  const [tierForm, setTierForm] = useState({ name: '', min_lifetime_points: 0, discount_pct: 0, free_shipping: false, badge_color: '#51459d' })

  const { data: config, isLoading: configLoading } = useQuery<LoyaltyConfig>({
    queryKey: ['loyalty-config'],
    queryFn: async () => ({ points_per_unit_spent: 1, currency_per_point: 0.01, referral_bonus_points: 100, is_active: false }),
  })

  const [configForm, setConfigForm] = useState<LoyaltyConfig | null>(null)
  const activeConfig = configForm ?? config

  const { data: tiers = [] } = useQuery<LoyaltyTier[]>({
    queryKey: ['loyalty-tiers'],
    queryFn: async () => [],
  })

  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: ['loyalty-leaderboard'],
    queryFn: async () => [],
  })

  const { data: stats } = useQuery<LoyaltyStats>({
    queryKey: ['loyalty-stats'],
    queryFn: async () => ({ total_active_accounts: 0, total_points_issued: 0, total_points_redeemed: 0 }),
  })

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: LoyaltyConfig) => {
      // PUT /api/v1/ecommerce/loyalty/config
      return payload
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty-config'] }); toast('success', 'Config saved') },
    onError: () => toast('error', 'Failed to save config'),
  })

  const saveTierMutation = useMutation({
    mutationFn: async (payload: typeof tierForm & { id?: string }) => {
      // POST/PATCH /api/v1/ecommerce/loyalty/tiers
      return payload
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-tiers'] })
      toast('success', editingTier ? 'Tier updated' : 'Tier created')
      setShowTierModal(false)
      setEditingTier(null)
    },
    onError: () => toast('error', 'Failed to save tier'),
  })

  const deleteTierMutation = useMutation({
    mutationFn: async (id: string) => {
      // DELETE /api/v1/ecommerce/loyalty/tiers/{id}
      return id
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty-tiers'] }); toast('success', 'Tier deleted') },
    onError: () => toast('error', 'Failed to delete tier'),
  })

  const handleEditTier = (tier: LoyaltyTier) => {
    setEditingTier(tier)
    setTierForm({ name: tier.name, min_lifetime_points: tier.min_lifetime_points, discount_pct: tier.discount_pct, free_shipping: tier.free_shipping, badge_color: tier.badge_color })
    setShowTierModal(true)
  }

  const leaderboardColumns = [
    { key: 'rank', label: '#', render: (_: LeaderboardEntry, idx?: number) => <span className="font-bold text-gray-500">{(idx ?? 0) + 1}</span> },
    { key: 'customer_name', label: 'Customer', render: (r: LeaderboardEntry) => <span className="font-medium text-gray-900">{r.customer_name}</span> },
    { key: 'customer_email', label: 'Email', render: (r: LeaderboardEntry) => <span className="text-gray-500 text-sm">{r.customer_email}</span> },
    { key: 'tier_name', label: 'Tier', render: (r: LeaderboardEntry) => <Badge variant="primary">{r.tier_name}</Badge> },
    { key: 'points_balance', label: 'Points', render: (r: LeaderboardEntry) => <span className="font-bold text-gray-900">{r.points_balance.toLocaleString()}</span> },
  ]

  const statCards = [
    { label: 'Active Accounts', value: String(stats?.total_active_accounts ?? 0), color: 'text-blue-600 bg-blue-50' },
    { label: 'Points Issued', value: (stats?.total_points_issued ?? 0).toLocaleString(), color: 'text-green-600 bg-green-50' },
    { label: 'Points Redeemed', value: (stats?.total_points_redeemed ?? 0).toLocaleString(), color: 'text-orange-600 bg-orange-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loyalty Program</h1>
        <p className="text-sm text-gray-500 mt-1">Configure rewards, tiers, and track top customers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Program Config */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Program Configuration</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Active</span>
            <input
              type="checkbox"
              checked={activeConfig?.is_active ?? false}
              onChange={(e) => setConfigForm({ ...(activeConfig!), is_active: e.target.checked })}
              className="rounded w-4 h-4 accent-primary"
            />
          </div>
        </div>
        {configLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points per KES Spent</label>
              <input
                type="number" min="0" step="0.01"
                value={activeConfig?.points_per_unit_spent ?? 1}
                onChange={(e) => setConfigForm({ ...(activeConfig!), points_per_unit_spent: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">KES per Point (redemption)</label>
              <input
                type="number" min="0" step="0.001"
                value={activeConfig?.currency_per_point ?? 0.01}
                onChange={(e) => setConfigForm({ ...(activeConfig!), currency_per_point: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referral Bonus Points</label>
              <input
                type="number" min="0"
                value={activeConfig?.referral_bonus_points ?? 100}
                onChange={(e) => setConfigForm({ ...(activeConfig!), referral_bonus_points: parseInt(e.target.value) || 0 })}
                className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button
            loading={saveConfigMutation.isPending}
            disabled={!configForm}
            onClick={() => activeConfig && saveConfigMutation.mutate(activeConfig)}
          >
            Save Config
          </Button>
        </div>
      </Card>

      {/* Tiers */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Loyalty Tiers</h2>
          <Button size="sm" onClick={() => { setEditingTier(null); setTierForm({ name: '', min_lifetime_points: 0, discount_pct: 0, free_shipping: false, badge_color: '#51459d' }); setShowTierModal(true) }}>
            Add Tier
          </Button>
        </div>
        {tiers.length === 0 ? (
          <p className="text-sm text-gray-400">No tiers configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Tier', 'Min Points', 'Discount', 'Free Shipping', 'Color', ''].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => (
                  <tr key={tier.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium text-gray-900">{tier.name}</td>
                    <td className="py-3 px-3 text-gray-600">{tier.min_lifetime_points.toLocaleString()}</td>
                    <td className="py-3 px-3"><Badge variant="success">{tier.discount_pct}%</Badge></td>
                    <td className="py-3 px-3"><Badge variant={tier.free_shipping ? 'info' : 'default'}>{tier.free_shipping ? 'Yes' : 'No'}</Badge></td>
                    <td className="py-3 px-3">
                      <span className="inline-block w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: tier.badge_color }} />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEditTier(tier)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => { if (confirm('Delete tier?')) deleteTierMutation.mutate(tier.id) }}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Leaderboard */}
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Top 10 Customers by Points</h2>
        </div>
        <Table<LeaderboardEntry>
          columns={leaderboardColumns}
          data={leaderboard.slice(0, 10)}
          loading={false}
          emptyText="No loyalty accounts yet"
          keyExtractor={(r) => r.id}
        />
      </Card>

      {/* Tier Modal */}
      <Modal open={showTierModal} onClose={() => setShowTierModal(false)} title={editingTier ? 'Edit Tier' : 'Add Tier'}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveTierMutation.mutate(editingTier ? { ...tierForm, id: editingTier.id } : tierForm)
          }}
        >
          <Input label="Tier Name" value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} required placeholder="e.g. Gold" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Lifetime Points" type="number" min="0" value={tierForm.min_lifetime_points} onChange={(e) => setTierForm({ ...tierForm, min_lifetime_points: parseInt(e.target.value) || 0 })} required />
            <Input label="Discount %" type="number" min="0" max="100" step="0.1" value={tierForm.discount_pct} onChange={(e) => setTierForm({ ...tierForm, discount_pct: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="free-shipping" checked={tierForm.free_shipping} onChange={(e) => setTierForm({ ...tierForm, free_shipping: e.target.checked })} className="rounded w-4 h-4 accent-primary" />
              <label htmlFor="free-shipping" className="text-sm font-medium text-gray-700">Free Shipping</label>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Badge Color</label>
              <input type="color" value={tierForm.badge_color} onChange={(e) => setTierForm({ ...tierForm, badge_color: e.target.value })} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
            </div>
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
