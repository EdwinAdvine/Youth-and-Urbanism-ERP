import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ControlTowerHealth {
  health_score: number
  open_alerts: number
  otif_rate: number
  avg_lead_time_days: number
  pending_shipments: number
  delayed_shipments: number
}

export interface ControlTowerEvent {
  id: string
  event_type: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  timestamp: string
  module: string | null
  reference_id: string | null
}

export interface ControlTowerDashboardData {
  health: ControlTowerHealth
  recent_alerts: SCAlert[]
  events: ControlTowerEvent[]
}

export interface SCAlert {
  id: string
  alert_number: string
  alert_type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string | null
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  reference_type: string | null
  reference_id: string | null
  assigned_to: string | null
  acknowledged_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface SupplyChainKPI {
  id: string
  name: string
  category: string
  value: number
  target: number | null
  unit: string | null
  period_start: string
  period_end: string
  trend: string | null
  calculated_at: string
  created_at: string
}

export interface SupplyChainEvent {
  id: string
  event_type: string
  source_module: string
  source_id: string | null
  description: string
  severity: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface SafetyStockConfig {
  id: string
  item_id: string
  item_name: string | null
  warehouse_id: string | null
  safety_stock_qty: number
  service_level_pct: number | null
  avg_demand: number | null
  demand_std_dev: number | null
  lead_time_days: number | null
  method: string
  last_calculated_at: string | null
  created_at: string
  updated_at: string
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedAlerts {
  total: number
  alerts: SCAlert[]
}

export interface PaginatedKPIs {
  total: number
  kpis: SupplyChainKPI[]
}

export interface PaginatedEvents {
  total: number
  events: SupplyChainEvent[]
}

export interface PaginatedSafetyStockConfigs {
  total: number
  configs: SafetyStockConfig[]
}

// ─── Control Tower ────────────────────────────────────────────────────────────

export function useControlTowerDashboard() {
  return useQuery({
    queryKey: ['supplychain', 'control-tower', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<ControlTowerDashboardData>('/supply-chain/control-tower/dashboard')
      return data
    },
    refetchInterval: 30_000,
  })
}

export function useControlTowerHealth() {
  return useQuery({
    queryKey: ['supplychain', 'control-tower', 'health'],
    queryFn: async () => {
      const { data } = await apiClient.get<ControlTowerHealth>('/supply-chain/control-tower/health')
      return data
    },
    refetchInterval: 30_000,
  })
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export function useAlerts(params: { severity?: string; status?: string; alert_type?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'alerts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedAlerts>('/supply-chain/control-tower/alerts', { params })
      return data
    },
  })
}

export function useCreateAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAlertPayload) => {
      const { data } = await apiClient.post<SCAlert>('/supply-chain/control-tower/alerts', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'alerts'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'control-tower'] })
    },
  })
}

export function useUpdateAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateAlertPayload) => {
      const { data } = await apiClient.put<SCAlert>(`/supply-chain/control-tower/alerts/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'alerts'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'control-tower'] })
    },
  })
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<SCAlert>(`/supply-chain/control-tower/alerts/${id}/acknowledge`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'alerts'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'control-tower'] })
    },
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<SCAlert>(`/supply-chain/control-tower/alerts/${id}/resolve`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'alerts'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'control-tower'] })
    },
  })
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export function useSupplyChainKPIs(params: { category?: string; period_start?: string; period_end?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'kpis', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedKPIs>('/supply-chain/kpis', { params })
      return data
    },
  })
}

export function useCalculateKPIs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { period_start: string; period_end: string; categories?: string[] }) => {
      const { data } = await apiClient.post<SupplyChainKPI[]>('/supply-chain/kpis/calculate', params)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'kpis'] }),
  })
}

// ─── Events ───────────────────────────────────────────────────────────────────

export function useSupplyChainEvents(params: { event_type?: string; source_module?: string; severity?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'events', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedEvents>('/supply-chain/events', { params })
      return data
    },
  })
}

// ─── Safety Stock ─────────────────────────────────────────────────────────────

export function useSafetyStockConfigs(params: { item_id?: string; warehouse_id?: string; method?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'safety-stock', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedSafetyStockConfigs>('/supply-chain/safety-stock', { params })
      return data
    },
  })
}

export function useCalculateSafetyStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { item_ids?: string[]; warehouse_id?: string; service_level_pct?: number }) => {
      const { data } = await apiClient.post<SafetyStockConfig[]>('/supply-chain/safety-stock/calculate', params)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'safety-stock'] }),
  })
}

export function useUpdateSafetyStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSafetyStockPayload) => {
      const { data } = await apiClient.put<SafetyStockConfig>(`/supply-chain/safety-stock/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'safety-stock'] }),
  })
}

