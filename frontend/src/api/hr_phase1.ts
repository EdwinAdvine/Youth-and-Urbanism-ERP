import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

// Skills
export interface EmployeeSkill {
  id: string
  employee_id: string
  skill_name: string
  category: string
  proficiency_level: number
  years_experience: number | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface SkillCreatePayload {
  skill_name: string
  category: string
  proficiency_level: number
  years_experience?: number
}

export interface SkillUpdatePayload {
  skill_name?: string
  category?: string
  proficiency_level?: number
  years_experience?: number
}

export interface SkillsMatrixEntry {
  skill_name: string
  category: string
  employee_count: number
  avg_proficiency: number
}

export interface SkillGapEntry {
  skill_name: string
  current_avg: number
  needed_level: number
  gap: number
  employees_with_skill: number
}

// Succession Plans
export interface SuccessionPlan {
  id: string
  position_title: string
  department_id: string
  department_name?: string
  current_holder_id: string | null
  successor_id: string
  readiness: string
  priority: string
  development_notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface SuccessionPlanCreatePayload {
  position_title: string
  department_id: string
  current_holder_id?: string
  successor_id: string
  readiness: string
  priority: string
  development_notes?: string
}

export interface SuccessionPlanUpdatePayload {
  position_title?: string
  successor_id?: string
  readiness?: string
  priority?: string
  development_notes?: string
}

// Activity Timeline
export interface ActivityLogEntry {
  id: string
  employee_id: string
  activity_type: string
  title: string
  description: string | null
  source_module: string
  source_id: string | null
  metadata_json: Record<string, unknown> | null
  occurred_at: string
  created_at: string
}

// Document Versions
export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  file_id: string
  file_name: string
  file_size: number | null
  change_notes: string | null
  uploaded_by: string
  created_at: string
}

export interface DocumentVersionCreatePayload {
  file_id: string
  file_name: string
  file_size?: number
  change_notes?: string
}

// Compensation Bands
export interface CompensationBand {
  id: string
  job_level: string
  job_family: string
  currency: string
  min_salary: number
  mid_salary: number
  max_salary: number
  country_code: string
  effective_from: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CompensationBandCreatePayload {
  job_level: string
  job_family: string
  currency?: string
  min_salary: number
  mid_salary: number
  max_salary: number
  country_code?: string
  effective_from: string
}

export interface CompensationBandUpdatePayload {
  job_level?: string
  job_family?: string
  min_salary?: number
  mid_salary?: number
  max_salary?: number
  is_active?: boolean
}

// Merit Budget Pools
export interface MeritBudgetPool {
  id: string
  name: string
  department_id: string | null
  fiscal_year: number
  total_budget: number
  allocated_amount: number
  currency: string
  status: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface MeritBudgetPoolCreatePayload {
  name: string
  department_id?: string
  fiscal_year: number
  total_budget: number
  currency?: string
}

// Merit Increases
export interface MeritIncrease {
  id: string
  employee_id: string
  review_id: string | null
  current_salary: number
  proposed_salary: number
  increase_percentage: number
  increase_type: string
  effective_date: string
  budget_pool_id: string | null
  status: string
  approved_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MeritIncreaseCreatePayload {
  employee_id: string
  review_id?: string
  current_salary: number
  proposed_salary: number
  increase_type: string
  effective_date: string
  budget_pool_id?: string
  notes?: string
}

// Bonuses
export interface Bonus {
  id: string
  employee_id: string
  bonus_type: string
  amount: number
  currency: string
  reason: string | null
  review_id: string | null
  pay_period: string | null
  status: string
  approved_by: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface BonusCreatePayload {
  employee_id: string
  bonus_type: string
  amount: number
  currency?: string
  reason?: string
  review_id?: string
  pay_period?: string
}

// Equity Grants
export interface EquityGrant {
  id: string
  employee_id: string
  grant_type: string
  shares: number
  strike_price: number | null
  grant_date: string
  vesting_start: string
  vesting_schedule: Record<string, unknown> | null
  vested_shares: number
  exercised_shares: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EquityGrantCreatePayload {
  employee_id: string
  grant_type: string
  shares: number
  strike_price?: number
  grant_date: string
  vesting_start: string
  vesting_schedule?: Record<string, unknown>
  notes?: string
}

export interface EquityGrantUpdatePayload {
  shares?: number
  strike_price?: number
  vesting_schedule?: Record<string, unknown>
  notes?: string
  status?: string
}

export interface VestingEvent {
  date: string
  shares_vesting: number
  cumulative_vested: number
  percentage_vested: number
}

// Shift Templates
export interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  break_duration_minutes: number
  is_overnight: boolean
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ShiftTemplateCreatePayload {
  name: string
  start_time: string
  end_time: string
  break_duration_minutes?: number
  is_overnight?: boolean
  color?: string
}

// Shift Assignments
export interface ShiftAssignment {
  id: string
  employee_id: string
  shift_template_id: string
  assignment_date: string
  actual_start: string | null
  actual_end: string | null
  status: string
  swap_with_id: string | null
  notes: string | null
  shift_template?: ShiftTemplate
  created_at: string
  updated_at: string
}

export interface ShiftAssignmentCreatePayload {
  employee_id: string
  shift_template_id: string
  assignment_date: string
  notes?: string
}

export interface BulkShiftAssignmentPayload {
  employee_ids: string[]
  shift_template_id: string
  start_date: string
  end_date: string
  rotation_days?: number
}

// Holiday Calendar
export interface Holiday {
  id: string
  name: string
  country_code: string
  holiday_date: string
  is_recurring: boolean
  is_half_day: boolean
  created_at: string
  updated_at: string
}

export interface HolidayCreatePayload {
  name: string
  country_code: string
  holiday_date: string
  is_recurring?: boolean
  is_half_day?: boolean
}

// Goals / OKR
export interface Goal {
  id: string
  title: string
  description: string | null
  goal_type: string
  owner_type: string
  owner_id: string
  parent_id: string | null
  metric_type: string
  target_value: number | null
  current_value: number
  start_date: string
  due_date: string
  status: string
  weight: number
  review_period: string | null
  created_at: string
  updated_at: string
  children?: Goal[]
}

export interface GoalCreatePayload {
  title: string
  description?: string
  goal_type: string
  owner_type: string
  owner_id: string
  parent_id?: string
  metric_type?: string
  target_value?: number
  start_date: string
  due_date: string
  weight?: number
  review_period?: string
}

export interface GoalUpdatePayload {
  title?: string
  description?: string
  target_value?: number
  current_value?: number
  due_date?: string
  status?: string
  weight?: number
}

export interface GoalProgressUpdate {
  new_value: number
  comment?: string
}

export interface GoalUpdate {
  id: string
  goal_id: string
  previous_value: number
  new_value: number
  comment: string | null
  updated_by: string
  created_at: string
}

// Continuous Feedback
export interface ContinuousFeedback {
  id: string
  from_employee_id: string
  to_employee_id: string
  feedback_type: string
  content: string
  is_anonymous: boolean
  visibility: string
  related_goal_id: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackCreatePayload {
  to_employee_id: string
  feedback_type: string
  content: string
  is_anonymous?: boolean
  visibility?: string
  related_goal_id?: string
}

export interface FeedbackSummary {
  total_received: number
  praise_count: number
  improvement_count: number
  general_count: number
  recent: ContinuousFeedback[]
}

// Review Cycles
export interface ReviewCycle {
  id: string
  name: string
  cycle_type: string
  start_date: string
  end_date: string
  self_review_deadline: string | null
  peer_review_deadline: string | null
  manager_review_deadline: string | null
  status: string
  department_ids: string[] | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ReviewCycleCreatePayload {
  name: string
  cycle_type: string
  start_date: string
  end_date: string
  self_review_deadline?: string
  peer_review_deadline?: string
  manager_review_deadline?: string
  department_ids?: string[]
}

export interface ReviewCycleUpdatePayload {
  name?: string
  start_date?: string
  end_date?: string
  self_review_deadline?: string
  peer_review_deadline?: string
  manager_review_deadline?: string
  department_ids?: string[]
}

// Review Assignments
export interface ReviewAssignment {
  id: string
  cycle_id: string
  reviewee_id: string
  reviewer_id: string
  review_type: string
  rating: number | null
  comments: string | null
  strengths: string | null
  improvements: string | null
  status: string
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewSubmitPayload {
  rating: number
  comments?: string
  strengths?: string
  improvements?: string
}

// Audit
export interface AuditFieldChange {
  id: string
  table_name: string
  record_id: string
  field_name: string
  old_value: string | null
  new_value: string | null
  changed_by: string
  change_reason: string | null
  ip_address: string | null
  created_at: string
}

// Manager Dashboard
export interface TeamMember {
  id: string
  employee_number: string
  job_title: string | null
  employment_type: string
  hire_date: string
  is_active: boolean
  department_name?: string
}

export interface DelegationCreatePayload {
  delegate_to_id: string
  scope: string
  start_date: string
  end_date: string
  notes?: string
}

export interface Delegation {
  id: string
  delegate_to_id: string
  scope: string
  start_date: string
  end_date: string
  notes: string | null
  created_at: string
}

// Overtime Alert
export interface OvertimeAlert {
  employee_id: string
  employee_number: string
  total_hours: number
  threshold: number
  excess_hours: number
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ─── Skills API ───────────────────────────────────────────────────────────────

export function useEmployeeSkills(employeeId: string) {
  return useQuery({
    queryKey: ['hr', 'skills', employeeId],
    queryFn: () => apiClient.get(`/hr/employees/${employeeId}/skills`).then(r => r.data),
    enabled: !!employeeId,
  })
}

export function useAddEmployeeSkill(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SkillCreatePayload) =>
      apiClient.post(`/hr/employees/${employeeId}/skills`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'skills', employeeId] }),
  })
}

export function useUpdateEmployeeSkill(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ skillId, data }: { skillId: string; data: SkillUpdatePayload }) =>
      apiClient.put(`/hr/employees/${employeeId}/skills/${skillId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'skills', employeeId] }),
  })
}

export function useDeleteEmployeeSkill(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (skillId: string) =>
      apiClient.delete(`/hr/employees/${employeeId}/skills/${skillId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'skills', employeeId] }),
  })
}

