import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevenueDataPoint {
  month: string
  revenue: number
}

export interface RevenueStatsResponse {
  service_available: boolean
  data: RevenueDataPoint[]
  mock?: boolean
}

export interface UserDataPoint {
  month: string
  new_users: number
}

export interface UserStatsResponse {
  service_available: boolean
  data: UserDataPoint[]
  mock?: boolean
}

export interface ModuleCount {
  module: string
  count: number
}

export interface ModuleStatsResponse {
  service_available: boolean
  modules: ModuleCount[]
}

export interface SupersetTokenResponse {
  service_available: boolean
  token: string | null
  superset_url?: string
  dashboard_id?: string
}

export interface DashboardStats {
  revenue_mtd: number
  revenue_prev: number
  open_invoices: number
  active_employees: number
  active_projects: number
  deals_pipeline: number
}

// ─── Revenue Stats ────────────────────────────────────────────────────────────

export function useRevenueStats(months?: number) {
  return useQuery({
    queryKey: ['analytics', 'revenue', months],
    queryFn: async () => {
      const params = months ? { months } : {}
      const { data } = await apiClient.get<RevenueStatsResponse>('/analytics/stats/revenue', { params })
      return data
    },
  })
}

// ─── User Stats ───────────────────────────────────────────────────────────────

export function useUserStats(months?: number) {
  return useQuery({
    queryKey: ['analytics', 'users', months],
    queryFn: async () => {
      const params = months ? { months } : {}
      const { data } = await apiClient.get<UserStatsResponse>('/analytics/stats/users', { params })
      return data
    },
  })
}

// ─── Module Usage Stats ───────────────────────────────────────────────────────

export function useModuleStats() {
  return useQuery({
    queryKey: ['analytics', 'modules'],
    queryFn: async () => {
      const { data } = await apiClient.get<ModuleStatsResponse>('/analytics/stats/modules')
      return data
    },
  })
}

/** Alias — used by AnalyticsPage */
export const useModuleUsageStats = useModuleStats

// ─── Superset Guest Token ─────────────────────────────────────────────────────

export function useSupersetGuestToken(dashboardId?: string) {
  return useQuery({
    queryKey: ['analytics', 'superset-guest-token', dashboardId],
    queryFn: async () => {
      const params = dashboardId ? { dashboard_id: dashboardId } : {}
      const { data } = await apiClient.get<SupersetTokenResponse>('/analytics/superset-guest-token', { params })
      return data
    },
    enabled: false, // only fetch on demand via refetch()
  })
}

// ─── Dashboard KPI Stats ─────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery({
    queryKey: ['analytics', 'dashboard-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>('/dashboard/stats')
      return data
    },
    retry: 1,
  })
}
