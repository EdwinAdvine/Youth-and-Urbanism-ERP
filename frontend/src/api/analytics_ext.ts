import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Dashboard {
  id: string
  name: string
  description: string | null
  is_default: boolean
  is_shared: boolean
  layout: Record<string, unknown> | null
  owner_id: string
  owner_name: string | null
  created_at: string
  updated_at: string
}

export interface DashboardWidget {
  id: string
  dashboard_id: string
  title: string
  widget_type: 'chart' | 'kpi' | 'table' | 'gauge' | 'map' | 'text'
  chart_type: 'line' | 'bar' | 'pie' | 'donut' | 'area' | 'scatter' | null
  data_source: string
  query: string | null
  config: Record<string, unknown> | null
  position_x: number
  position_y: number
  width: number
  height: number
  refresh_interval: number | null
  created_at: string
  updated_at: string
}

export interface SavedQuery {
  id: string
  name: string
  description: string | null
  query_text: string
  data_source: string
  parameters: Record<string, unknown> | null
  is_shared: boolean
  owner_id: string
  owner_name: string | null
  last_run_at: string | null
  run_count: number
  created_at: string
  updated_at: string
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  total_rows: number
  execution_time_ms: number
}

export interface Report {
  id: string
  name: string
  description: string | null
  report_type: 'scheduled' | 'on_demand'
  query_id: string | null
  query_name: string | null
  format: 'pdf' | 'csv' | 'xlsx'
  schedule: string | null
  recipients: string[] | null
  last_generated_at: string | null
  is_active: boolean
  owner_id: string
  created_at: string
  updated_at: string
}

export interface DataAlert {
  id: string
  name: string
  description: string | null
  query_id: string | null
  metric: string
  condition: 'above' | 'below' | 'equals' | 'change_by'
  threshold: number
  notification_channels: string[]
  recipients: string[] | null
  check_interval_minutes: number
  is_active: boolean
  last_triggered_at: string | null
  trigger_count: number
  owner_id: string
  created_at: string
  updated_at: string
}

export interface ModuleKPIs {
  module: string
  kpis: { name: string; value: number; change: number; trend: 'up' | 'down' | 'flat' }[]
}

export interface ModuleTrend {
  module: string
  period: string
  value: number
}

export interface ExecutiveKPIs {
  revenue_mtd: number
  revenue_change: number
  expenses_mtd: number
  expenses_change: number
  profit_margin: number
  active_customers: number
  customer_change: number
  employee_count: number
  open_tickets: number
  deals_pipeline_value: number
  inventory_value: number
  cash_balance: number
  modules: ModuleKPIs[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateDashboardPayload {
  name: string
  description?: string
  is_default?: boolean
  is_shared?: boolean
  layout?: Record<string, unknown>
}

export interface UpdateDashboardPayload extends Partial<CreateDashboardPayload> {
  id: string
}

export interface CreateWidgetPayload {
  dashboard_id: string
  title: string
  widget_type: 'chart' | 'kpi' | 'table' | 'gauge' | 'map' | 'text'
  chart_type?: string
  data_source: string
  query?: string
  config?: Record<string, unknown>
  position_x?: number
  position_y?: number
  width?: number
  height?: number
  refresh_interval?: number
}

export interface UpdateWidgetPayload extends Partial<Omit<CreateWidgetPayload, 'dashboard_id'>> {
  id: string
}

export interface CreateSavedQueryPayload {
  name: string
  description?: string
  query_text: string
  data_source: string
  parameters?: Record<string, unknown>
  is_shared?: boolean
}

export interface CreateReportPayload {
  name: string
  description?: string
  report_type: 'scheduled' | 'on_demand'
  query_id?: string
  format: 'pdf' | 'csv' | 'xlsx'
  schedule?: string
  recipients?: string[]
  is_active?: boolean
}

export interface CreateAlertPayload {
  name: string
  description?: string
  query_id?: string
  metric: string
  condition: 'above' | 'below' | 'equals' | 'change_by'
  threshold: number
  notification_channels: string[]
  recipients?: string[]
  check_interval_minutes?: number
  is_active?: boolean
}

export interface ExecuteQueryPayload {
  query_text: string
  data_source: string
  parameters?: Record<string, unknown>
  limit?: number
}

// ─── Dashboards ───────────────────────────────────────────────────────────────

export function useDashboards() {
  return useQuery({
    queryKey: ['analytics', 'dashboards'],
    queryFn: async () => {
      const { data } = await apiClient.get<Dashboard[]>('/analytics/dashboards')
      return data
    },
  })
}

export function useDashboard(id: string) {
  return useQuery({
    queryKey: ['analytics', 'dashboards', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Dashboard>(`/analytics/dashboards/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateDashboardPayload) => {
      const { data } = await apiClient.post<Dashboard>('/analytics/dashboards', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'dashboards'] }),
  })
}

export function useUpdateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateDashboardPayload) => {
      const { data } = await apiClient.put<Dashboard>(`/analytics/dashboards/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'dashboards'] }),
  })
}

export function useDeleteDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/analytics/dashboards/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'dashboards'] }),
  })
}