export function useSkillsMatrix(params?: { department_id?: string; category?: string; skill_name?: string }) {
  return useQuery({
    queryKey: ['hr', 'skills', 'matrix', params],
    queryFn: () => apiClient.get('/hr/skills/matrix', { params }).then(r => r.data),
  })
}

export function useSkillGapAnalysis(departmentId: string) {
  return useQuery({
    queryKey: ['hr', 'skills', 'gap-analysis', departmentId],
    queryFn: () => apiClient.get(`/hr/skills/gap-analysis/${departmentId}`).then(r => r.data),
    enabled: !!departmentId,
  })
}

// ─── Succession Plans API ─────────────────────────────────────────────────────

export function useSuccessionPlans(params?: { department_id?: string; priority?: string; readiness?: string }) {
  return useQuery({
    queryKey: ['hr', 'succession-plans', params],
    queryFn: () => apiClient.get('/hr/succession-plans', { params }).then(r => r.data),
  })
}

export function useCreateSuccessionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SuccessionPlanCreatePayload) =>
      apiClient.post('/hr/succession-plans', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'succession-plans'] }),
  })
}

export function useUpdateSuccessionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: SuccessionPlanUpdatePayload }) =>
      apiClient.put(`/hr/succession-plans/${planId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'succession-plans'] }),
  })
}

export function useDeleteSuccessionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) =>
      apiClient.delete(`/hr/succession-plans/${planId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'succession-plans'] }),
  })
}

