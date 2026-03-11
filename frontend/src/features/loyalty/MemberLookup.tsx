import { useState } from 'react'
import { Button, Card, Badge, Spinner, Input, Modal, toast } from '../../components/ui'
import {
  useLoyaltyMemberByCustomer,
  useEarnPoints,
  useRedeemPoints,
  type LoyaltyMember,
} from '../../api/loyalty'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

// ─── Customer Search Hook ────────────────────────────────────────────────────

interface CustomerResult {
  id: string
  name: string
  email: string | null
}

function useSearchCustomers(q: string) {
  return useQuery({
    queryKey: ['crm', 'customers', 'search', q],
    queryFn: async () => {
      const { data } = await apiClient.get<CustomerResult[]>('/crm/contacts', {
        params: { search: q, limit: 10 },
      })
      return data
    },
    enabled: q.length >= 2,
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MemberLookup() {
  const [search, setSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  const { data: searchResults, isLoading: searching } = useSearchCustomers(search)
  const { data: member, isLoading: memberLoading, error: memberError } = useLoyaltyMemberByCustomer(selectedCustomerId)

  const earnPoints = useEarnPoints()
  const redeemPoints = useRedeemPoints()

  // Quick action modals
  const [earnModalOpen, setEarnModalOpen] = useState(false)
  const [redeemModalOpen, setRedeemModalOpen] = useState(false)
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')

  function selectCustomer(customer: CustomerResult) {
    setSelectedCustomerId(customer.id)
    setSearch(customer.name)
  }

  function resetActionForm() {
    setPoints('')
    setReason('')
  }

  async function handleEarn() {
    if (!member) return
    const p = parseInt(points)
    if (!p || p <= 0) {
      toast('warning', 'Enter a valid number of points')
      return
    }
    if (!reason.trim()) {
      toast('warning', 'Please provide a reason')
      return
    }
    try {
      await earnPoints.mutateAsync({
        memberId: member.id,
        points: p,
        reason: reason.trim(),
      })
      toast('success', `${p} points earned`)
      setEarnModalOpen(false)
      resetActionForm()
    } catch {
      toast('error', 'Failed to earn points')
    }
  }

  async function handleRedeem() {
    if (!member) return
    const p = parseInt(points)
    if (!p || p <= 0) {
      toast('warning', 'Enter a valid number of points')
      return
    }
    if (p > member.points_balance) {
      toast('warning', 'Insufficient points balance')
      return
    }
    if (!reason.trim()) {
      toast('warning', 'Please provide a reason')
      return
    }
    try {
      await redeemPoints.mutateAsync({
        memberId: member.id,
        points: p,
        reason: reason.trim(),
      })
      toast('success', `${p} points redeemed`)
      setRedeemModalOpen(false)
      resetActionForm()
    } catch {
      toast('error', 'Failed to redeem points')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Member Lookup</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Search for a customer to view their loyalty membership details.
        </p>
      </div>

      {/* Search */}
      <Card>
        <div className="relative">
          <Input
            label="Search Customer"
            placeholder="Enter name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (e.target.value.length < 2) setSelectedCustomerId('')
            }}
          />

          {/* Dropdown results */}
          {search.length >= 2 && !selectedCustomerId && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] shadow-lg max-h-60 overflow-y-auto">
              {searching ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                searchResults.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                    onClick={() => selectCustomer(c)}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </button>
                ))
              ) : (
                <p className="text-center py-4 text-sm text-gray-400">No customers found</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Member Details */}
      {selectedCustomerId && (
        <>
          {memberLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {memberError && (
            <Card>
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This customer is not enrolled in any loyalty program.
                </p>
              </div>
            </Card>
          )}

          {member && (
            <MemberDetails
              member={member}
              onEarn={() => { resetActionForm(); setEarnModalOpen(true) }}
              onRedeem={() => { resetActionForm(); setRedeemModalOpen(true) }}
            />
          )}
        </>
      )}

      {/* Earn Points Modal */}
      <Modal open={earnModalOpen} onClose={() => setEarnModalOpen(false)} title="Earn Points" size="sm">
        <div className="space-y-4">
          <Input
            label="Points"
            type="number"
            placeholder="100"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
          <Input
            label="Reason"
            placeholder="e.g. Manual adjustment, bonus"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEarnModalOpen(false)}>Cancel</Button>
            <Button onClick={handleEarn} loading={earnPoints.isPending}>Add Points</Button>
          </div>
        </div>
      </Modal>

      {/* Redeem Points Modal */}
      <Modal open={redeemModalOpen} onClose={() => setRedeemModalOpen(false)} title="Redeem Points" size="sm">
        <div className="space-y-4">
          {member && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Available balance: <strong className="text-[#51459d]">{member.points_balance.toLocaleString()}</strong> points
            </p>
          )}
          <Input
            label="Points to Redeem"
            type="number"
            placeholder="50"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
          <Input
            label="Reason"
            placeholder="e.g. Reward redemption"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setRedeemModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleRedeem} loading={redeemPoints.isPending}>Redeem</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Member Details Sub-Component ────────────────────────────────────────────

function MemberDetails({
  member,
  onEarn,
  onRedeem,
}: {
  member: LoyaltyMember
  onEarn: () => void
  onRedeem: () => void
}) {
  return (
    <Card>
      <div className="space-y-5">
        {/* Name and Tier */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {member.customer_name ?? 'Customer'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Member since {new Date(member.created_at).toLocaleDateString()}
            </p>
          </div>
          <Badge variant="primary" className="text-sm px-3 py-1">
            {member.tier_name ?? 'Base Tier'}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-[#51459d]/5 py-3 px-2">
            <p className="text-2xl font-bold text-[#51459d]">{member.points_balance.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Points Balance</p>
          </div>
          <div className="rounded-lg bg-[#6fd943]/10 py-3 px-2">
            <p className="text-2xl font-bold text-[#6fd943]">{member.lifetime_points.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Lifetime Points</p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 py-3 px-2">
            <p className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">{member.referral_code}</p>
            <p className="text-xs text-gray-500 mt-1">Referral Code</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 pt-2">
          <Button className="flex-1" onClick={onEarn}>
            Earn Points
          </Button>
          <Button className="flex-1" variant="outline" onClick={onRedeem}>
            Redeem Points
          </Button>
        </div>
      </div>
    </Card>
  )
}
