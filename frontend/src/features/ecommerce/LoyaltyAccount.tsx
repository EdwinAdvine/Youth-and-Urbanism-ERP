import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button, Card, Badge, Modal, toast } from '../../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoyaltyTier {
  name: string
  badge_color: string
  discount_pct: number
  free_shipping: boolean
}

interface LoyaltyAccount {
  points_balance: number
  lifetime_points: number
  tier: LoyaltyTier | null
  next_tier: (LoyaltyTier & { min_lifetime_points: number }) | null
  referral_code: string
  referral_uses: number
  referral_points_earned: number
}

interface LoyaltyTransaction {
  id: string
  type: 'earned' | 'spent' | 'referral' | 'bonus'
  points: number
  note: string
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TX_TYPE_BADGE: Record<LoyaltyTransaction['type'], 'success' | 'danger' | 'primary' | 'info'> = {
  earned: 'success', spent: 'danger', referral: 'primary', bonus: 'info',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoyaltyAccount() {
  const [showRedeemModal, setShowRedeemModal] = useState(false)
  const [redeemPoints, setRedeemPoints] = useState('')
  const currencyPerPoint = 0.01 // fetched from config in real impl

  const { data: account, isLoading: accountLoading } = useQuery<LoyaltyAccount>({
    queryKey: ['my-loyalty-account'],
    queryFn: async () => ({
      points_balance: 0,
      lifetime_points: 0,
      tier: null,
      next_tier: null,
      referral_code: '',
      referral_uses: 0,
      referral_points_earned: 0,
    }),
  })

  const { data: transactions = [], isLoading: txLoading } = useQuery<LoyaltyTransaction[]>({
    queryKey: ['my-loyalty-transactions'],
    queryFn: async () => [],
  })

  const redeemMutation = useMutation({
    mutationFn: async (points: number) => {
      // POST /api/v1/ecommerce/loyalty/redeem
      return { discount_value: points * currencyPerPoint }
    },
    onSuccess: (res) => {
      toast('success', `Redeemed! Discount of KES ${res.discount_value.toFixed(2)} applied to your account.`)
      setShowRedeemModal(false)
      setRedeemPoints('')
    },
    onError: () => toast('error', 'Failed to redeem points'),
  })

  const handleCopyCode = () => {
    if (account?.referral_code) {
      navigator.clipboard.writeText(account.referral_code)
      toast('info', 'Referral code copied to clipboard')
    }
  }

  const pointsToRedeem = parseInt(redeemPoints) || 0
  const discountValue = pointsToRedeem * currencyPerPoint

  const progressPct = account?.next_tier
    ? Math.min(100, Math.round((account.lifetime_points / account.next_tier.min_lifetime_points) * 100))
    : 100

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Loyalty Account</h1>
        <p className="text-sm text-gray-500 mt-1">Earn and redeem points on every purchase</p>
      </div>

      {accountLoading ? (
        <Card><p className="text-sm text-gray-400 text-center py-8">Loading account...</p></Card>
      ) : (
        <>
          {/* Points Balance Card */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Points Balance</p>
                <p className="text-4xl font-bold text-gray-900 mt-2">{(account?.points_balance ?? 0).toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">Lifetime: {(account?.lifetime_points ?? 0).toLocaleString()} pts</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {account?.tier ? (
                  <Badge style={{ backgroundColor: account.tier.badge_color + '20', color: account.tier.badge_color }} className="text-sm px-3 py-1">
                    {account.tier.name}
                  </Badge>
                ) : (
                  <Badge variant="default">No Tier</Badge>
                )}
                {account?.tier?.free_shipping && <Badge variant="info">Free Shipping</Badge>}
                {account?.tier && account.tier.discount_pct > 0 && <Badge variant="success">{account.tier.discount_pct}% off</Badge>}
              </div>
            </div>

            {/* Progress to next tier */}
            {account?.next_tier && (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>Progress to {account.next_tier.name}</span>
                  <span>{account.lifetime_points.toLocaleString()} / {account.next_tier.min_lifetime_points.toLocaleString()} pts</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, backgroundColor: '#51459d' }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{progressPct}% complete</p>
              </div>
            )}

            <div className="mt-4">
              <Button onClick={() => setShowRedeemModal(true)} disabled={!account?.points_balance}>
                Redeem Points
              </Button>
            </div>
          </Card>

          {/* Referral Code */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Referral Program</h2>
            <div className="flex items-center gap-3 mb-4">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-[10px] px-4 py-2 text-sm font-mono text-gray-900 tracking-widest">
                {account?.referral_code || 'Loading...'}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>Copy</Button>
            </div>
            <div className="flex gap-6 text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-900">{account?.referral_uses ?? 0}</span>
                <span className="ml-1 text-gray-500">referrals</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">{(account?.referral_points_earned ?? 0).toLocaleString()}</span>
                <span className="ml-1 text-gray-500">bonus points earned</span>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Transaction History */}
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Transaction History</h2>
        </div>
        {txLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No transactions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Type', 'Points', 'Note', 'Date'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4"><Badge variant={TX_TYPE_BADGE[tx.type]}>{tx.type}</Badge></td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${tx.type === 'spent' ? 'text-danger' : 'text-green-600'}`}>
                        {tx.type === 'spent' ? '-' : '+'}{tx.points.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{tx.note}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{formatDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Redeem Modal */}
      <Modal open={showRedeemModal} onClose={() => setShowRedeemModal(false)} title="Redeem Points">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You have <span className="font-bold text-gray-900">{(account?.points_balance ?? 0).toLocaleString()}</span> points available.
            Each point is worth <span className="font-medium">KES {currencyPerPoint}</span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points to Redeem</label>
            <input
              type="number"
              min="1"
              max={account?.points_balance}
              value={redeemPoints}
              onChange={(e) => setRedeemPoints(e.target.value)}
              className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Enter number of points..."
            />
          </div>
          {pointsToRedeem > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-[10px] px-4 py-3 text-sm text-green-700">
              Discount value: <span className="font-bold">KES {discountValue.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowRedeemModal(false)}>Cancel</Button>
            <Button
              disabled={pointsToRedeem < 1 || pointsToRedeem > (account?.points_balance ?? 0)}
              loading={redeemMutation.isPending}
              onClick={() => redeemMutation.mutate(pointsToRedeem)}
            >
              Redeem
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