// ─── Employee Timeline API ────────────────────────────────────────────────────

export function useEmployeeTimeline(employeeId: string, params?: { activity_type?: string; source_module?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr', 'timeline', employeeId, params],
    queryFn: () => apiClient.get(`/hr/employees/${employeeId}/timeline`, { params }).then(r => r.data),
    enabled: !!employeeId,
  })
}

// ─── Document Versions API ────────────────────────────────────────────────────

export function useDocumentVersions(employeeId: string, docId: string) {
  return useQuery({
    queryKey: ['hr', 'doc-versions', employeeId, docId],
    queryFn: () => apiClient.get(`/hr/employees/${employeeId}/documents/${docId}/versions`).then(r => r.data),
    enabled: !!employeeId && !!docId,
  })
}

export function useCreateDocumentVersion(employeeId: string, docId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DocumentVersionCreatePayload) =>
      apiClient.post(`/hr/employees/${employeeId}/documents/${docId}/versions`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'doc-versions', employeeId, docId] }),
  })
}

// ─── Compensation Bands API ───────────────────────────────────────────────────

export function useCompensationBands(params?: { job_level?: string; job_family?: string; country_code?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: ['hr', 'compensation-bands', params],
    queryFn: () => apiClient.get('/hr/compensation/bands', { params }).then(r => r.data),
  })
}