// ─── Additional Payload types ────────────────────────────────────────────────

export interface UpdateSafetyStockPayload {
  id: string
  safety_stock_qty?: number
  service_level_pct?: number
  method?: string
}

// ─── RFx Types ────────────────────────────────────────────────────────────────

export interface RFxItem {
  id: string
  rfx_number: string
  rfx_type: string
  title: string
  description: string | null
  status: string
  deadline: string | null
  created_by: string
  items: Record<string, unknown> | null
  invited_suppliers: string[] | null
  created_at: string
  updated_at: string
}

export interface RFxResponseItem {
  id: string
  rfx_id: string
  supplier_id: string
  submitted_at: string
  status: string
  quoted_items: Record<string, unknown> | null
  total_value: number
  lead_time_days: number | null
  notes: string | null
  score: number | null
  created_at: string
}

export interface SupplierRiskItem {
  id: string
  supplier_id: string
  risk_type: string
  severity: string
  description: string
  source: string | null
  mitigation_notes: string | null
  status: string
  detected_at: string
  last_reviewed_at: string | null
  created_at: string
}

export interface ReplenishmentRuleItem {
  id: string
  item_id: string
  warehouse_id: string
  rule_type: string
  min_level: number
  max_level: number
  reorder_point: number
  reorder_quantity: number
  lead_time_days: number
  supplier_id: string | null
  is_active: boolean
  auto_generate_po: boolean
  last_triggered_at: string | null
  created_at: string
}

export interface StockHealthScoreItem {
  id: string
  item_id: string
  warehouse_id: string | null
  health_status: string
  days_of_stock: number
  turnover_rate: number
  last_movement_date: string | null
  recommended_action: string
  calculated_at: string
}

export interface WorkflowTemplateItem {
  id: string
  name: string
  description: string | null
  trigger_event: string
  steps: Record<string, unknown> | null
  is_active: boolean
  created_by: string
  created_at: string
}

export interface WorkflowRunItem {
  id: string
  template_id: string
  trigger_data: Record<string, unknown> | null
  status: string
  started_at: string
  completed_at: string | null
  error_message: string | null
  created_at: string
}

export interface WorkflowStepItem {
  id: string
  run_id: string
  step_index: number
  action: string
  params: Record<string, unknown> | null
  status: string
  result: Record<string, unknown> | null
  started_at: string | null
  completed_at: string | null
}

export interface ComplianceRecordItem {
  id: string
  entity_type: string
  entity_id: string
  compliance_type: string
  status: string
  details: Record<string, unknown> | null
  expiry_date: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface ESGMetricItem {
  id: string
  supplier_id: string | null
  metric_type: string
  period: string
  value: number
  unit: string
  benchmark: number | null
  source: string | null
  created_at: string
}

// ─── RFx Hooks ────────────────────────────────────────────────────────────────

export function useRFxList(params: { rfx_type?: string; status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain-ops', 'rfx', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; rfx_list: RFxItem[] }>('/supply-chain/rfx', { params })
      return data
    },
  })
}

export function useRFx(rfxId: string) {
  return useQuery({
    queryKey: ['supplychain-ops', 'rfx', rfxId],
    queryFn: async () => {
      const { data } = await apiClient.get<RFxItem & { responses: RFxResponseItem[] }>(`/supply-chain/rfx/${rfxId}`)
      return data
    },
    enabled: !!rfxId,
  })
}

