/**
 * HR Phase 3 API client — HR workflow automation with trigger-based execution,
 * multi-step actions, approval gates, and execution history.
 *
 * Exports TanStack Query hooks and Axios helper functions for the HR Phase 3
 * workflow automation module. All requests go through `client.ts` (Axios
 * instance with auth interceptors). Backend prefix: `/api/v1/hr`.
 *
 * Key exports:
 *   - useHRWorkflows() / useHRWorkflow() — list and retrieve HR automation workflows
 *   - useCreateHRWorkflow() / useUpdateHRWorkflow() / useDeleteHRWorkflow() — workflow CRUD
 *   - useActivateHRWorkflow() / useDeactivateHRWorkflow() — enable/disable workflows
 *   - useHRWorkflowExecutions() / useHRWorkflowExecution() — execution logs per workflow
 *   - useHRWorkflowStats() — aggregate counts and monthly execution metrics
 *
 * Note: trigger types include employee_created, status_changed, date_based, and
 * goal_completed. Steps support notifications, field updates, approval gates, and delays.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowTriggerType =
  | 'employee_created'
  | 'status_changed'
  | 'date_based'
  | 'manual'
  | 'goal_completed'
  | 'review_submitted'

export type WorkflowStepType =
  | 'send_notification'
  | 'update_field'
  | 'create_task'
  | 'send_email'
  | 'require_approval'
  | 'delay'
  | 'condition'

export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'

export interface WorkflowStepConfig {
  // send_notification
  message?: string
  recipient_type?: 'employee' | 'manager' | 'hr_team'
  // create_task
  title?: string
  assigned_to?: string
  due_days?: number
  // send_email
  subject?: string
  recipient_field?: string
  template_id?: string
  // require_approval
  approver_type?: 'manager' | 'hr_admin' | 'specific_user'
  instructions?: string
  // delay
  days?: number
  description?: string
  // condition
  field?: string
  operator?: 'eq' | 'gt' | 'lt' | 'contains'
  value?: string
  true_next?: number
  false_next?: number
  // update_field
  field_name?: string
  field_value?: string
}

export interface WorkflowStep {
  id?: string
  step_order: number
  step_type: WorkflowStepType
  config: WorkflowStepConfig
  name?: string
}

export interface WorkflowTriggerConfig {
  // date_based
  days_after_hire?: number
  date_field?: string
  // status_changed
  from_status?: string
  to_status?: string
  // goal_completed
  goal_type?: string
}

export interface Workflow {
  id: string
  name: string
  description: string | null
  trigger_type: WorkflowTriggerType
  trigger_config: WorkflowTriggerConfig
  category: string | null
  is_active: boolean
  is_template: boolean
  run_count: number
  last_run_at: string | null
  steps: WorkflowStep[]
  created_at: string
  updated_at: string
}

export interface WorkflowCreatePayload {
  name: string
  description?: string
  trigger_type: WorkflowTriggerType
  trigger_config?: WorkflowTriggerConfig
  category?: string
  is_active?: boolean
  is_template?: boolean
  steps?: WorkflowStep[]
}

export interface WorkflowUpdatePayload extends Partial<WorkflowCreatePayload> {}

export interface WorkflowStats {
  total: number
  active: number
  paused: number
  executions_this_month: number
}

export interface ExecutionStepResult {
  step_id: string
  step_order: number
  step_type: WorkflowStepType
  step_name: string
  status: ExecutionStatus
  result?: Record<string, unknown>
  error?: string
  started_at: string | null
  completed_at: string | null
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  workflow_name: string
  status: ExecutionStatus
  triggered_by: string
  started_at: string
  completed_at: string | null
  steps_completed: ExecutionStepResult[]
  total_steps: number
  error_message: string | null
  context_data: Record<string, unknown> | null
}

export interface ExecutionStats {
  total: number
  running: number
  completed_today: number
  failed: number
}

export interface ApprovalStatus {
  pending: 'pending'
  approved: 'approved'
  rejected: 'rejected'
}

export interface WorkflowApproval {
  id: string
  execution_id: string
  workflow_id: string
  workflow_name: string
  step_id: string
  step_description: string
  approver_id: string
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  instructions: string | null
  triggered_by: string
  execution_started_at: string
  decided_at: string | null
  created_at: string
}

export interface ApprovalDecisionPayload {
  decision: 'approved' | 'rejected'
  note?: string
}

// ─── Workflow Queries ─────────────────────────────────────────────────────────

export function useWorkflows(params?: {
  is_active?: boolean
  is_template?: boolean
  category?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['hr-workflows', params],
    queryFn: async () => {
      const res = await apiClient.get<{ items: Workflow[]; total: number; stats: WorkflowStats }>(
        '/hr/workflows',
        { params }
      )
      return res.data
    },
  })
}

export function useWorkflow(id: string | undefined) {
  return useQuery({
    queryKey: ['hr-workflow', id],
    queryFn: async () => {
      const res = await apiClient.get<Workflow>(`/hr/workflows/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: WorkflowCreatePayload) => {
      const res = await apiClient.post<Workflow>('/hr/workflows', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workflows'] })
    },
  })
}

export function useUpdateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: WorkflowUpdatePayload & { id: string }) => {
      const res = await apiClient.put<Workflow>(`/hr/workflows/${id}`, payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workflows'] })
    },
  })
}

export function useToggleWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await apiClient.patch<Workflow>(`/hr/workflows/${id}/toggle`, { is_active })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workflows'] })
    },
  })
}

export function useTriggerWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, context }: { id: string; context?: Record<string, unknown> }) => {
      const res = await apiClient.post<WorkflowExecution>(`/hr/workflows/${id}/trigger`, { context })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workflow-executions'] })
    },
  })
}

export function useDeleteWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/workflows/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workflows'] })
    },
  })
}

export function useDuplicateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<Workflow>(`/hr/workflows/${id}/duplicate`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workflows'] })
    },
  })
}

// ─── Execution Queries ────────────────────────────────────────────────────────

export function useWorkflowExecutions(params?: {
  workflow_id?: string
  status?: ExecutionStatus
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['hr-workflow-executions', params],
    queryFn: async () => {
      const res = await apiClient.get<{
        items: WorkflowExecution[]
        total: number
        stats: ExecutionStats
      }>('/hr/workflows/executions', { params })
      return res.data
    },
  })
}

export function useWorkflowExecution(id: string | undefined) {
  return useQuery({
    queryKey: ['hr-workflow-execution', id],
    queryFn: async () => {
      const res = await apiClient.get<WorkflowExecution>(`/hr/workflows/executions/${id}`)
      return res.data
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.status === 'running' ? 3000 : false
    },
  })
}

export function useCancelExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<WorkflowExecution>(`/hr/workflows/executions/${id}/cancel`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workflow-executions'] })
      qc.invalidateQueries({ queryKey: ['hr-workflow-execution'] })
    },
  })
}

// ─── Approval Queries ─────────────────────────────────────────────────────────

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['hr-workflow-approvals', 'pending'],
    queryFn: async () => {
      const res = await apiClient.get<WorkflowApproval[]>('/hr/workflows/approvals/pending')
      return res.data
    },
    refetchInterval: 15000,
  })
}

export function useCompletedApprovals(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr-workflow-approvals', 'completed', params],
    queryFn: async () => {
      const res = await apiClient.get<{ items: WorkflowApproval[]; total: number }>(
        '/hr/workflows/approvals/completed',
        { params }
      )
      return res.data
    },
  })
}

export function useDecideApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: ApprovalDecisionPayload & { id: string }) => {
      const res = await apiClient.post<WorkflowApproval>(
        `/hr/workflows/approvals/${id}/decide`,
        payload
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workflow-approvals'] })
      qc.invalidateQueries({ queryKey: ['hr-workflow-executions'] })
    },
  })
}

// ─── Workflow Templates ────────────────────────────────────────────────────────

export function useWorkflowTemplates() {
  return useQuery({
    queryKey: ['hr-workflow-templates'],
    queryFn: async () => {
      const res = await apiClient.get<{ items: Workflow[]; total: number }>(
        '/hr/workflows/templates'
      )
      return res.data
    },
  })
}

export function useInstantiateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ templateId, name }: { templateId: string; name: string }) => {
      const res = await apiClient.post<Workflow>(
        `/hr/workflows/templates/${templateId}/instantiate`,
        { name }
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workflows'] })
    },
  })
}

export function useWorkflowTemplateLibrary() {
  return useQuery({
    queryKey: ['hr-workflow-template-library'],
    queryFn: async () => {
      const res = await apiClient.get('/hr/workflows/templates/library')
      return res.data
    },
  })
}

// ─── Workflow Analytics ────────────────────────────────────────────────────────

export interface WorkflowAnalyticsSummary {
  total_executions: number
  success_count: number
  success_rate: number
  avg_duration_seconds: number | null
  most_triggered: { workflow_id: string; name: string; count: number } | null
  pending_approvals_count: number
}

export function useWorkflowAnalytics() {
  return useQuery({
    queryKey: ['hr-workflow-analytics'],
    queryFn: async () => {
      const res = await apiClient.get<WorkflowAnalyticsSummary>(
        '/hr/workflows/analytics/summary'
      )
      return res.data
    },
  })
}

// ─── Skills Ontology ──────────────────────────────────────────────────────────

export interface SkillOntologyNode {
  id: string
  name: string
  category: string
  parent_id: string | null
  aliases: string[] | null
  description: string | null
  is_active: boolean
  children?: SkillOntologyNode[]
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface SkillOntologyParams {
  category?: string
  is_active?: boolean
  page?: number
  limit?: number
}

export function useSkillOntology(params?: SkillOntologyParams) {
  return useQuery({
    queryKey: ['hr-skills-ontology', params],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<SkillOntologyNode>>(
        '/hr/skills/ontology',
        { params }
      )
      return res.data
    },
  })
}

export function useSkillOntologyTree() {
  return useQuery({
    queryKey: ['hr-skills-ontology-tree'],
    queryFn: async () => {
      const res = await apiClient.get<SkillOntologyNode[]>('/hr/skills/ontology/tree')
      return res.data
    },
  })
}

export function useCreateSkillNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<SkillOntologyNode>) => {
      const res = await apiClient.post<SkillOntologyNode>('/hr/skills/ontology', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-skills-ontology'] })
    },
  })
}

export function useUpdateSkillNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<SkillOntologyNode> & { id: string }) => {
      const res = await apiClient.put<SkillOntologyNode>(`/hr/skills/ontology/${id}`, payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-skills-ontology'] })
    },
  })
}

export function useDeleteSkillNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/skills/ontology/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-skills-ontology'] })
    },
  })
}

// ─── Flight Risk ──────────────────────────────────────────────────────────────

export interface FlightRiskScore {
  id: string
  employee_id: string
  score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  factors: {
    tenure_risk: number
    satisfaction_risk: number
    compensation_risk: number
    promotion_risk: number
    workload_risk: number
  } | null
  recommendations: string[] | null
  summary?: string
  calculated_at: string
  created_at: string
}

export interface FlightRiskParams {
  risk_level?: string
  department_id?: string
  page?: number
  limit?: number
}

export function useCalculateFlightRisk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await apiClient.post<FlightRiskScore>(
        `/hr/ai/flight-risk/calculate/${employeeId}`
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-flight-risk'] })
    },
  })
}

export function useFlightRiskScores(params?: FlightRiskParams) {
  return useQuery({
    queryKey: ['hr-flight-risk', 'scores', params],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<FlightRiskScore>>(
        '/hr/ai/flight-risk',
        { params }
      )
      return res.data
    },
  })
}

export function useEmployeeFlightRisk(employeeId: string) {
  return useQuery({
    queryKey: ['hr-flight-risk', 'employee', employeeId],
    queryFn: async () => {
      const res = await apiClient.get<FlightRiskScore>(
        `/hr/ai/flight-risk/employee/${employeeId}`
      )
      return res.data
    },
    enabled: !!employeeId,
  })
}

export function useFlightRiskTeamSummary() {
  return useQuery({
    queryKey: ['hr-flight-risk', 'team-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/hr/ai/flight-risk/team-summary')
      return res.data
    },
  })
}

// ─── Burnout ──────────────────────────────────────────────────────────────────

export interface BurnoutIndicator {
  id: string
  employee_id: string
  risk_score: number
  risk_level: 'low' | 'moderate' | 'high' | 'severe'
  factors: Record<string, number> | null
  warning_signs: string[] | null
  recommendations: string[] | null
  immediate_action_required: boolean
  calculated_at: string
  created_at: string
}

export interface BurnoutParams {
  risk_level?: string
  department_id?: string
  page?: number
  limit?: number
}

export function useCalculateBurnout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await apiClient.post<BurnoutIndicator>(
        `/hr/ai/burnout/calculate/${employeeId}`
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-burnout'] })
    },
  })
}

export function useBurnoutIndicators(params?: BurnoutParams) {
  return useQuery({
    queryKey: ['hr-burnout', 'indicators', params],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<BurnoutIndicator>>(
        '/hr/ai/burnout',
        { params }
      )
      return res.data
    },
  })
}

export function useEmployeeBurnout(employeeId: string) {
  return useQuery({
    queryKey: ['hr-burnout', 'employee', employeeId],
    queryFn: async () => {
      const res = await apiClient.get<BurnoutIndicator>(
        `/hr/ai/burnout/employee/${employeeId}`
      )
      return res.data
    },
    enabled: !!employeeId,
  })
}

// ─── HR Chatbot ───────────────────────────────────────────────────────────────

export interface HRChatbotPayload {
  query: string
  context?: Record<string, unknown>
  session_id?: string
}

export interface HRChatbotResponse {
  answer: string
  sources?: string[]
  session_id: string
  suggested_actions?: string[]
}

export function useHRChatbot() {
  return useMutation({
    mutationFn: async (payload: HRChatbotPayload) => {
      const res = await apiClient.post<HRChatbotResponse>('/hr/ai/hr-chatbot/query', payload)
      return res.data
    },
  })
}

// ─── Workforce Planning ───────────────────────────────────────────────────────

export interface WorkforcePlanningScenario {
  id: string
  name: string
  fiscal_year: number
  base_headcount: number
  base_budget: number | null
  scenarios: Array<{
    name: string
    growth_rate: number
    attrition_rate: number
    new_hires: number
    projected_cost?: number
  }> | null
  created_at: string
}

export function useWorkforceScenarios() {
  return useQuery({
    queryKey: ['hr-workforce-scenarios'],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<WorkforcePlanningScenario>>(
        '/hr/analytics/workforce-planning/scenarios'
      )
      return res.data
    },
  })
}

export function useWorkforceScenario(id: string) {
  return useQuery({
    queryKey: ['hr-workforce-scenario', id],
    queryFn: async () => {
      const res = await apiClient.get<WorkforcePlanningScenario>(
        `/hr/analytics/workforce-planning/scenarios/${id}`
      )
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateWorkforceScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<WorkforcePlanningScenario>) => {
      const res = await apiClient.post<WorkforcePlanningScenario>(
        '/hr/analytics/workforce-planning/scenarios',
        payload
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workforce-scenarios'] })
    },
  })
}

export function useUpdateWorkforceScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<WorkforcePlanningScenario> & { id: string }) => {
      const res = await apiClient.put<WorkforcePlanningScenario>(
        `/hr/analytics/workforce-planning/scenarios/${id}`,
        payload
      )
      return res.data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr-workforce-scenarios'] })
      qc.invalidateQueries({ queryKey: ['hr-workforce-scenario', variables.id] })
    },
  })
}

// ─── People Analytics Dashboards ─────────────────────────────────────────────

export interface AnalyticsDashboard {
  id: string
  name: string
  description: string | null
  owner_id: string
  is_shared: boolean
  layout: Array<{
    id: string
    type: string
    title: string
    config: Record<string, unknown>
    position: { x: number; y: number; w: number; h: number }
  }> | null
  widget_count: number
  created_at: string
}

export function useAnalyticsDashboards() {
  return useQuery({
    queryKey: ['hr-analytics-dashboards'],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<AnalyticsDashboard>>(
        '/hr/analytics/dashboards'
      )
      return res.data
    },
  })
}

export function useAnalyticsDashboard(id: string) {
  return useQuery({
    queryKey: ['hr-analytics-dashboard', id],
    queryFn: async () => {
      const res = await apiClient.get<AnalyticsDashboard>(`/hr/analytics/dashboards/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<AnalyticsDashboard>) => {
      const res = await apiClient.post<AnalyticsDashboard>('/hr/analytics/dashboards', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-analytics-dashboards'] })
    },
  })
}

export function useUpdateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<AnalyticsDashboard> & { id: string }) => {
      const res = await apiClient.put<AnalyticsDashboard>(
        `/hr/analytics/dashboards/${id}`,
        payload
      )
      return res.data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr-analytics-dashboards'] })
      qc.invalidateQueries({ queryKey: ['hr-analytics-dashboard', variables.id] })
    },
  })
}

export function useDeleteDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/analytics/dashboards/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-analytics-dashboards'] })
    },
  })
}

export function useAddWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      dashboardId,
      widget,
    }: {
      dashboardId: string
      widget: Record<string, unknown>
    }) => {
      const res = await apiClient.post(
        `/hr/analytics/dashboards/${dashboardId}/widgets`,
        widget
      )
      return res.data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr-analytics-dashboard', variables.dashboardId] })
    },
  })
}

export function useRemoveWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dashboardId, widgetId }: { dashboardId: string; widgetId: string }) => {
      await apiClient.delete(`/hr/analytics/dashboards/${dashboardId}/widgets/${widgetId}`)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr-analytics-dashboard', variables.dashboardId] })
    },
  })
}

// ─── People Analytics — Metrics ───────────────────────────────────────────────

export interface DEIOverview {
  total_employees: number
  gender_distribution: { male: number; female: number; other: number; not_specified: number }
  department_breakdown: Array<{
    department: string
    headcount: number
    gender_split: Record<string, number>
  }>
  leadership_diversity: { manager_gender_split: Record<string, number> }
}

export interface HeadcountCost {
  department: string
  headcount: number
  total_salary_budget: number
  avg_salary: number
  benefit_cost_est: number
}

export function useDEIOverview() {
  return useQuery({
    queryKey: ['hr-analytics-dei'],
    queryFn: async () => {
      const res = await apiClient.get<DEIOverview>('/hr/analytics/dei/overview')
      return res.data
    },
  })
}

export function useAttritionRisk() {
  return useQuery({
    queryKey: ['hr-analytics-attrition-risk'],
    queryFn: async () => {
      const res = await apiClient.get('/hr/analytics/attrition-risk')
      return res.data
    },
  })
}

export function useHiringDemand() {
  return useQuery({
    queryKey: ['hr-analytics-hiring-demand'],
    queryFn: async () => {
      const res = await apiClient.get('/hr/analytics/hiring-demand')
      return res.data
    },
  })
}

export function useHeadcountCost() {
  return useQuery({
    queryKey: ['hr-analytics-headcount-cost'],
    queryFn: async () => {
      const res = await apiClient.get<HeadcountCost[]>('/hr/analytics/headcount-cost')
      return res.data
    },
  })
}

export function useCompensationAnalysis() {
  return useQuery({
    queryKey: ['hr-analytics-compensation'],
    queryFn: async () => {
      const res = await apiClient.get('/hr/analytics/compensation-analysis')
      return res.data
    },
  })
}

export interface CostScenarioPayload {
  base_headcount: number
  growth_rate: number
  attrition_rate: number
  avg_salary: number
  benefit_rate?: number
  fiscal_year?: number
}

export function useCostScenarioModel() {
  return useMutation({
    mutationFn: async (payload: CostScenarioPayload) => {
      const res = await apiClient.post('/hr/analytics/cost-scenario', payload)
      return res.data
    },
  })
}

// Bulk recalculate all flight risk scores
export function useRecalculateFlightRisk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/hr/ai/flight-risk/recalculate-all')
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-flight-risk'] })
    },
  })
}