export function useCreateCompensationBand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CompensationBandCreatePayload) =>
      apiClient.post('/hr/compensation/bands', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'compensation-bands'] }),
  })
}

export function useUpdateCompensationBand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bandId, data }: { bandId: string; data: CompensationBandUpdatePayload }) =>
      apiClient.put(`/hr/compensation/bands/${bandId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'compensation-bands'] }),
  })
}

export function useDeleteCompensationBand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bandId: string) =>
      apiClient.delete(`/hr/compensation/bands/${bandId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'compensation-bands'] }),
  })
}

export function useCompensationBandAnalysis() {
  return useQuery({
    queryKey: ['hr', 'compensation-bands', 'analysis'],
    queryFn: () => apiClient.get('/hr/compensation/bands/analysis').then(r => r.data),
  })
}

// ─── Merit Budget Pools API ───────────────────────────────────────────────────

export function useMeritBudgetPools(params?: { fiscal_year?: number; department_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['hr', 'merit-pools', params],
    queryFn: () => apiClient.get('/hr/merit/budget-pools', { params }).then(r => r.data),
  })
}

export function useCreateMeritBudgetPool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MeritBudgetPoolCreatePayload) =>
      apiClient.post('/hr/merit/budget-pools', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'merit-pools'] }),
  })
}

export function useUpdateMeritBudgetPool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ poolId, data }: { poolId: string; data: Partial<MeritBudgetPoolCreatePayload> }) =>
      apiClient.put(`/hr/merit/budget-pools/${poolId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'merit-pools'] }),
  })
}

// ─── Merit Increases API ──────────────────────────────────────────────────────

export function useMeritIncreases(params?: { employee_id?: string; status?: string; increase_type?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr', 'merit-increases', params],
    queryFn: () => apiClient.get('/hr/merit/increases', { params }).then(r => r.data),
  })
}

export function useCreateMeritIncrease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MeritIncreaseCreatePayload) =>
      apiClient.post('/hr/merit/increases', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'merit-increases'] }),
  })
}

export function useApproveMeritIncrease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (increaseId: string) =>
      apiClient.put(`/hr/merit/increases/${increaseId}/approve`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'merit-increases'] })
      qc.invalidateQueries({ queryKey: ['hr', 'merit-pools'] })
    },
  })
}

export function useRejectMeritIncrease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (increaseId: string) =>
      apiClient.put(`/hr/merit/increases/${increaseId}/reject`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'merit-increases'] }),
  })
}

export function useApplyMeritIncrease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (increaseId: string) =>
      apiClient.put(`/hr/merit/increases/${increaseId}/apply`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'merit-increases'] })
      qc.invalidateQueries({ queryKey: ['hr', 'employees'] })
    },
  })
}

// ─── Bonuses API ──────────────────────────────────────────────────────────────

export function useBonuses(params?: { employee_id?: string; bonus_type?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr', 'bonuses', params],
    queryFn: () => apiClient.get('/hr/bonuses', { params }).then(r => r.data),
  })
}

export function useCreateBonus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BonusCreatePayload) =>
      apiClient.post('/hr/bonuses', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'bonuses'] }),
  })
}

export function useApproveBonus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bonusId: string) =>
      apiClient.put(`/hr/bonuses/${bonusId}/approve`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'bonuses'] }),
  })
}

export function usePayBonus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bonusId: string) =>
      apiClient.put(`/hr/bonuses/${bonusId}/pay`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'bonuses'] }),
  })
}

// ─── Equity Grants API ────────────────────────────────────────────────────────

export function useEquityGrants(params?: { employee_id?: string; grant_type?: string; status?: string }) {
  return useQuery({
    queryKey: ['hr', 'equity-grants', params],
    queryFn: () => apiClient.get('/hr/equity-grants', { params }).then(r => r.data),
  })
}

export function useCreateEquityGrant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EquityGrantCreatePayload) =>
      apiClient.post('/hr/equity-grants', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'equity-grants'] }),
  })
}

export function useUpdateEquityGrant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ grantId, data }: { grantId: string; data: EquityGrantUpdatePayload }) =>
      apiClient.put(`/hr/equity-grants/${grantId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'equity-grants'] }),
  })
}

