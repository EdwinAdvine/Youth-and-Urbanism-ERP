import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskAssessment {
  id: string
  title: string
  category: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  risk_score: number | null
  status: string
  description: string | null
  supplier_id: string | null
  product_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateRiskAssessmentPayload {
  title: string
  category: string
  risk_level: string
  description?: string
  supplier_id?: string | null
  product_id?: string | null
}

export interface RiskScenario {
  id: string
  assessment_id: string
  name: string
  scenario_type: 'optimistic' | 'base' | 'pessimistic'
  probability: number
  cost_impact: number
  revenue_impact: number
  delay_days: number
  description: string | null
  created_at: string
}

export interface CreateScenarioPayload {
  name: string
  scenario_type: 'optimistic' | 'base' | 'pessimistic'
  probability: number
  cost_impact: number
  revenue_impact: number
  delay_days: number
  description?: string
}

export interface MitigationPlan {
  id: string
  assessment_id: string
  title: string
  description: string | null
  action_type: string
  status: string
  owner_id: string | null
  owner_name: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
}

export interface CreateMitigationPlanPayload {
  title: string
  description?: string
  action_type: string
  owner_id?: string | null
  due_date?: string | null
}

export interface SimulationResult {
  assessment_id: string
  simulated_at: string
  outcomes: {
    scenario_type: string
    expected_cost: number
    expected_revenue_loss: number
    expected_delay_days: number
    weighted_risk_score: number
  }[]
}

export interface MRPRun {
  id: string
  run_number: string
  status: string
  planning_horizon_days: number
  product_ids: string[] | null
  total_demand_lines: number | null
  planned_orders_count: number | null
  exceptions_count: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface CreateMRPRunPayload {
  planning_horizon_days: number
  product_ids?: string[]
}

export interface MRPLine {
  id: string
  run_id: string
  product_id: string
  product_name: string
  sku: string
  demand_quantity: number
  on_hand_quantity: number
  planned_order_quantity: number
  planned_order_date: string | null
  lead_time_days: number | null
  exception_type: string | null
  exception_message: string | null
}

export interface ProductionSchedule {
  id: string
  product_id: string
  product_name: string
  sku: string
  work_center: string
  planned_qty: number
  produced_qty: number
  scheduled_start: string
  scheduled_end: string
  status: string
  priority: number
  mrp_run_id: string | null
  notes: string | null
}

export interface UpdateProductionSchedulePayload {
  status?: string
  produced_qty?: number
  notes?: string
}

// ─── API Functions ─────────────────────────────────────────────────────────────

// Risk Assessments
export const getRiskAssessments = (params?: Record<string, unknown>) =>
  apiClient.get('/supply-chain/risk/assessments', { params }).then((r) => r.data)

export const getRiskAssessment = (id: string) =>
  apiClient.get(`/supply-chain/risk/assessments/${id}`).then((r) => r.data)

export const createRiskAssessment = (payload: CreateRiskAssessmentPayload) =>
  apiClient.post('/supply-chain/risk/assessments', payload).then((r) => r.data)

export const updateRiskAssessment = (id: string, payload: Partial<CreateRiskAssessmentPayload & { status: string; risk_score: number }>) =>
  apiClient.patch(`/supply-chain/risk/assessments/${id}`, payload).then((r) => r.data)

export const deleteRiskAssessment = (id: string) =>
  apiClient.delete(`/supply-chain/risk/assessments/${id}`).then((r) => r.data)

// Scenarios
export const getScenarios = (assessmentId: string) =>
  apiClient.get(`/supply-chain/risk/assessments/${assessmentId}/scenarios`).then((r) => r.data)

export const createScenario = (assessmentId: string, payload: CreateScenarioPayload) =>
  apiClient.post(`/supply-chain/risk/assessments/${assessmentId}/scenarios`, payload).then((r) => r.data)

export const updateScenario = (assessmentId: string, scenarioId: string, payload: Partial<CreateScenarioPayload>) =>
  apiClient.patch(`/supply-chain/risk/assessments/${assessmentId}/scenarios/${scenarioId}`, payload).then((r) => r.data)

export const deleteScenario = (assessmentId: string, scenarioId: string) =>
  apiClient.delete(`/supply-chain/risk/assessments/${assessmentId}/scenarios/${scenarioId}`).then((r) => r.data)

// Simulation
export const runSimulation = (assessmentId: string) =>
  apiClient.post(`/supply-chain/risk/assessments/${assessmentId}/simulate`).then((r) => r.data)

// Mitigation Plans
export const getMitigationPlans = (assessmentId: string) =>
  apiClient.get(`/supply-chain/risk/assessments/${assessmentId}/mitigation-plans`).then((r) => r.data)

export const createMitigationPlan = (assessmentId: string, payload: CreateMitigationPlanPayload) =>
  apiClient.post(`/supply-chain/risk/assessments/${assessmentId}/mitigation-plans`, payload).then((r) => r.data)

export const updateMitigationPlan = (assessmentId: string, planId: string, payload: Partial<CreateMitigationPlanPayload & { status: string; completed_at: string }>) =>
  apiClient.patch(`/supply-chain/risk/assessments/${assessmentId}/mitigation-plans/${planId}`, payload).then((r) => r.data)

// MRP Runs
export const getMRPRuns = (params?: Record<string, unknown>) =>
  apiClient.get('/supply-chain/mrp/runs', { params }).then((r) => r.data)

export const getMRPRun = (id: string) =>
  apiClient.get(`/supply-chain/mrp/runs/${id}`).then((r) => r.data)

export const createMRPRun = (payload: CreateMRPRunPayload) =>
  apiClient.post('/supply-chain/mrp/runs', payload).then((r) => r.data)

export const getMRPLines = (runId: string, params?: Record<string, unknown>) =>
  apiClient.get(`/supply-chain/mrp/runs/${runId}/lines`, { params }).then((r) => r.data)

// Production Schedules
export const getProductionSchedules = (params?: Record<string, unknown>) =>
  apiClient.get('/supply-chain/mrp/production-schedules', { params }).then((r) => r.data)

export const getProductionSchedule = (id: string) =>
  apiClient.get(`/supply-chain/mrp/production-schedules/${id}`).then((r) => r.data)

export const updateProductionSchedule = (id: string, payload: UpdateProductionSchedulePayload) =>
  apiClient.patch(`/supply-chain/mrp/production-schedules/${id}`, payload).then((r) => r.data)

// ─── TanStack Query Hooks ──────────────────────────────────────────────────────

export function useRiskAssessments(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'risk-assessments', params],
    queryFn: () => getRiskAssessments(params),
  })
}

