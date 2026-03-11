import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskDependency {
  id: string
  task_id: string
  depends_on_task_id: string
  dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'
  created_at: string
}

export interface ProjectMilestone {
  id: string
  project_id: string
  title: string
  description: string | null
  due_date: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskAttachment {
  id: string
  task_id: string
  file_name: string
  file_size: number
  content_type: string
  minio_key: string
  uploaded_by: string
  created_at: string
}

export interface ProjectTemplate {
  id: string
  name: string
  description: string | null
  task_templates: TaskTemplate[]
  milestone_templates: MilestoneTemplate[]
  created_at: string
  updated_at: string
}

export interface TaskTemplate {
  title: string
  description: string | null
  status: string
  priority: string
  relative_due_days: number | null
  tags: string[]
}

export interface MilestoneTemplate {
  title: string
  relative_due_days: number | null
}

export interface GanttTask {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  due_date: string | null
  status: string
  priority: string
  assignee_name: string | null
  progress: number
  dependencies: string[]
}

export interface ProjectReport {
  project_id: string
  project_name: string
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  overdue_tasks: number
  total_hours_logged: number
  milestone_progress: number
  burndown: BurndownPoint[]
  task_by_status: Record<string, number>
  task_by_priority: Record<string, number>
  team_workload: WorkloadEntry[]
}

export interface BurndownPoint {
  date: string
  remaining: number
  completed: number
  ideal: number
}

export interface WorkloadEntry {
  user_id: string
  user_name: string
  assigned_count: number
  completed_count: number
  hours_logged: number
}

export interface CreateDependencyPayload {
  task_id: string
  depends_on_task_id: string
  dependency_type?: TaskDependency['dependency_type']
}

export interface CreateMilestonePayload {
  project_id: string
  title: string
  description?: string
  due_date?: string | null
}

export interface UpdateMilestonePayload {
  project_id: string
  milestone_id: string
  title?: string
  description?: string
  due_date?: string | null
  is_completed?: boolean
}

export interface CreateTemplatePayload {
  name: string
  description?: string
  source_project_id?: string
}

export interface CreateFromTemplatePayload {
  template_id: string
  name: string
  start_date?: string
}

// ─── Task Dependencies ───────────────────────────────────────────────────────

export function useTaskDependencies(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'dependencies'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ dependencies: TaskDependency[] }>(
        `/projects/${projectId}/tasks/${taskId}/dependencies`
      )
      return data.dependencies
    },
    enabled: !!projectId && !!taskId,
  })
}