export function useVestingSchedule(grantId: string) {
  return useQuery({
    queryKey: ['hr', 'equity-grants', grantId, 'vesting'],
    queryFn: () => apiClient.get(`/hr/equity-grants/${grantId}/vesting-schedule`).then(r => r.data),
    enabled: !!grantId,
  })
}

export function useVestEquityGrant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (grantId: string) =>
      apiClient.put(`/hr/equity-grants/${grantId}/vest`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'equity-grants'] }),
  })
}

// ─── Shift Templates API ─────────────────────────────────────────────────────

export function useShiftTemplates() {
  return useQuery({
    queryKey: ['hr', 'shift-templates'],
    queryFn: () => apiClient.get('/hr/shifts/templates').then(r => r.data),
  })
}

export function useCreateShiftTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ShiftTemplateCreatePayload) =>
      apiClient.post('/hr/shifts/templates', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'shift-templates'] }),
  })
}

export function useUpdateShiftTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: Partial<ShiftTemplateCreatePayload> }) =>
      apiClient.put(`/hr/shifts/templates/${templateId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'shift-templates'] }),
  })
}

export function useDeleteShiftTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (templateId: string) =>
      apiClient.delete(`/hr/shifts/templates/${templateId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'shift-templates'] }),
  })
}

// ─── Shift Assignments API ────────────────────────────────────────────────────

export function useShiftAssignments(params?: { employee_id?: string; start_date?: string; end_date?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr', 'shift-assignments', params],
    queryFn: () => apiClient.get('/hr/shifts/assignments', { params }).then(r => r.data),
  })
}

export function useCreateShiftAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ShiftAssignmentCreatePayload) =>
      apiClient.post('/hr/shifts/assignments', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'shift-assignments'] }),
  })
}

export function useBulkCreateShiftAssignments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BulkShiftAssignmentPayload) =>
      apiClient.post('/hr/shifts/assignments/bulk', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'shift-assignments'] }),
  })
}

