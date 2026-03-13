/**
 * Manufacturing Extended API client — routing steps, scrap tracking, maintenance
 * schedules, and inline quality control records.
 *
 * Exports TanStack Query hooks and Axios helper functions for the Manufacturing
 * module's extended operations. All requests go through `client.ts` (Axios
 * instance with auth interceptors). Backend prefix: `/api/v1/manufacturing`.
 *
 * Key exports:
 *   - useRoutingSteps() / useCreateRoutingStep() — BOM operation routing CRUD
 *   - useScrapEntries() / useCreateScrapEntry() — material and WIP scrap logging
 *   - useMaintenanceSchedules() / useCreateMaintenanceSchedule() — PM/CM scheduling
 *   - useQualityControlRecords() / useCreateQCRecord() — step-level QC recording
 *   - useMfgKPIs() — OEE and production KPI aggregates
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoutingStep {
  id: string
  bom_id: string
  step_number: number
  name: string
  description: string | null
  workstation_id: string | null
  workstation_name: string | null
  setup_time_minutes: number
  run_time_minutes: number
  teardown_time_minutes: number
  labor_cost_per_hour: number
  overhead_cost_per_hour: number
  is_optional: boolean
  instructions: string | null
  created_at: string
  updated_at: string
}

export interface ScrapEntry {
  id: string
  work_order_id: string
  wo_number: string | null
  item_id: string
  item_name: string | null
  quantity: number
  unit_of_measure: string
  reason: string
  scrap_type: 'material' | 'finished_product' | 'wip'
  cost_impact: number
  reported_by: string
  reported_by_name: string | null
  reported_at: string
  notes: string | null
}

export interface MaintenanceSchedule {
  id: string
  workstation_id: string
  workstation_name: string | null
  title: string
  description: string | null
  maintenance_type: 'preventive' | 'corrective' | 'predictive'
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time'
  status: 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled'
  scheduled_date: string
  completed_date: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  estimated_duration_hours: number | null
  actual_duration_hours: number | null
  cost: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface QualityControlRecord {
  id: string
  work_order_id: string
  wo_number: string | null
  routing_step_id: string | null
  step_name: string | null
  parameter_name: string
  expected_value: string
  actual_value: string
  tolerance: string | null
  result: 'pass' | 'fail' | 'warning'
  inspector_id: string
  inspector_name: string | null
  inspected_at: string
  notes: string | null
}

export interface MfgKPIs {
  oee: number
  availability: number
  performance: number
  quality_rate: number
  total_output: number
  defect_count: number
  scrap_cost: number
  avg_cycle_time_minutes: number
  capacity_utilization: number
  mtbf_hours: number
  mttr_hours: number
  on_time_completion_rate: number
}

export interface OEEReport {
  period: string
  oee: number
  availability: number
  performance: number
  quality: number
  planned_production_time: number
  actual_production_time: number
  total_output: number
  good_output: number
}

export interface ProductionPlanItem {
  id: string
  work_order_id: string
  wo_number: string
  bom_name: string
  finished_item_name: string
  planned_quantity: number
  completed_quantity: number
  status: string
  priority: string
  planned_start: string | null
  planned_end: string | null
  workstation_name: string | null
  assigned_to_name: string | null
  material_ready: boolean
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedScrapEntries {
  total: number
  entries: ScrapEntry[]
}

export interface PaginatedMaintenanceSchedules {
  total: number
  schedules: MaintenanceSchedule[]
}

export interface PaginatedQualityControlRecords {
  total: number
  records: QualityControlRecord[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateRoutingStepPayload {
  bom_id: string
  step_number: number
  name: string
  description?: string
  workstation_id?: string
  setup_time_minutes?: number
  run_time_minutes?: number
  teardown_time_minutes?: number
  labor_cost_per_hour?: number
  overhead_cost_per_hour?: number
  is_optional?: boolean
  instructions?: string
}

export interface CreateScrapEntryPayload {
  work_order_id: string
  item_id: string
  quantity: number
  unit_of_measure?: string
  reason: string
  scrap_type: 'material' | 'finished_product' | 'wip'
  cost_impact?: number
  notes?: string
}

export interface CreateMaintenanceSchedulePayload {
  workstation_id: string
  title: string
  description?: string
  maintenance_type: 'preventive' | 'corrective' | 'predictive'
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time'
  scheduled_date: string
  assigned_to?: string
  estimated_duration_hours?: number
  cost?: number
  notes?: string
}

export interface UpdateMaintenanceSchedulePayload extends Partial<CreateMaintenanceSchedulePayload> {
  id: string
  status?: string
  completed_date?: string
  actual_duration_hours?: number
}

export interface CreateQualityControlPayload {
  work_order_id: string
  routing_step_id?: string
  parameter_name: string
  expected_value: string
  actual_value: string
  tolerance?: string
  result: 'pass' | 'fail' | 'warning'
  notes?: string
}

// ─── Routing Steps ────────────────────────────────────────────────────────────

export function useRouting(bomId: string) {
  return useQuery({
    queryKey: ['manufacturing', 'routing', bomId],
    queryFn: async () => {
      const { data } = await apiClient.get<RoutingStep[]>(`/manufacturing/bom/${bomId}/routing`)
      return data
    },
    enabled: !!bomId,
  })
}

export function useCreateRoutingStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateRoutingStepPayload) => {
      const { data } = await apiClient.post<RoutingStep>(`/manufacturing/bom/${payload.bom_id}/routing`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'routing'] }),
  })
}

export function useUpdateRoutingStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateRoutingStepPayload> & { id: string }) => {
      const { data } = await apiClient.put<RoutingStep>(`/manufacturing/routing/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'routing'] }),
  })
}

export function useDeleteRoutingStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/manufacturing/routing/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'routing'] }),
  })
}

// ─── Scrap Entries ────────────────────────────────────────────────────────────

export function useScrapEntries(params: { work_order_id?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['manufacturing', 'scrap', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedScrapEntries>('/manufacturing/scrap', { params })
      return data
    },
  })
}

export function useCreateScrapEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateScrapEntryPayload) => {
      const { data } = await apiClient.post<ScrapEntry>('/manufacturing/scrap', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturing', 'scrap'] })
      qc.invalidateQueries({ queryKey: ['manufacturing', 'dashboard'] })
    },
  })
}

// ─── Maintenance Schedules ────────────────────────────────────────────────────

export function useMaintenanceSchedules(params: { status?: string; workstation_id?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['manufacturing', 'maintenance', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedMaintenanceSchedules>('/manufacturing/maintenance', { params })
      return data
    },
  })
}

export function useCreateMaintenanceSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateMaintenanceSchedulePayload) => {
      const { data } = await apiClient.post<MaintenanceSchedule>('/manufacturing/maintenance', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'maintenance'] }),
  })
}

export function useUpdateMaintenanceSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateMaintenanceSchedulePayload) => {
      const { data } = await apiClient.put<MaintenanceSchedule>(`/manufacturing/maintenance/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'maintenance'] }),
  })
}

export function useDeleteMaintenanceSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/manufacturing/maintenance/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'maintenance'] }),
  })
}

// ─── Quality Control Records ──────────────────────────────────────────────────

export function useQualityControlRecords(params: { work_order_id?: string; result?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['manufacturing', 'quality-control', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedQualityControlRecords>('/manufacturing/quality-control', { params })
      return data
    },
  })
}

export function useCreateQualityControl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateQualityControlPayload) => {
      const { data } = await apiClient.post<QualityControlRecord>('/manufacturing/quality-control', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'quality-control'] }),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useOEEReport(params: { period?: 'daily' | 'weekly' | 'monthly'; start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['manufacturing', 'reports', 'oee', params],
    queryFn: async () => {
      const { data } = await apiClient.get<OEEReport[]>('/manufacturing/reports/oee', { params })
      return data
    },
  })
}

export function useProductionPlan(params: { status?: string; start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['manufacturing', 'production-plan', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ProductionPlanItem[]>('/manufacturing/production-plan', { params })
      return data
    },
  })
}

export function useMfgKPIs() {
  return useQuery({
    queryKey: ['manufacturing', 'kpis'],
    queryFn: async () => {
      const { data } = await apiClient.get<MfgKPIs>('/manufacturing/kpis')
      return data
    },
  })
}
