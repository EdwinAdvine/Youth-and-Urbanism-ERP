import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  finance: {
    revenue_mtd: number
    outstanding_invoices: number
    outstanding_amount: number
  }
  hr: {
    headcount: number
    on_leave_today: number
  }
  crm: {
    new_leads_this_month: number
    pipeline_value: number
    deals_closed_this_month: number
    deals_value_this_month: number
  }
  projects: {
    active_projects: number
    open_tasks: number
  }
}

export interface ActivityEntry {
  id: string
  activity_type: string
  message: string
  module: string
  user_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>('/dashboard/stats')
      return data
    },
    refetchInterval: 60_000, // refresh every minute
  })
}

export function useDashboardActivity(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: ActivityEntry[] }>('/dashboard/activity', {
        params: { limit },
      })
      return data.items
    },
    refetchInterval: 30_000, // refresh every 30s
  })
}