export function useUpdateShiftAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, data }: { assignmentId: string; data: Partial<ShiftAssignmentCreatePayload> }) =>
      apiClient.put(`/hr/shifts/assignments/${assignmentId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'shift-assignments'] }),
  })
}

export function useSwapShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, swapWithEmployeeId }: { assignmentId: string; swapWithEmployeeId: string }) =>
      apiClient.post(`/hr/shifts/assignments/${assignmentId}/swap`, { swap_with_employee_id: swapWithEmployeeId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'shift-assignments'] }),
  })
}

export function useShiftCalendar(params?: { start_date?: string; end_date?: string; department_id?: string }) {
  return useQuery({
    queryKey: ['hr', 'shift-calendar', params],
    queryFn: () => apiClient.get('/hr/shifts/calendar', { params }).then(r => r.data),
  })
}

// ─── Holiday Calendar API ─────────────────────────────────────────────────────

export function useHolidays(params?: { country_code?: string; year?: number }) {
  return useQuery({
    queryKey: ['hr', 'holidays', params],
    queryFn: () => apiClient.get('/hr/holidays', { params }).then(r => r.data),
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: HolidayCreatePayload) =>
      apiClient.post('/hr/holidays', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'holidays'] }),
  })
}

export function useUpdateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ holidayId, data }: { holidayId: string; data: Partial<HolidayCreatePayload> }) =>
      apiClient.put(`/hr/holidays/${holidayId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'holidays'] }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (holidayId: string) =>
      apiClient.delete(`/hr/holidays/${holidayId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'holidays'] }),
  })
}

// ─── Overtime Alerts API ──────────────────────────────────────────────────────

export function useOvertimeAlerts(params?: { threshold_hours?: number; period_days?: number }) {
  return useQuery({
    queryKey: ['hr', 'overtime-alerts', params],
    queryFn: () => apiClient.get('/hr/overtime/alerts', { params }).then(r => r.data),
  })
}

// ─── Goals / OKR API ──────────────────────────────────────────────────────────

export function useGoals(params?: { goal_type?: string; owner_type?: string; owner_id?: string; status?: string; review_period?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr', 'goals', params],
    queryFn: () => apiClient.get('/hr/goals', { params }).then(r => r.data),
  })
}

export function useGoal(goalId: string) {
  return useQuery({
    queryKey: ['hr', 'goals', goalId],
    queryFn: () => apiClient.get(`/hr/goals/${goalId}`).then(r => r.data),
    enabled: !!goalId,
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GoalCreatePayload) =>
      apiClient.post('/hr/goals', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'goals'] }),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: GoalUpdatePayload }) =>
      apiClient.put(`/hr/goals/${goalId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (goalId: string) =>
      apiClient.delete(`/hr/goals/${goalId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'goals'] }),
  })
}

export function useGoalUpdates(goalId: string) {
  return useQuery({
    queryKey: ['hr', 'goals', goalId, 'updates'],
    queryFn: () => apiClient.get(`/hr/goals/${goalId}/updates`).then(r => r.data),
    enabled: !!goalId,
  })
}

export function useAddGoalUpdate(goalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GoalProgressUpdate) =>
      apiClient.post(`/hr/goals/${goalId}/updates`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'goals', goalId] })
      qc.invalidateQueries({ queryKey: ['hr', 'goals', goalId, 'updates'] })
    },
  })
}

export function useGoalTree() {
  return useQuery({
    queryKey: ['hr', 'goals', 'tree'],
    queryFn: () => apiClient.get('/hr/goals/tree').then(r => r.data),
  })
}

export function useGoalDashboard() {
  return useQuery({
    queryKey: ['hr', 'goals', 'dashboard'],
    queryFn: () => apiClient.get('/hr/goals/dashboard').then(r => r.data),
  })
}

// ─── Continuous Feedback API ──────────────────────────────────────────────────

export function useFeedbackReceived(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr', 'feedback', 'received', params],
    queryFn: () => apiClient.get('/hr/feedback', { params }).then(r => r.data),
  })
}

export function useFeedbackGiven(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr', 'feedback', 'given', params],
    queryFn: () => apiClient.get('/hr/feedback/given', { params }).then(r => r.data),
  })
}

export function useGiveFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: FeedbackCreatePayload) =>
      apiClient.post('/hr/feedback', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'feedback'] })
    },
  })
}

export function useFeedbackSummary(employeeId: string) {
  return useQuery({
    queryKey: ['hr', 'feedback', 'summary', employeeId],
    queryFn: () => apiClient.get(`/hr/feedback/summary/${employeeId}`).then(r => r.data),
    enabled: !!employeeId,
  })
}

// ─── Review Cycles API ────────────────────────────────────────────────────────

export function useReviewCycles(params?: { status?: string; cycle_type?: string }) {
  return useQuery({
    queryKey: ['hr', 'review-cycles', params],
    queryFn: () => apiClient.get('/hr/review-cycles', { params }).then(r => r.data),
  })
}

export function useCreateReviewCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ReviewCycleCreatePayload) =>
      apiClient.post('/hr/review-cycles', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'review-cycles'] }),
  })
}

export function useUpdateReviewCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cycleId, data }: { cycleId: string; data: ReviewCycleUpdatePayload }) =>
      apiClient.put(`/hr/review-cycles/${cycleId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'review-cycles'] }),
  })
}

export function useLaunchReviewCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cycleId: string) =>
      apiClient.post(`/hr/review-cycles/${cycleId}/launch`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'review-cycles'] }),
  })
}

export function useAdvanceReviewCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cycleId: string) =>
      apiClient.put(`/hr/review-cycles/${cycleId}/advance`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'review-cycles'] }),
  })
}

export function useReviewCycleAssignments(cycleId: string, params?: { review_type?: string; status?: string }) {
  return useQuery({
    queryKey: ['hr', 'review-cycles', cycleId, 'assignments', params],
    queryFn: () => apiClient.get(`/hr/review-cycles/${cycleId}/assignments`, { params }).then(r => r.data),
    enabled: !!cycleId,
  })
}

