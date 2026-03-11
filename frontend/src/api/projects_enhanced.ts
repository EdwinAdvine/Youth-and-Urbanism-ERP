import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Subtask Types & Hooks ───────────────────────────────────────────────────

export interface Subtask {
  id: string
  project_id: string
  parent_id: string | null
  title: string
  description: string | null
  assignee_id: string | null
  status: string
  priority: string
  due_date: string | null
  start_date: string | null
  estimated_hours: number | null
  order: number
  tags: string[]
  created_at: string
  updated_at: string
}

export function useSubtasks(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'subtasks'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; subtasks: Subtask[] }>(
        `/projects/${projectId}/tasks/${taskId}/subtasks`
      )
      return data
    },
    enabled: !!projectId && !!taskId,
  })
}

export function useCreateSubtask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, ...payload }: { project_id: string; task_id: string; title: string; description?: string; assignee_id?: string; priority?: string; due_date?: string; start_date?: string; estimated_hours?: number; tags?: string[] }) => {
      const { data } = await apiClient.post(`/projects/${project_id}/tasks/${task_id}/subtasks`, payload)
      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'subtasks'] })
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks'] })
    },
  })
}

export function useReparentTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, new_parent_id }: { project_id: string; task_id: string; new_parent_id: string | null }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/tasks/${task_id}/reparent`, { new_parent_id })
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks'] }),
  })
}

// ─── Checklist Types & Hooks ─────────────────────────────────────────────────

export interface ChecklistItem {
  id: string
  task_id: string
  title: string
  is_completed: boolean
  order: number
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

export interface ChecklistData {
  total: number
  completed: number
  progress: number
  items: ChecklistItem[]
}

export function useChecklists(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'checklists'],
    queryFn: async () => {
      const { data } = await apiClient.get<ChecklistData>(
        `/projects/${projectId}/tasks/${taskId}/checklists`
      )
      return data
    },
    enabled: !!projectId && !!taskId,
  })
}

export function useCreateChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, title, order = 0 }: { project_id: string; task_id: string; title: string; order?: number }) => {
      const { data } = await apiClient.post(`/projects/${project_id}/tasks/${task_id}/checklists`, { title, order })
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'checklists'] }),
  })
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, item_id, ...payload }: { project_id: string; task_id: string; item_id: string; title?: string; is_completed?: boolean; order?: number }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/tasks/${task_id}/checklists/${item_id}`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'checklists'] }),
  })
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, item_id }: { project_id: string; task_id: string; item_id: string }) => {
      await apiClient.delete(`/projects/${project_id}/tasks/${task_id}/checklists/${item_id}`)
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'checklists'] }),
  })
}

// ─── Task Relationships ──────────────────────────────────────────────────────

export type RelationshipType = 'blocks' | 'is_blocked_by' | 'duplicates' | 'is_duplicated_by' | 'relates_to'

export interface TaskRelationship {
  id: string
  source_task_id: string
  target_task_id: string
  relationship_type: RelationshipType
  created_at: string
}

export function useTaskRelationships(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'relationships'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ outgoing: TaskRelationship[]; incoming: TaskRelationship[] }>(
        `/projects/${projectId}/tasks/${taskId}/relationships`
      )
      return data
    },
    enabled: !!projectId && !!taskId,
  })
}

export function useCreateRelationship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, target_task_id, relationship_type }: { project_id: string; task_id: string; target_task_id: string; relationship_type: RelationshipType }) => {
      const { data } = await apiClient.post(`/projects/${project_id}/tasks/${task_id}/relationships`, { target_task_id, relationship_type })
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'relationships'] }),
  })
}

export function useDeleteRelationship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, rel_id }: { project_id: string; task_id: string; rel_id: string }) => {
      await apiClient.delete(`/projects/${project_id}/tasks/${task_id}/relationships/${rel_id}`)
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'relationships'] }),
  })
}

// ─── Custom Fields ───────────────────────────────────────────────────────────

export type CustomFieldType = 'text' | 'number' | 'dropdown' | 'date' | 'formula'

export interface CustomField {
  id: string
  project_id: string
  name: string
  field_type: CustomFieldType
  options: Record<string, unknown> | null
  default_value: string | null
  is_required: boolean
  order: number
  created_at: string
  updated_at: string
}

export interface FieldValue {
  field_id: string
  field_name: string
  field_type: CustomFieldType
  is_required: boolean
  options: Record<string, unknown> | null
  value_id: string | null
  value_text: string | null
  value_number: number | null
  value_date: string | null
}

export function useCustomFields(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'custom-fields'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; fields: CustomField[] }>(
        `/projects/${projectId}/custom-fields`
      )
      return data.fields
    },
    enabled: !!projectId,
  })
}

