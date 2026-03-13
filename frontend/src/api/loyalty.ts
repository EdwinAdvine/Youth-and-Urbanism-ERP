/**
 * Loyalty API client — loyalty programs, tiers, members, rewards, and point transactions.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/loyalty`.
 *
 * Key exports:
 *   - useLoyaltyPrograms()      — list all loyalty programs with tiers and rewards
 *   - useCreateProgram()        — create a new points-based loyalty program
 *   - useLoyaltyMembers()       — list enrolled members with current point balances
 *   - useEnrollMember()         — enroll a CRM customer into a loyalty program
 *   - useAwardPoints()          — manually award points to a member
 *   - useRedeemReward()         — redeem a reward using a member's accumulated points
 *   - useLoyaltyTransactions()  — paginated point transaction history for a member
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoyaltyProgram {
  id: string
  name: string
  description: string | null
  points_per_unit_currency: string
  is_active: boolean
  created_at: string
  tiers: LoyaltyTier[]
  rewards: LoyaltyReward[]
}

export interface LoyaltyTier {
  id: string
  program_id: string
  name: string
  min_points: number
  discount_percentage: string
  points_multiplier: string
  sort_order: number
}

export interface LoyaltyMember {
  id: string
  program_id: string
  customer_id: string
  customer_name?: string
  points_balance: number
  lifetime_points: number
  tier_id: string | null
  tier_name?: string
  referral_code: string
  created_at: string
}

export interface LoyaltyTransaction {
  id: string
  member_id: string
  pos_transaction_id: string | null
  points_change: number
  reason: string
  balance_after: number
  created_at: string
}

export interface LoyaltyReward {
  id: string
  program_id: string
  name: string
  description: string | null
  points_cost: number
  reward_type: string
  reward_value: Record<string, unknown> | null
  is_active: boolean
}

// ─── Programs ────────────────────────────────────────────────────────────────

export function useLoyaltyPrograms() {
  return useQuery({
    queryKey: ['loyalty', 'programs'],
    queryFn: async () => {
      const { data } = await apiClient.get<LoyaltyProgram[]>('/loyalty/programs')
      return data
    },
  })
}

export function useLoyaltyProgram(id: string) {
  return useQuery({
    queryKey: ['loyalty', 'programs', id],
    queryFn: async () => {
      const { data } = await apiClient.get<LoyaltyProgram>(`/loyalty/programs/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateLoyaltyProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; points_per_unit_currency: number }) => {
      const { data } = await apiClient.post<LoyaltyProgram>('/loyalty/programs', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty', 'programs'] }),
  })
}

// ─── Members ─────────────────────────────────────────────────────────────────

export function useLoyaltyMembers(programId?: string) {
  return useQuery({
    queryKey: ['loyalty', 'members', { programId }],
    queryFn: async () => {
      const params = programId ? { program_id: programId } : {}
      const { data } = await apiClient.get<LoyaltyMember[]>('/loyalty/members', { params })
      return data
    },
  })
}

export function useLoyaltyMemberByCustomer(customerId: string) {
  return useQuery({
    queryKey: ['loyalty', 'members', 'customer', customerId],
    queryFn: async () => {
      const { data } = await apiClient.get<LoyaltyMember>(`/loyalty/members/by-customer/${customerId}`)
      return data
    },
    enabled: !!customerId,
    retry: false,
  })
}

export function useEnrollMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { program_id: string; customer_id: string }) => {
      const { data } = await apiClient.post<LoyaltyMember>('/loyalty/members', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty', 'members'] }),
  })
}

export function useEarnPoints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ memberId, ...payload }: { memberId: string; points: number; reason: string; pos_transaction_id?: string }) => {
      const { data } = await apiClient.post(`/loyalty/members/${memberId}/earn`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty', 'members'] }),
  })
}

export function useRedeemPoints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ memberId, ...payload }: { memberId: string; points: number; reason: string; reward_id?: string }) => {
      const { data } = await apiClient.post(`/loyalty/members/${memberId}/redeem`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty', 'members'] }),
  })
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

export function useLoyaltyRewards(programId: string) {
  return useQuery({
    queryKey: ['loyalty', 'rewards', programId],
    queryFn: async () => {
      const { data } = await apiClient.get<LoyaltyReward[]>(`/loyalty/programs/${programId}/rewards`)
      return data
    },
    enabled: !!programId,
  })
}

export function useCreateReward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ programId, ...payload }: {
      programId: string; name: string; points_cost: number; reward_type: string;
      description?: string; reward_value?: Record<string, unknown>
    }) => {
      const { data } = await apiClient.post<LoyaltyReward>(`/loyalty/programs/${programId}/rewards`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] }),
  })
}