export function useRFxResponses(rfxId: string) {
  return useQuery({
    queryKey: ['supplychain-ops', 'rfx', rfxId, 'responses'],
    queryFn: async () => {
      const { data } = await apiClient.get<RFxResponseItem[]>(`/supply-chain/rfx/${rfxId}/responses`)
      return data
    },
    enabled: !!rfxId,
  })
}

export function useCreateRFxResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateRFxResponsePayload) => {
      const { data } = await apiClient.post(`/supply-chain/rfx/${payload.rfx_id}/responses`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'rfx'] }),
  })
}

export function usePublishRFx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/supply-chain/rfx/${id}/publish`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'rfx'] }),
  })
}

export function useCloseRFx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/supply-chain/rfx/${id}/close`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'rfx'] }),
  })
}

export function useAwardRFx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ rfxId, responseId }: { rfxId: string; responseId: string }) => {
      const { data } = await apiClient.post(`/supply-chain/rfx/${rfxId}/award/${responseId}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'rfx'] }),
  })
}

export function useScoreRFxResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rfxId, ...payload }: { id: string; rfxId: string; score?: number; status?: string }) => {
      const { data } = await apiClient.put(`/supply-chain/rfx/${rfxId}/responses/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'rfx'] }),
  })
}

// ─── Supplier Risk Hooks ──────────────────────────────────────────────────────

export function useSupplierRisks(params: { supplier_id?: string; risk_type?: string; severity?: string; status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain-ops', 'supplier-risks', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; risks: SupplierRiskItem[] }>('/supply-chain/supplier-risks', { params })
      return data
    },
  })
}

export function useCreateSupplierRisk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { supplier_id: string; risk_type: string; severity?: string; description: string; source?: string; mitigation_notes?: string }) => {
      const { data } = await apiClient.post('/supply-chain/supplier-risks', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'supplier-risks'] }),
  })
}

// ─── Replenishment Rules Hooks ────────────────────────────────────────────────

export function useReplenishmentRules(params: { skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain-ops', 'replenishment-rules', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; rules: ReplenishmentRuleItem[] }>('/supply-chain/replenishment-rules', { params })
      return data
    },
  })
}

export function useCreateReplenishmentRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      item_id: string; warehouse_id: string; rule_type?: string; min_level?: number; max_level?: number;
      reorder_point?: number; reorder_quantity?: number; lead_time_days?: number; supplier_id?: string; auto_generate_po?: boolean
    }) => {
      const { data } = await apiClient.post('/supply-chain/replenishment-rules', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'replenishment-rules'] }),
  })
}

export function useUpdateReplenishmentRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; rule_type?: string; min_level?: number; max_level?: number; reorder_point?: number; reorder_quantity?: number; lead_time_days?: number; supplier_id?: string; is_active?: boolean; auto_generate_po?: boolean }) => {
      const { data } = await apiClient.put(`/supply-chain/replenishment-rules/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'replenishment-rules'] }),
  })
}

export function useDeleteReplenishmentRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/supply-chain/replenishment-rules/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'replenishment-rules'] }),
  })
}

export function useCheckReplenishment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/supply-chain/replenishment-rules/check')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'replenishment-rules'] }),
  })
}

// ─── Stock Health Hooks ───────────────────────────────────────────────────────

export function useStockHealth(params: { health_status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain-ops', 'stock-health', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; scores: StockHealthScoreItem[] }>('/supply-chain/stock-health', { params })
      return data
    },
  })
}

export function useAnalyzeStockHealth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ analyzed: number }>('/supply-chain/stock-health/analyze')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'stock-health'] }),
  })
}

// ─── Workflow Hooks ───────────────────────────────────────────────────────────

export function useWorkflowTemplates(params: { is_active?: boolean; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain-ops', 'workflow-templates', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; templates: WorkflowTemplateItem[] }>('/supply-chain/workflows/templates', { params })
      return data
    },
  })
}

export function useCreateWorkflowTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; trigger_event: string; steps?: Record<string, unknown> }) => {
      const { data } = await apiClient.post('/supply-chain/workflows/templates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'workflow-templates'] }),
  })
}

export function useUpdateWorkflowTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; description?: string; trigger_event?: string; steps?: Record<string, unknown>; is_active?: boolean }) => {
      const { data } = await apiClient.put(`/supply-chain/workflows/templates/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'workflow-templates'] }),
  })
}

