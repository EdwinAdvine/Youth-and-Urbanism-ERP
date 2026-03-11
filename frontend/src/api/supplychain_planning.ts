import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DemandForecast {
  id: string
  item_id: string
  item_name: string | null
  forecast_date: string
  predicted_quantity: number
  confidence_lower: number
  confidence_upper: number
  method: string
  scenario: string | null
  scenario_id: string | null
  period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  actual_quantity: number | null
  created_at: string
  updated_at: string
}

export interface ForecastScenario {
  id: string
  name: string
  description: string | null
  assumptions: Record<string, unknown> | null
  status: 'draft' | 'active' | 'archived'
  created_by: string
  created_at: string
  updated_at: string
}

export interface SOPPlan {
  id: string
  title: string
  cycle_type: 'monthly' | 'quarterly' | 'annual'
  period_start: string
  period_end: string
  status: 'draft' | 'in_review' | 'approved' | 'closed'
  demand_summary: Record<string, unknown> | null
  supply_summary: Record<string, unknown> | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface SupplyPlan {
  id: string
  sop_id: string | null
  scenario_id: string | null
  status: 'draft' | 'active' | 'executed' | 'archived'
  generated_at: string
  plan_horizon_days: number
  line_count: number
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface SupplyPlanLine {
  id: string
  supply_plan_id: string
  item_id: string
  item_name: string | null
  supplier_id: string | null
  supplier_name: string | null
  planned_order_date: string
  planned_delivery_date: string
  quantity: number
  unit_cost: number
  total_cost: number
  status: 'planned' | 'ordered' | 'received' | 'cancelled'
}

export interface DemandSignal {
  id: string
  source: string
  signal_type: string
  item_id: string | null
  category: string | null
  region: string | null
  value: number
  confidence: number | null
  detected_at: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface CapacityPlan {
  id: string
  resource_type: string
  resource_id: string | null
  resource_name: string | null
  period_start: string
  period_end: string
  available_capacity: number
  planned_capacity: number
  utilization_pct: number | null
  unit: string
  bottleneck: boolean
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface RFx {
  id: string
  rfx_number: string
  type: 'rfq' | 'rfp' | 'rfi'
  title: string
  description: string | null
  status: 'draft' | 'published' | 'evaluating' | 'awarded' | 'closed' | 'cancelled'
  deadline: string | null
  supplier_count: number
  created_by: string
  created_at: string
  updated_at: string
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedForecasts {
  total: number
  forecasts: DemandForecast[]
}

export interface PaginatedScenarios {
  total: number
  scenarios: ForecastScenario[]
}

export interface PaginatedSOPPlans {
  total: number
  plans: SOPPlan[]
}

export interface PaginatedSupplyPlans {
  total: number
  plans: SupplyPlan[]
}

export interface PaginatedDemandSignals {
  total: number
  signals: DemandSignal[]
}

export interface PaginatedCapacityPlans {
  total: number
  plans: CapacityPlan[]
}

export interface PaginatedRFx {
  total: number
  rfx_list: RFx[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface GenerateForecastsPayload {
  item_id?: string
  scenario_id?: string
  period_type?: string
  horizon_days?: number
}

export interface CreateScenarioPayload {
  name: string
  description?: string
  assumptions?: Record<string, unknown>
}

export interface UpdateScenarioPayload {
  id: string
  name?: string
  description?: string
  assumptions?: Record<string, unknown>
  status?: string
}

export interface CreateSOPPlanPayload {
  title: string
  cycle_type: 'monthly' | 'quarterly' | 'annual'
  period_start: string
  period_end: string
  notes?: string
}

export interface UpdateSOPPlanPayload {
  id: string
  title?: string
  status?: string
  demand_summary?: Record<string, unknown>
  supply_summary?: Record<string, unknown>
  notes?: string
}

export interface WhatIfForecastPayload {
  base_forecast_id: string
  adjustment_pct?: number
  assumptions?: Record<string, unknown>
}

export interface CreateDemandSignalPayload {
  source: string
  signal_type: string
  item_id?: string
  category?: string
  region?: string
  value: number
  confidence?: number
  metadata?: Record<string, unknown>
}

export interface GenerateSupplyPlanPayload {
  sop_id?: string
  scenario_id?: string
  horizon_days?: number
}

export interface ExecuteSupplyPlanPayload {
  id: string
}

export interface UpdateSupplyPlanLinePayload {
  id: string
  supply_plan_id: string
  quantity?: number
  unit_cost?: number
  planned_order_date?: string
  planned_delivery_date?: string
  supplier_id?: string
  status?: string
}

export interface CreateCapacityPlanPayload {
  resource_type: string
  resource_id?: string
  resource_name?: string
  period_start: string
  period_end: string
  available_capacity: number
  planned_capacity: number
  unit: string
  bottleneck?: boolean
  notes?: string
}

export interface CreateRFxPayload {
  type: 'rfq' | 'rfp' | 'rfi'
  title: string
  description?: string
  deadline?: string
}

export interface UpdateRFxPayload {
  id: string
  status?: string
  title?: string
  description?: string
  deadline?: string
}

// ─── Demand Forecasts ─────────────────────────────────────────────────────────

export function useForecasts(params: { item_id?: string; scenario?: string; period_type?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'forecasts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedForecasts>('/supply-chain/planning/forecasts', { params })
      return data
    },
  })
}

export function useGenerateForecasts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: GenerateForecastsPayload) => {
      const { data } = await apiClient.post<DemandForecast[]>('/supply-chain/planning/forecasts/generate', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'forecasts'] }),
  })
}