export function useCreateCustomField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, ...payload }: { project_id: string; name: string; field_type: CustomFieldType; options?: Record<string, unknown>; default_value?: string; is_required?: boolean; order?: number }) => {
      const { data } = await apiClient.post(`/projects/${project_id}/custom-fields`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'custom-fields'] }),
  })
}

export function useUpdateCustomField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, field_id, ...payload }: { project_id: string; field_id: string; name?: string; options?: Record<string, unknown>; default_value?: string; is_required?: boolean; order?: number }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/custom-fields/${field_id}`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'custom-fields'] }),
  })
}

export function useDeleteCustomField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, field_id }: { project_id: string; field_id: string }) => {
      await apiClient.delete(`/projects/${project_id}/custom-fields/${field_id}`)
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'custom-fields'] }),
  })
}

export function useTaskCustomFieldValues(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'custom-fields'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ fields: FieldValue[] }>(
        `/projects/${projectId}/tasks/${taskId}/custom-fields`
      )
      return data.fields
    },
    enabled: !!projectId && !!taskId,
  })
}

export function useSetCustomFieldValues() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, values }: { project_id: string; task_id: string; values: { field_id: string; value_text?: string | null; value_number?: number | null; value_date?: string | null }[] }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/tasks/${task_id}/custom-fields`, { values })
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'custom-fields'] }),
  })
}

// ─── Comments ────────────────────────────────────────────────────────────────

export interface TaskCommentData {
  id: string
  task_id: string
  author_id: string
  content: string
  parent_id: string | null
  mentions: string[] | null
  is_edited: boolean
  created_at: string
  updated_at: string
  replies?: TaskCommentData[]
}

export function useTaskComments(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'comments'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; comments: TaskCommentData[] }>(
        `/projects/${projectId}/tasks/${taskId}/comments`
      )
      return data
    },
    enabled: !!projectId && !!taskId,
  })
}

export function useCreateComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, content, parent_id }: { project_id: string; task_id: string; content: string; parent_id?: string }) => {
      const { data } = await apiClient.post(`/projects/${project_id}/tasks/${task_id}/comments`, { content, parent_id })
      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'comments'] })
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'activity'] })
    },
  })
}

export function useEditComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, comment_id, content }: { project_id: string; task_id: string; comment_id: string; content: string }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/tasks/${task_id}/comments/${comment_id}`, { content })
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'comments'] }),
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, comment_id }: { project_id: string; task_id: string; comment_id: string }) => {
      await apiClient.delete(`/projects/${project_id}/tasks/${task_id}/comments/${comment_id}`)
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks', v.task_id, 'comments'] }),
  })
}

// ─── Activity Feed ───────────────────────────────────────────────────────────

export interface ActivityItem {
  type: 'audit' | 'comment'
  id: string
  user_id: string | null
  action?: string
  changes?: Record<string, { old: string | null; new: string | null }>
  content?: string
  parent_id?: string | null
  mentions?: string[] | null
  is_edited?: boolean
  created_at: string
}

export function useTaskActivity(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'activity'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; activities: ActivityItem[] }>(
        `/projects/${projectId}/tasks/${taskId}/activity`
      )
      return data
    },
    enabled: !!projectId && !!taskId,
  })
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  task_id: string
  user_id: string | null
  action: string
  changes: Record<string, unknown> | null
  created_at: string
}

export function useTaskAuditLog(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'audit-log'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; entries: AuditLogEntry[] }>(
        `/projects/${projectId}/tasks/${taskId}/audit-log`
      )
      return data
    },
    enabled: !!projectId && !!taskId,
  })
}

// ─── Sprints ─────────────────────────────────────────────────────────────────

export type SprintStatus = 'planning' | 'active' | 'completed'

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal: string | null
  start_date: string | null
  end_date: string | null
  status: SprintStatus
  task_count: number
  created_at: string
  updated_at: string
}

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprints'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; sprints: Sprint[] }>(
        `/projects/${projectId}/sprints`
      )
      return data.sprints
    },
    enabled: !!projectId,
  })
}

export function useCreateSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, ...payload }: { project_id: string; name: string; goal?: string; start_date?: string; end_date?: string }) => {
      const { data } = await apiClient.post(`/projects/${project_id}/sprints`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'sprints'] }),
  })
}

export function useUpdateSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, sprint_id, ...payload }: { project_id: string; sprint_id: string; name?: string; goal?: string; start_date?: string; end_date?: string; status?: SprintStatus }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/sprints/${sprint_id}`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'sprints'] }),
  })
}

