/**
 * CRM Workflows API client — visual automation workflows with trigger-based
 * execution, branching logic, and execution history.
 *
 * Exports TanStack Query hooks and Axios helper functions for the CRM workflow
 * automation module. All requests go through `client.ts` (Axios instance with
 * auth interceptors). Backend prefix: `/api/v1/crm`.
 *
 * Key exports:
 *   - useWorkflows() / useWorkflow() — list and retrieve automation workflows
 *   - useCreateWorkflow() / useUpdateWorkflow() / useDeleteWorkflow() — workflow CRUD
 *   - useActivateWorkflow() / useDeactivateWorkflow() — toggle workflow status
 *   - useWorkflowExecutions() / useWorkflowExecution() — execution history and step logs
 *   - useWorkflowTemplates() / useCreateFromTemplate() — pre-built workflow templates
 *   - useWorkflowStats() — aggregate counts and monthly execution totals
 *
 * Note: workflow nodes are stored as a JSON graph. Executions are logged
 * step-by-step and can be inspected for debugging failed runs.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Workflow Types ───────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string
  workflow_id: string
  node_type: string
  position_x: number
  position_y: number
  config: Record<string, any> | null
  next_node_id: string | null
  true_branch_node_id: string | null
  false_branch_node_id: string | null
  created_at: string
}

export interface Workflow {
  id: string
  name: string
  description: string | null
  trigger_type: string
  trigger_config: Record<string, any> | null
  status: string
  execution_count: number
  last_executed_at: string | null
  owner_id: string
  nodes?: WorkflowNode[]
  created_at: string
  updated_at: string
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  trigger_data: Record<string, any> | null
  status: string
  started_at: string
  completed_at: string | null
  error_message: string | null
  steps_log: Record<string, any>[] | null
  created_at: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  workflow_json: Record<string, any> | null
  is_system: boolean
  created_at: string
}

export interface WorkflowCreatePayload {
  name: string
  description?: string | null
  trigger_type: string
  trigger_config?: Record<string, any> | null
}

export interface NodeCreatePayload {
  node_type: string
  position_x: number
  position_y: number
  config?: Record<string, any> | null
  next_node_id?: string | null
  true_branch_node_id?: string | null
  false_branch_node_id?: string | null
}

// ─── Report & Dashboard Types ─────────────────────────────────────────────────

export interface SavedReport {
  id: string
  name: string
  report_type: string
  config: Record<string, any> | null
  is_favorite: boolean
  is_shared: boolean
  owner_id: string
  created_at: string
  updated_at: string
}

export interface DashboardWidget {
  id: string
  dashboard_id: string | null
  widget_type: string
  title: string
  config: Record<string, any> | null
  position_x: number
  position_y: number
  width: number
  height: number
  owner_id: string
  created_at: string
  updated_at: string
}

export interface GamificationScore {
  id: string
  user_id: string
  period: string
  period_start: string
  score: number
  deals_closed: number
  deals_value: number
  activities_completed: number
  leads_converted: number
}

export interface SavedReportCreatePayload {
  name: string
  report_type: string
  config?: Record<string, any> | null
  is_favorite?: boolean
  is_shared?: boolean
}

export interface DashboardWidgetCreatePayload {
  dashboard_id?: string | null
  widget_type: string
  title: string
  config?: Record<string, any> | null
  position_x: number
  position_y: number
  width: number
  height: number
}

// ─── Workflows ────────────────────────────────────────────────────────────────

export function useWorkflows(params?: { status?: string; trigger_type?: string; page?: number }) {
  return useQuery({
    queryKey: ['crm', 'workflows', params],
    queryFn: () => apiClient.get('/crm/workflows', { params }).then(r => r.data),
  })
}

export function useCreateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WorkflowCreatePayload) =>
      apiClient.post('/crm/workflows', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflows'] }),
  })
}

export function useWorkflow(workflowId: string) {
  return useQuery<Workflow>({
    queryKey: ['crm', 'workflow', workflowId],
    queryFn: () => apiClient.get(`/crm/workflows/${workflowId}`).then(r => r.data),
    enabled: !!workflowId,
  })
}

export function useUpdateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<WorkflowCreatePayload>) =>
      apiClient.put(`/crm/workflows/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflows'] }),
  })
}

export function useDeleteWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/workflows/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflows'] }),
  })
}

// ─── Workflow Nodes ───────────────────────────────────────────────────────────

export function useAddNode(workflowId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: NodeCreatePayload) =>
      apiClient.post(`/crm/workflows/${workflowId}/nodes`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflow', workflowId] }),
  })
}

export function useUpdateNode(workflowId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, ...data }: { nodeId: string } & Partial<NodeCreatePayload>) =>
      apiClient.put(`/crm/workflows/${workflowId}/nodes/${nodeId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflow', workflowId] }),
  })
}

export function useDeleteNode(workflowId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) => apiClient.delete(`/crm/workflows/${workflowId}/nodes/${nodeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflow', workflowId] }),
  })
}

// ─── Workflow Actions ─────────────────────────────────────────────────────────

export function useActivateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/crm/workflows/${id}/activate`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflows'] }),
  })
}

export function usePauseWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/crm/workflows/${id}/pause`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflows'] }),
  })
}

export function useTestWorkflow() {
  return useMutation({
    mutationFn: ({ id, testData }: { id: string; testData?: Record<string, any> }) =>
      apiClient.post(`/crm/workflows/${id}/test`, { trigger_data: testData }).then(r => r.data),
  })
}

export function useWorkflowExecutions(workflowId: string, params?: { status?: string; page?: number }) {
  return useQuery({
    queryKey: ['crm', 'workflow-executions', workflowId, params],
    queryFn: () => apiClient.get(`/crm/workflows/${workflowId}/executions`, { params }).then(r => r.data),
    enabled: !!workflowId,
  })
}

// ─── Workflow Templates ───────────────────────────────────────────────────────

export function useWorkflowTemplates(params?: { category?: string }) {
  return useQuery({
    queryKey: ['crm', 'workflow-templates', params],
    queryFn: () => apiClient.get('/crm/workflows/templates', { params }).then(r => r.data),
  })
}

export function useCloneTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (templateId: string) =>
      apiClient.post(`/crm/workflows/templates/${templateId}/clone`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflows'] }),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useFunnelReport(params?: { pipeline_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['crm', 'reports', 'funnel', params],
    queryFn: () => apiClient.get('/crm/reports/funnel', { params }).then(r => r.data),
  })
}

export function useCohortReport(params?: { cohort_type?: string; period?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['crm', 'reports', 'cohort', params],
    queryFn: () => apiClient.get('/crm/reports/cohort', { params }).then(r => r.data),
  })
}

export function useLeaderboard(params?: { period?: string; period_start?: string }) {
  return useQuery({
    queryKey: ['crm', 'reports', 'leaderboard', params],
    queryFn: () => apiClient.get('/crm/reports/leaderboard', { params }).then(r => r.data),
  })
}

export function useComputeScores() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params?: { period?: string; period_start?: string }) =>
      apiClient.post('/crm/reports/gamification/compute', params).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'reports'] }),
  })
}

export function useSavedReports(params?: { report_type?: string; page?: number }) {
  return useQuery({
    queryKey: ['crm', 'reports', 'saved', params],
    queryFn: () => apiClient.get('/crm/reports/saved', { params }).then(r => r.data),
  })
}

export function useCreateSavedReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SavedReportCreatePayload) =>
      apiClient.post('/crm/reports/saved', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'reports', 'saved'] }),
  })
}

export function useUpdateSavedReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<SavedReportCreatePayload>) =>
      apiClient.put(`/crm/reports/saved/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'reports', 'saved'] }),
  })
}

export function useDeleteSavedReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/reports/saved/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'reports', 'saved'] }),
  })
}

// ─── Dashboard Widgets ────────────────────────────────────────────────────────

export function useDashboardWidgets(params?: { dashboard_id?: string }) {
  return useQuery({
    queryKey: ['crm', 'dashboard', 'widgets', params],
    queryFn: () => apiClient.get('/crm/dashboard/widgets', { params }).then(r => r.data),
  })
}

export function useCreateWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DashboardWidgetCreatePayload) =>
      apiClient.post('/crm/dashboard/widgets', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'dashboard', 'widgets'] }),
  })
}

export function useUpdateWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<DashboardWidgetCreatePayload>) =>
      apiClient.put(`/crm/dashboard/widgets/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'dashboard', 'widgets'] }),
  })
}

export function useDeleteWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/dashboard/widgets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'dashboard', 'widgets'] }),
  })
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export function useMyGamificationScore(params?: { period?: string; period_start?: string }) {
  return useQuery<GamificationScore>({
    queryKey: ['crm', 'gamification', 'me', params],
    queryFn: () => apiClient.get('/crm/reports/gamification/me', { params }).then(r => r.data),
  })
}