// ─── Widgets ──────────────────────────────────────────────────────────────────

export function useDashboardWidgets(dashboardId: string) {
  return useQuery({
    queryKey: ['analytics', 'widgets', dashboardId],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardWidget[]>(`/analytics/dashboards/${dashboardId}/widgets`)
      return data
    },
    enabled: !!dashboardId,
  })
}

export function useCreateWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateWidgetPayload) => {
      const { data } = await apiClient.post<DashboardWidget>(
        `/analytics/dashboards/${payload.dashboard_id}/widgets`,
        payload
      )
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['analytics', 'widgets', v.dashboard_id] }),
  })
}

export function useUpdateWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateWidgetPayload) => {
      const { data } = await apiClient.put<DashboardWidget>(`/analytics/widgets/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'widgets'] }),
  })
}

export function useDeleteWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/analytics/widgets/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'widgets'] }),
  })
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useExecuteQuery() {
  return useMutation({
    mutationFn: async (payload: ExecuteQueryPayload) => {
      const { data } = await apiClient.post<QueryResult>('/analytics/queries/execute', payload)
      return data
    },
  })
}

export function useSavedQueries(params: { search?: string; data_source?: string } = {}) {
  return useQuery({
    queryKey: ['analytics', 'saved-queries', params],
    queryFn: async () => {
      const { data } = await apiClient.get<SavedQuery[]>('/analytics/queries', { params })
      return data
    },
  })
}

export function useCreateSavedQuery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSavedQueryPayload) => {
      const { data } = await apiClient.post<SavedQuery>('/analytics/queries', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'saved-queries'] }),
  })
}

export function useDeleteSavedQuery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/analytics/queries/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'saved-queries'] }),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useReports(params: { report_type?: string; is_active?: boolean } = {}) {
  return useQuery({
    queryKey: ['analytics', 'reports', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Report[]>('/analytics/reports', { params })
      return data
    },
  })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateReportPayload) => {
      const { data } = await apiClient.post<Report>('/analytics/reports', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'reports'] }),
  })
}

export function useUpdateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateReportPayload> & { id: string }) => {
      const { data } = await apiClient.put<Report>(`/analytics/reports/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'reports'] }),
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/analytics/reports/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'reports'] }),
  })
}

export function useRunReport() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/analytics/reports/${id}/run`)
      return data
    },
  })
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export function useAlerts(params: { is_active?: boolean } = {}) {
  return useQuery({
    queryKey: ['analytics', 'alerts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<DataAlert[]>('/analytics/alerts', { params })
      return data
    },
  })
}

export function useCreateAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAlertPayload) => {
      const { data } = await apiClient.post<DataAlert>('/analytics/alerts', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'alerts'] }),
  })
}

export function useUpdateAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateAlertPayload> & { id: string }) => {
      const { data } = await apiClient.put<DataAlert>(`/analytics/alerts/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'alerts'] }),
  })
}

export function useDeleteAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/analytics/alerts/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'alerts'] }),
  })
}

// ─── Module KPIs & Executive ──────────────────────────────────────────────────

export function useModuleKPIs(module?: string) {
  return useQuery({
    queryKey: ['analytics', 'module-kpis', module],
    queryFn: async () => {
      const params = module ? { module } : {}
      const { data } = await apiClient.get<ModuleKPIs[]>('/analytics/kpis/modules', { params })
      return data
    },
  })
}

export function useModuleTrends(params: { module: string; period?: 'daily' | 'weekly' | 'monthly' } = { module: '' }) {
  return useQuery({
    queryKey: ['analytics', 'module-trends', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ModuleTrend[]>('/analytics/kpis/trends', { params })
      return data
    },
    enabled: !!params.module,
  })
}

export function useExecutiveSummary() {
  return useQuery({
    queryKey: ['analytics', 'executive-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<ExecutiveKPIs>('/analytics/kpis/executive')
      return data
    },
  })
}
