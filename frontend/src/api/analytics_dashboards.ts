/**
 * Analytics Dashboards API — hooks for pre-built module dashboards.
 *
 * Each hook fetches real DB data for a specific module dashboard,
 * replacing hardcoded mock data in the prebuilt dashboard components.
 */
import { useMutation, useQuery } from '@tanstack/react-query'
import { DASHBOARD_PRESET } from '@/utils/queryDefaults'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthPoint {
  month: string
  [key: string]: string | number
}

export interface NameValuePoint {
  [key: string]: unknown
  name: string
  value: number
}

// Manufacturing
export interface ManufacturingDashboardData {
  production_data: MonthPoint[]
  defect_data: { month: string; rate: number }[]
  wo_status: NameValuePoint[]
  workstations: { name: string; utilization: number }[]
  oee: { score: number; availability: number; performance: number; quality: number }
  kpis: { oee: number; monthly_output: number; defect_rate: number; active_work_orders: number }
}

// CRM
export interface CRMDashboardData {
  pipeline_stages: NameValuePoint[]
  lead_sources: NameValuePoint[]
  conversion_data: { month: string; rate: number }[]
  velocity_data: { month: string; days: number }[]
  deal_sizes: { range: string; count: number }[]
  kpis: { pipeline_deals: number; pipeline_value: number; avg_deal_size: number; conversion_rate: number }
}

// HR
export interface HRDashboardData {
  headcount_data: { month: string; headcount: number }[]
  attrition_data: { month: string; rate: number }[]
  dept_distribution: NameValuePoint[]
  attendance_data: { month: string; present: number; remote: number; absent: number }[]
  leave_data: { type: string; used: number; total: number }[]
  kpis: { active_employees: number; attrition_rate: number; attendance_rate: number; leave_utilization: number }
}

// Inventory
export interface InventoryDashboardData {
  stock_by_category: NameValuePoint[]
  turnover_data: { month: string; ratio: number }[]
  valuation_data: { month: string; value: number }[]
  top_items: { name: string; qty: number; value: number }[]
  warehouse_data: { name: string; capacity: number }[]
  kpis: { total_skus: number; total_valuation: number; avg_turnover: number; low_stock_alerts: number }
}

// Support
export interface SupportDashboardData {
  volume_data: { month: string; new: number; resolved: number }[]
  resolution_data: { month: string; hours: number }[]
  categories: NameValuePoint[]
  priorities: NameValuePoint[]
  csat_data: { month: string; score: number }[]
  kpis: { open_tickets: number; resolved: number; avg_resolution: number; csat_score: number; sla_compliance: number }
}

// E-Commerce
export interface ECommerceDashboardData {
  order_data: { month: string; orders: number }[]
  order_status: NameValuePoint[]
  revenue_data: { month: string; Revenue: number }[]
  top_products: { name: string; units_sold: number; revenue: number }[]
  kpis: { total_revenue: number; total_orders: number; avg_order_value: number }
}

// Finance
export interface FinanceDashboardData {
  pnl_data: { month: string; Revenue: number; Expenses: number; Profit: number }[]
  cash_flow_data: { month: string; 'Cash Flow': number }[]
  expense_distribution: NameValuePoint[]
  kpis: { revenue_mtd: number; open_invoices: number; total_expenses: number; net_profit: number }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useManufacturingDashboard() {
  return useQuery({
    queryKey: ['analytics', 'dashboard', 'manufacturing'],
    queryFn: async () => {
      const { data } = await apiClient.get<ManufacturingDashboardData>('/analytics/dashboard/manufacturing')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

export function useCRMDashboard() {
  return useQuery({
    queryKey: ['analytics', 'dashboard', 'crm'],
    queryFn: async () => {
      const { data } = await apiClient.get<CRMDashboardData>('/analytics/dashboard/crm')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

export function useHRDashboard() {
  return useQuery({
    queryKey: ['analytics', 'dashboard', 'hr'],
    queryFn: async () => {
      const { data } = await apiClient.get<HRDashboardData>('/analytics/dashboard/hr')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

export function useInventoryDashboard() {
  return useQuery({
    queryKey: ['analytics', 'dashboard', 'inventory'],
    queryFn: async () => {
      const { data } = await apiClient.get<InventoryDashboardData>('/analytics/dashboard/inventory')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

export function useSupportDashboard() {
  return useQuery({
    queryKey: ['analytics', 'dashboard', 'support'],
    queryFn: async () => {
      const { data } = await apiClient.get<SupportDashboardData>('/analytics/dashboard/support')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

export function useECommerceDashboard() {
  return useQuery({
    queryKey: ['analytics', 'dashboard', 'ecommerce'],
    queryFn: async () => {
      const { data } = await apiClient.get<ECommerceDashboardData>('/analytics/dashboard/ecommerce')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

export function useFinanceDashboard() {
  return useQuery({
    queryKey: ['analytics', 'dashboard', 'finance'],
    queryFn: async () => {
      const { data } = await apiClient.get<FinanceDashboardData>('/analytics/dashboard/finance')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

// ─── XLSX Export ──────────────────────────────────────────────────────────────

export interface ExportSection {
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[]
}

export function useExportDashboardXlsx() {
  return useMutation({
    mutationFn: async (payload: { title: string; sections: ExportSection[] }) => {
      const { data } = await apiClient.post('/analytics/dashboard/export-xlsx', payload, {
        responseType: 'blob',
      })
      return data as Blob
    },
  })
}