export function useDeleteForecast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/supply-chain/planning/forecasts/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'forecasts'] }),
  })
}

export function useWhatIfForecast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: WhatIfForecastPayload) => {
      const { data } = await apiClient.post<DemandForecast[]>('/supply-chain/planning/forecasts/what-if', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'forecasts'] }),
  })
}

// ─── Demand Signals ──────────────────────────────────────────────────────────

export function useDemandSignals(params: { source?: string; signal_type?: string; item_id?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'demand-signals', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedDemandSignals>('/supply-chain/planning/demand-signals', { params })
      return data
    },
  })
}

export function useCreateDemandSignal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateDemandSignalPayload) => {
      const { data } = await apiClient.post<DemandSignal>('/supply-chain/planning/demand-signals', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'demand-signals'] }),
  })
}

// ─── Forecast Scenarios ───────────────────────────────────────────────────────

export function useScenarios(params: { status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'scenarios', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedScenarios>('/supply-chain/planning/scenarios', { params })
      return data
    },
  })
}

export function useCreateScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateScenarioPayload) => {
      const { data } = await apiClient.post<ForecastScenario>('/supply-chain/planning/scenarios', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'scenarios'] }),
  })
}

export function useUpdateScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateScenarioPayload) => {
      const { data } = await apiClient.put<ForecastScenario>(`/supply-chain/planning/scenarios/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'scenarios'] }),
  })
}

// ─── S&OP Plans ───────────────────────────────────────────────────────────────

export function useSOPPlans(params: { status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'sop-plans', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedSOPPlans>('/supply-chain/planning/sop-plans', { params })
      return data
    },
  })
}

export function useSOPPlan(id: string) {
  return useQuery({
    queryKey: ['supplychain', 'sop-plans', id],
    queryFn: async () => {
      const { data } = await apiClient.get<SOPPlan>(`/supply-chain/planning/sop-plans/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateSOPPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSOPPlanPayload) => {
      const { data } = await apiClient.post<SOPPlan>('/supply-chain/planning/sop-plans', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'sop-plans'] }),
  })
}

export function useUpdateSOPPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSOPPlanPayload) => {
      const { data } = await apiClient.put<SOPPlan>(`/supply-chain/planning/sop-plans/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'sop-plans'] }),
  })
}

export function useApproveSOPPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<SOPPlan>(`/supply-chain/planning/sop-plans/${id}/approve`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'sop-plans'] }),
  })
}

// ─── Supply Plans ─────────────────────────────────────────────────────────────

export function useSupplyPlans(params: { status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'supply-plans', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedSupplyPlans>('/supply-chain/planning/supply-plans', { params })
      return data
    },
  })
}

export function useSupplyPlan(id: string) {
  return useQuery({
    queryKey: ['supplychain', 'supply-plans', id],
    queryFn: async () => {
      const { data } = await apiClient.get<SupplyPlan & { lines: SupplyPlanLine[] }>(`/supply-chain/planning/supply-plans/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useGenerateSupplyPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: GenerateSupplyPlanPayload) => {
      const { data } = await apiClient.post<SupplyPlan>('/supply-chain/planning/supply-plans/generate', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'supply-plans'] }),
  })
}

export function useExecuteSupplyPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: ExecuteSupplyPlanPayload) => {
      const { data } = await apiClient.post<SupplyPlan>(`/supply-chain/planning/supply-plans/${id}/execute`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'supply-plans'] }),
  })
}

// ─── Supply Plan Lines ────────────────────────────────────────────────────────

export function useUpdateSupplyPlanLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, supply_plan_id, ...payload }: UpdateSupplyPlanLinePayload) => {
      const { data } = await apiClient.put<SupplyPlanLine>(
        `/supply-chain/planning/supply-plans/${supply_plan_id}/lines/${id}`,
        payload
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'supply-plans'] }),
  })
}

// ─── Capacity Plans ──────────────────────────────────────────────────────────

export function useCapacityPlans(params: { resource_type?: string; bottleneck?: boolean; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'capacity-plans', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedCapacityPlans>('/supply-chain/planning/capacity-plans', { params })
      return data
    },
  })
}

export function useCreateCapacityPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCapacityPlanPayload) => {
      const { data } = await apiClient.post<CapacityPlan>('/supply-chain/planning/capacity-plans', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'capacity-plans'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

// ─── RFx ──────────────────────────────────────────────────────────────────────

export function useRFxList(params: { type?: string; status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'rfx', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedRFx>('/supply-chain/planning/rfx', { params })
      return data
    },
  })
}

export function useCreateRFx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateRFxPayload) => {
      const { data } = await apiClient.post<RFx>('/supply-chain/planning/rfx', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'rfx'] }),
  })
}

export function useUpdateRFx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRFxPayload) => {
      const { data } = await apiClient.put<RFx>(`/supply-chain/planning/rfx/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'rfx'] }),
  })
}