// ─── Review Assignments API ───────────────────────────────────────────────────

export function useMyReviewAssignments() {
  return useQuery({
    queryKey: ['hr', 'review-assignments', 'mine'],
    queryFn: () => apiClient.get('/hr/review-assignments/mine').then(r => r.data),
  })
}

export function useReviewAssignment(assignmentId: string) {
  return useQuery({
    queryKey: ['hr', 'review-assignments', assignmentId],
    queryFn: () => apiClient.get(`/hr/review-assignments/${assignmentId}`).then(r => r.data),
    enabled: !!assignmentId,
  })
}

export function useSubmitReviewAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, data }: { assignmentId: string; data: ReviewSubmitPayload }) =>
      apiClient.put(`/hr/review-assignments/${assignmentId}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'review-assignments'] })
      qc.invalidateQueries({ queryKey: ['hr', 'review-cycles'] })
    },
  })
}

export function useEmployeeIDP(employeeId: string) {
  return useQuery({
    queryKey: ['hr', 'employees', employeeId, 'idp'],
    queryFn: () => apiClient.get(`/hr/employees/${employeeId}/idp`).then(r => r.data),
    enabled: !!employeeId,
  })
}

// ─── Audit API ────────────────────────────────────────────────────────────────

export function useAuditChanges(params?: { table_name?: string; record_id?: string; field_name?: string; changed_by?: string; start_date?: string; end_date?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr', 'audit', 'changes', params],
    queryFn: () => apiClient.get('/hr/audit/changes', { params }).then(r => r.data),
  })
}

export function useRecordChanges(recordId: string) {
  return useQuery({
    queryKey: ['hr', 'audit', 'changes', recordId],
    queryFn: () => apiClient.get(`/hr/audit/changes/${recordId}`).then(r => r.data),
    enabled: !!recordId,
  })
}

export function useSensitiveAccessLog(params?: { start_date?: string; end_date?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hr', 'audit', 'sensitive-access', params],
    queryFn: () => apiClient.get('/hr/audit/sensitive-access', { params }).then(r => r.data),
  })
}

// ─── Manager Dashboard API ───────────────────────────────────────────────────

export function useManagerTeam() {
  return useQuery({
    queryKey: ['hr', 'manager', 'team'],
    queryFn: () => apiClient.get('/hr/manager/team').then(r => r.data),
  })
}

export function useManagerTeamPerformance(period?: string) {
  return useQuery({
    queryKey: ['hr', 'manager', 'team', 'performance', period],
    queryFn: () => apiClient.get('/hr/manager/team/performance', { params: { period } }).then(r => r.data),
  })
}

export function useManagerTeamLeave() {
  return useQuery({
    queryKey: ['hr', 'manager', 'team', 'leave'],
    queryFn: () => apiClient.get('/hr/manager/team/leave').then(r => r.data),
  })
}

export function useManagerTeamAttendance(targetDate?: string) {
  return useQuery({
    queryKey: ['hr', 'manager', 'team', 'attendance', targetDate],
    queryFn: () => apiClient.get('/hr/manager/team/attendance', { params: { target_date: targetDate } }).then(r => r.data),
  })
}

export function useManagerTeamGoals(reviewPeriod?: string) {
  return useQuery({
    queryKey: ['hr', 'manager', 'team', 'goals', reviewPeriod],
    queryFn: () => apiClient.get('/hr/manager/team/goals', { params: { review_period: reviewPeriod } }).then(r => r.data),
  })
}

export function useManagerTeamEngagement() {
  return useQuery({
    queryKey: ['hr', 'manager', 'team', 'engagement'],
    queryFn: () => apiClient.get('/hr/manager/team/engagement').then(r => r.data),
  })
}

export function useCreateDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DelegationCreatePayload) =>
      apiClient.post('/hr/manager/delegation', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'manager', 'delegation'] }),
  })
}

export function useManagerDelegations() {
  return useQuery({
    queryKey: ['hr', 'manager', 'delegation'],
    queryFn: () => apiClient.get('/hr/manager/delegation').then(r => r.data),
  })
}

export function useRevokeDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (delegationId: string) =>
      apiClient.delete(`/hr/manager/delegation/${delegationId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'manager', 'delegation'] }),
  })
}