export function useCreateTaskDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ task_id, ...payload }: CreateDependencyPayload & { project_id: string }) => {
      const { data } = await apiClient.post<TaskDependency>(
        `/projects/${(payload as any).project_id}/tasks/${task_id}/dependencies`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteTaskDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, taskId, dependencyId }: { projectId: string; taskId: string; dependencyId: string }) => {
      await apiClient.delete(`/projects/${projectId}/tasks/${taskId}/dependencies/${dependencyId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// ─── Milestones (Extended) ───────────────────────────────────────────────────

export function useMilestonesExt(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'milestones'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; milestones: ProjectMilestone[] }>(
        `/projects/${projectId}/milestones`
      )
      return data.milestones
    },
    enabled: !!projectId,
  })
}

export function useCreateMilestoneExt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, ...payload }: CreateMilestonePayload) => {
      const { data } = await apiClient.post<ProjectMilestone>(
        `/projects/${project_id}/milestones`,
        payload
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'milestones'] })
    },
  })
}

export function useUpdateMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, milestone_id, ...payload }: UpdateMilestonePayload) => {
      const { data } = await apiClient.put<ProjectMilestone>(
        `/projects/${project_id}/milestones/${milestone_id}`,
        payload
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'milestones'] })
    },
  })
}

export function useDeleteMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, milestoneId }: { projectId: string; milestoneId: string }) => {
      await apiClient.delete(`/projects/${projectId}/milestones/${milestoneId}`)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.projectId, 'milestones'] })
    },
  })
}

// ─── Timeline / Gantt ────────────────────────────────────────────────────────

export function useProjectTimeline(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'timeline'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ tasks: GanttTask[] }>(
        `/projects/${projectId}/timeline`
      )
      return data.tasks
    },
    enabled: !!projectId,
  })
}

// ─── Report / Burndown ──────────────────────────────────────────────────────

export function useProjectReport(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'report'],
    queryFn: async () => {
      const { data } = await apiClient.get<ProjectReport>(`/projects/${projectId}/report`)
      return data
    },
    enabled: !!projectId,
  })
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function useProjectTemplates() {
  return useQuery({
    queryKey: ['project-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; templates: ProjectTemplate[] }>(
        '/projects/templates'
      )
      return data.templates
    },
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTemplatePayload) => {
      const { data } = await apiClient.post<ProjectTemplate>('/projects/templates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-templates'] }),
  })
}

export function useCreateFromTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateFromTemplatePayload) => {
      const { data } = await apiClient.post('/projects/from-template', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-Module Integrations
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Projects → Drive ────────────────────────────────────────────────────────

export interface ProjectDriveLink {
  project_id: string
  folder_id: string
  folder_name: string
  created: boolean
}

export interface ProjectDriveFile {
  id: string
  name: string
  content_type: string
  size: number
  folder_path: string
  created_at: string
}

export function useLinkDriveFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data } = await apiClient.post<ProjectDriveLink>(`/projects/${projectId}/link-drive`)
      return data
    },
    onSuccess: (_data, projectId) => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'files'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'drive-link'] })
    },
  })
}

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'files'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        total: number
        folder_id: string | null
        files: ProjectDriveFile[]
      }>(`/projects/${projectId}/files`)
      return data
    },
    enabled: !!projectId,
  })
}

// ─── Projects → Docs ─────────────────────────────────────────────────────────

export interface ProjectDocument {
  id: string
  project_id: string
  file_id: string
  title: string
  doc_type: string
  created_at: string
}

export function useCreateProjectDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, title, doc_type }: { projectId: string; title: string; doc_type?: string }) => {
      const { data } = await apiClient.post<ProjectDocument>(
        `/projects/${projectId}/create-document`,
        { title, doc_type: doc_type || 'document' }
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.projectId, 'documents'] })
    },
  })
}

export function useProjectDocuments(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'documents'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; documents: ProjectDocument[] }>(
        `/projects/${projectId}/documents`
      )
      return data
    },
    enabled: !!projectId,
  })
}

// ─── Projects → CRM: Linked Deals ───────────────────────────────────────────

export interface DealLink {
  id: string
  project_id: string
  deal_id: string
  deal_title: string | null
  deal_value: number | null
  deal_status: string | null
  notes: string | null
  created_at: string
}

export function useLinkDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, deal_id, notes }: { projectId: string; deal_id: string; notes?: string }) => {
      const { data } = await apiClient.post<DealLink>(
        `/projects/${projectId}/link-deal`,
        { deal_id, notes }
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.projectId, 'linked-deals'] })
    },
  })
}

export function useLinkedDeals(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'linked-deals'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        total: number
        total_deal_value: number
        deals: DealLink[]
      }>(`/projects/${projectId}/linked-deals`)
      return data
    },
    enabled: !!projectId,
  })
}

export function useUnlinkDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, dealId }: { projectId: string; dealId: string }) => {
      await apiClient.delete(`/projects/${projectId}/unlink-deal/${dealId}`)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.projectId, 'linked-deals'] })
    },
  })
}

// ─── Projects → Finance: Cost Tracking ──────────────────────────────────────

export interface ProjectCostSummary {
  project_id: string
  project_name: string
  total_hours: number
  hourly_rate: number
  labor_cost: number
  total_expenses: number
  grand_total: number
  time_by_user: { user_id: string; hours: number; cost: number }[]
  expenses: {
    link_id: string
    expense_id: string
    description: string
    amount: number
    category: string
    expense_date: string | null
    status: string
  }[]
}

export interface ExpenseLink {
  id: string
  project_id: string
  expense_id: string
  expense_description: string | null
  expense_amount: number | null
  expense_category: string | null
  expense_date: string | null
  created_at: string
}

export function useProjectCosts(projectId: string, hourlyRate?: number) {
  return useQuery({
    queryKey: ['projects', projectId, 'costs', hourlyRate],
    queryFn: async () => {
      const params = hourlyRate ? `?hourly_rate=${hourlyRate}` : ''
      const { data } = await apiClient.get<ProjectCostSummary>(
        `/projects/${projectId}/costs${params}`
      )
      return data
    },
    enabled: !!projectId,
  })
}

export function useLinkExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, expense_id }: { projectId: string; expense_id: string }) => {
      const { data } = await apiClient.post<ExpenseLink>(
        `/projects/${projectId}/link-expense`,
        { expense_id }
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.projectId, 'costs'] })
    },
  })
}

export function useUnlinkExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, expenseId }: { projectId: string; expenseId: string }) => {
      await apiClient.delete(`/projects/${projectId}/unlink-expense/${expenseId}`)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.projectId, 'costs'] })
    },
  })
}