export function useDeleteWorkflowTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/supply-chain/workflows/templates/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'workflow-templates'] }),
  })
}

export function useWorkflowRuns(params: { template_id?: string; status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain-ops', 'workflow-runs', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; runs: WorkflowRunItem[] }>('/supply-chain/workflows/runs', { params })
      return data
    },
  })
}

export function useWorkflowRun(runId: string) {
  return useQuery({
    queryKey: ['supplychain-ops', 'workflow-runs', runId],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkflowRunItem & { steps: WorkflowStepItem[] }>(`/supply-chain/workflows/runs/${runId}`)
      return data
    },
    enabled: !!runId,
  })
}

export function useTriggerWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await apiClient.post(`/supply-chain/workflows/trigger?template_id=${templateId}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'workflow-runs'] }),
  })
}

export function useCancelWorkflowRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data } = await apiClient.post(`/supply-chain/workflows/runs/${runId}/cancel`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'workflow-runs'] }),
  })
}

// ─── Compliance Hooks ─────────────────────────────────────────────────────────

export function useCompliance(params: { entity_type?: string; compliance_type?: string; status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain-ops', 'compliance', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; records: ComplianceRecordItem[] }>('/supply-chain/compliance', { params })
      return data
    },
  })
}

export function useCreateCompliance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { entity_type: string; entity_id: string; compliance_type: string; status?: string; details?: Record<string, unknown>; expiry_date?: string }) => {
      const { data } = await apiClient.post('/supply-chain/compliance', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'compliance'] }),
  })
}

export function useUpdateCompliance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; status?: string; details?: Record<string, unknown>; expiry_date?: string }) => {
      const { data } = await apiClient.put(`/supply-chain/compliance/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'compliance'] }),
  })
}

// ─── ESG Metrics Hooks ────────────────────────────────────────────────────────

export function useESGMetrics(params: { supplier_id?: string; metric_type?: string; period?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain-ops', 'esg-metrics', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; metrics: ESGMetricItem[] }>('/supply-chain/esg-metrics', { params })
      return data
    },
  })
}

export function useCreateESGMetric() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { supplier_id?: string; metric_type: string; period: string; value: number; unit: string; benchmark?: number; source?: string }) => {
      const { data } = await apiClient.post('/supply-chain/esg-metrics', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain-ops', 'esg-metrics'] }),
  })
}

export function useESGSummary(params: { period?: string } = {}) {
  return useQuery({
    queryKey: ['supplychain-ops', 'esg-summary', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ summary: { metric_type: string; avg_value: number; count: number }[] }>('/supply-chain/esg-metrics/summary', { params })
      return data
    },
  })
}

// ─── Analytics Hooks ──────────────────────────────────────────────────────────

export function useCostToServe() {
  return useQuery({
    queryKey: ['supplychain-ops', 'analytics', 'cost-to-serve'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total_units_received: number; note: string }>('/supply-chain/analytics/cost-to-serve')
      return data
    },
  })
}

export function useCarbonFootprint() {
  return useQuery({
    queryKey: ['supplychain-ops', 'analytics', 'carbon-footprint'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total_carbon: number; avg_carbon_per_supplier: number }>('/supply-chain/analytics/carbon-footprint')
      return data
    },
  })
}

export function useRiskHeatmap() {
  return useQuery({
    queryKey: ['supplychain-ops', 'analytics', 'risk-heatmap'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ heatmap: { risk_type: string; severity: string; count: number }[] }>('/supply-chain/analytics/risk-heatmap')
      return data
    },
  })
}

export function useAISummary() {
  return useQuery({
    queryKey: ['supplychain-ops', 'analytics', 'ai-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ summary: string; note: string }>('/supply-chain/analytics/ai-summary')
      return data
    },
  })
}