export function useRiskAssessment(id: string) {
  return useQuery({
    queryKey: ['sc', 'risk-assessment', id],
    queryFn: () => getRiskAssessment(id),
    enabled: !!id,
  })
}

export function useCreateRiskAssessment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createRiskAssessment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'risk-assessments'] }),
  })
}

export function useUpdateRiskAssessment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateRiskAssessment>[1] }) =>
      updateRiskAssessment(id, payload),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['sc', 'risk-assessments'] })
      qc.invalidateQueries({ queryKey: ['sc', 'risk-assessment', id] })
    },
  })
}

export function useDeleteRiskAssessment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRiskAssessment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'risk-assessments'] }),
  })
}

export function useScenarios(assessmentId: string) {
  return useQuery({
    queryKey: ['sc', 'scenarios', assessmentId],
    queryFn: () => getScenarios(assessmentId),
    enabled: !!assessmentId,
  })
}

export function useCreateScenario(assessmentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateScenarioPayload) => createScenario(assessmentId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'scenarios', assessmentId] }),
  })
}

export function useRunSimulation() {
  return useMutation({
    mutationFn: runSimulation,
  })
}

export function useMitigationPlans(assessmentId: string) {
  return useQuery({
    queryKey: ['sc', 'mitigation-plans', assessmentId],
    queryFn: () => getMitigationPlans(assessmentId),
    enabled: !!assessmentId,
  })
}

export function useCreateMitigationPlan(assessmentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateMitigationPlanPayload) => createMitigationPlan(assessmentId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'mitigation-plans', assessmentId] }),
  })
}

export function useMRPRuns(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'mrp-runs', params],
    queryFn: () => getMRPRuns(params),
  })
}

export function useMRPRun(id: string) {
  return useQuery({
    queryKey: ['sc', 'mrp-run', id],
    queryFn: () => getMRPRun(id),
    enabled: !!id,
  })
}

export function useCreateMRPRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMRPRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'mrp-runs'] }),
  })
}

export function useMRPLines(runId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'mrp-lines', runId, params],
    queryFn: () => getMRPLines(runId, params),
    enabled: !!runId,
  })
}

export function useProductionSchedules(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'production-schedules', params],
    queryFn: () => getProductionSchedules(params),
  })
}

export function useProductionSchedule(id: string) {
  return useQuery({
    queryKey: ['sc', 'production-schedule', id],
    queryFn: () => getProductionSchedule(id),
    enabled: !!id,
  })
}

export function useUpdateProductionSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProductionSchedulePayload }) =>
      updateProductionSchedule(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'production-schedules'] }),
  })
}