export function useDeleteSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, sprint_id }: { project_id: string; sprint_id: string }) => {
      await apiClient.delete(`/projects/${project_id}/sprints/${sprint_id}`)
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'sprints'] }),
  })
}

export function useAssignTaskToSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, sprint_id }: { project_id: string; task_id: string; sprint_id: string | null }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/tasks/${task_id}/sprint`, { sprint_id })
      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'sprints'] })
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'backlog'] })
    },
  })
}

// ─── Backlog ─────────────────────────────────────────────────────────────────

export function useBacklog(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'backlog'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; tasks: unknown[] }>(
        `/projects/${projectId}/backlog`
      )
      return data
    },
    enabled: !!projectId,
  })
}

// ─── Calendar View ───────────────────────────────────────────────────────────

export function useCalendarTasks(projectId: string, start: string, end: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'calendar', start, end],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; by_date: Record<string, unknown[]> }>(
        `/projects/${projectId}/calendar`,
        { params: { start, end } }
      )
      return data
    },
    enabled: !!projectId && !!start && !!end,
  })
}

// ─── Bulk Update ─────────────────────────────────────────────────────────────

export function useBulkUpdateTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, ...payload }: { project_id: string; task_ids: string[]; status?: string; priority?: string; assignee_id?: string; sprint_id?: string }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/tasks/bulk`, payload)
      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'board'] })
    },
  })
}

// ─── Recurring Tasks ─────────────────────────────────────────────────────────

export interface RecurringConfig {
  id: string
  project_id: string
  template_task: Record<string, unknown>
  recurrence_type: string
  recurrence_interval: number
  day_of_week: number | null
  day_of_month: number | null
  cron_expression: string | null
  next_run_at: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export function useRecurringConfigs(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'recurring'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; configs: RecurringConfig[] }>(
        `/projects/${projectId}/recurring`
      )
      return data.configs
    },
    enabled: !!projectId,
  })
}

export function useCreateRecurringConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, ...payload }: { project_id: string; template_task: Record<string, unknown>; recurrence_type: string; recurrence_interval?: number; day_of_week?: number; day_of_month?: number; next_run_at?: string }) => {
      const { data } = await apiClient.post(`/projects/${project_id}/recurring`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'recurring'] }),
  })
}

export function useUpdateRecurringConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, config_id, ...payload }: { project_id: string; config_id: string; is_active?: boolean; template_task?: Record<string, unknown>; recurrence_type?: string; recurrence_interval?: number }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/recurring/${config_id}`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'recurring'] }),
  })
}

export function useDeleteRecurringConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, config_id }: { project_id: string; config_id: string }) => {
      await apiClient.delete(`/projects/${project_id}/recurring/${config_id}`)
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'recurring'] }),
  })
}

export function useTriggerRecurringTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, config_id }: { project_id: string; config_id: string }) => {
      const { data } = await apiClient.post(`/projects/${project_id}/recurring/${config_id}/trigger`)
      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'recurring'] })
      qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'tasks'] })
    },
  })
}

// ─── Automation Rules ────────────────────────────────────────────────────────

export interface AutomationRule {
  id: string
  project_id: string
  name: string
  trigger_type: string
  trigger_config: Record<string, unknown> | null
  action_type: string
  action_config: Record<string, unknown> | null
  is_active: boolean
  execution_count: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface AutomationTemplate {
  name: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
}

export function useAutomationRules(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'automations'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; rules: AutomationRule[] }>(
        `/projects/${projectId}/automations`
      )
      return data.rules
    },
    enabled: !!projectId,
  })
}

export function useAutomationTemplates(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'automations', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ templates: AutomationTemplate[] }>(
        `/projects/${projectId}/automations/templates`
      )
      return data.templates
    },
    enabled: !!projectId,
  })
}

export function useCreateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, ...payload }: { project_id: string; name: string; trigger_type: string; trigger_config?: Record<string, unknown>; action_type: string; action_config?: Record<string, unknown> }) => {
      const { data } = await apiClient.post(`/projects/${project_id}/automations`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'automations'] }),
  })
}

export function useUpdateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, rule_id, ...payload }: { project_id: string; rule_id: string; name?: string; trigger_type?: string; trigger_config?: Record<string, unknown>; action_type?: string; action_config?: Record<string, unknown>; is_active?: boolean }) => {
      const { data } = await apiClient.put(`/projects/${project_id}/automations/${rule_id}`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'automations'] }),
  })
}

export function useDeleteAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, rule_id }: { project_id: string; rule_id: string }) => {
      await apiClient.delete(`/projects/${project_id}/automations/${rule_id}`)
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['projects', v.project_id, 'automations'] }),
  })
}
