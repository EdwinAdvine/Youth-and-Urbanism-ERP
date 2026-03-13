/**
 * Analytics API client — built-in ERP analytics (revenue, users, modules, expenses).
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/analytics`.
 *
 * Key exports:
 *   - useRevenueStats()    — monthly revenue trend data points
 *   - useUserStats()       — monthly new-user registration counts
 *   - useModuleStats()     — per-module activity/usage counts
 *   - useExpenseStats()    — expense breakdown by category
 *   - useSupportMetrics()  — support ticket volume and resolution stats
 *   - useTopProducts()     — top-selling products by revenue
 */
import { useQuery } from '@tanstack/react-query'
import { DASHBOARD_PRESET } from '@/utils/queryDefaults'
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

export interface ExpenseDataPoint {
  month: string
  expenses: number
}

export interface ExpenseStatsResponse {
  service_available: boolean
  data: ExpenseDataPoint[]
  mock?: boolean
}

export interface SupportMetrics {
  open: number
  resolved: number
  closed: number
  total: number
}

export interface SupportMetricsResponse {
  service_available: boolean
  data: SupportMetrics
  mock?: boolean
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
    ...DASHBOARD_PRESET,
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
    ...DASHBOARD_PRESET,
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
    ...DASHBOARD_PRESET,
  })
}

/** Alias — used by AnalyticsPage */
export const useModuleUsageStats = useModuleStats

// ─── Expense Stats ───────────────────────────────────────────────────────────

export function useExpenseStats(months?: number) {
  return useQuery({
    queryKey: ['analytics', 'expenses', months],
    queryFn: async () => {
      const params = months ? { months } : {}
      const { data } = await apiClient.get<ExpenseStatsResponse>('/analytics/stats/expenses', { params })
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

// ─── Support Metrics ─────────────────────────────────────────────────────────

export function useSupportMetrics() {
  return useQuery({
    queryKey: ['analytics', 'support-metrics'],
    queryFn: async () => {
      const { data } = await apiClient.get<SupportMetricsResponse>('/analytics/stats/support-metrics')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

// ─── Top Products Stats ─────────────────────────────────────────────────

export interface TopProductEntry {
  name: string
  units_sold: number
  revenue: number
}

export interface TopProductsResponse {
  service_available: boolean
  data: TopProductEntry[]
  mock?: boolean
}

export function useTopProducts(limit?: number) {
  return useQuery({
    queryKey: ['analytics', 'top-products', limit],
    queryFn: async () => {
      const params = limit ? { limit } : {}
      const { data } = await apiClient.get<TopProductsResponse>('/analytics/stats/top-products', { params })
      return data
    },
    ...DASHBOARD_PRESET,
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
    ...DASHBOARD_PRESET,
  })
}
