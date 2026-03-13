/**
 * Projects API client — project management, tasks, boards, milestones, time logs.
 *
 * Exports TanStack Query hooks and Axios helper functions for the Projects
 * module. All requests go through `client.ts` (Axios instance with auth
 * interceptors). Backend prefix: `/api/v1/projects`.
 *
 * Key exports:
 *   - useProjects() / useProject() / useCreateProject() — project CRUD
 *   - useTasks() / useTask() / useCreateTask() / useUpdateTask() — task lifecycle
 *   - useBoardView() — Kanban board grouped by status
 *   - useMilestones() / useCreateMilestone() — project milestone tracking
 *   - useTimeLogs() / useCreateTimeLog() — per-task time logging
 *   - useProjectMembers() / useAddProjectMember() — team member management
 *   - useSprints() / useCreateSprint() — sprint/iteration management
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LIST_PRESET, DETAIL_PRESET } from '@/utils/queryDefaults'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Project {
  id: string
  name: string
  description: string
  status: string
  start_date: string | null
  end_date: string | null
  color: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string
  parent_id: string | null
  title: string
  description: string
  assignee_id: string | null
  assignee_name?: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  start_date: string | null
  estimated_hours: number | null
  sprint_id: string | null
  order: number
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Milestone {
  id: string
  project_id: string
  title: string
  due_date: string | null
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface TimeLog {
  id: string
  task_id: string
  hours: number
  description: string
  created_at: string
  user_name?: string
}

export interface BoardView {
  todo: Task[]
  in_progress: Task[]
  in_review: Task[]
  done: Task[]
}

export interface CreateProjectPayload {
  name: string
  description?: string
  status?: string
  start_date?: string | null
  end_date?: string | null
  color?: string
}

export interface UpdateProjectPayload extends Partial<CreateProjectPayload> {
  id: string
}

export interface CreateTaskPayload {
  project_id: string
  title: string
  description?: string
  assignee_id?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string | null
  start_date?: string | null
  estimated_hours?: number | null
  tags?: string[]
  parent_id?: string | null
  sprint_id?: string | null
}

export interface UpdateTaskPayload {
  project_id: string
  task_id: string
  title?: string
  description?: string
  assignee_id?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string | null
  start_date?: string | null
  estimated_hours?: number | null
  tags?: string[]
  sprint_id?: string | null
}

export interface CreateMilestonePayload {
  project_id: string
  title: string
  due_date?: string | null
}

export interface AddTimeLogPayload {
  project_id: string
  task_id: string
  hours: number
  description?: string
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; projects: Project[] }>('/projects')
      return data.projects
    },
    ...LIST_PRESET,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Project>(`/projects/${id}`)
      return data
    },
    enabled: !!id,
    ...DETAIL_PRESET,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateProjectPayload) => {
      const { data } = await apiClient.post<Project>('/projects', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateProjectPayload) => {
      const { data } = await apiClient.put<Project>(`/projects/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/projects/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; tasks: Task[] }>(`/projects/${projectId}/tasks`)
      return data.tasks
    },
    enabled: !!projectId,
    ...LIST_PRESET,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, ...payload }: CreateTaskPayload) => {
      const { data } = await apiClient.post<Task>(`/projects/${project_id}/tasks`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'board'] })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, ...payload }: UpdateTaskPayload) => {
      const { data } = await apiClient.put<Task>(`/projects/${project_id}/tasks/${task_id}`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'board'] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id }: { project_id: string; task_id: string }) => {
      await apiClient.delete(`/projects/${project_id}/tasks/${task_id}`)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'board'] })
    },
  })
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function useBoard(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'board'],
    queryFn: async () => {
      const { data } = await apiClient.get<BoardView>(`/projects/${projectId}/board`)
      return data
    },
    enabled: !!projectId,
    ...LIST_PRESET,
  })
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export function useMilestones(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'milestones'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; milestones: Milestone[] }>(`/projects/${projectId}/milestones`)
      return data.milestones
    },
    enabled: !!projectId,
    ...LIST_PRESET,
  })
}

export function useCreateMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, ...payload }: CreateMilestonePayload) => {
      const { data } = await apiClient.post<Milestone>(`/projects/${project_id}/milestones`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'milestones'] })
    },
  })
}

// ─── Batch Reorder (drag-and-drop) ───────────────────────────────────────────

export interface ReorderItem {
  task_id: string
  status: TaskStatus
  order: number
}

export function useBatchReorder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, tasks }: { project_id: string; tasks: ReorderItem[] }) => {
      await apiClient.put(`/projects/${project_id}/board/reorder`, { tasks })
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'board'] })
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'tasks'] })
    },
  })
}

// ─── Time Report ─────────────────────────────────────────────────────────────

export interface TimeReportData {
  project_id: string
  project_name: string
  grand_total_hours: number
  by_task: { task_id: string; task_title: string; task_status: string; total_hours: number; log_count: number }[]
  by_user: { user_id: string; total_hours: number }[]
}

export function useTimeReport(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'time-report'],
    queryFn: async () => {
      const { data } = await apiClient.get<TimeReportData>(`/projects/${projectId}/time-report`)
      return data
    },
    enabled: !!projectId,
    ...LIST_PRESET,
  })
}

export function useTaskTimeLogs(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'time-logs'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; total_hours: number; time_logs: TimeLog[] }>(
        `/projects/${projectId}/tasks/${taskId}/time-logs`
      )
      return data
    },
    enabled: !!projectId && !!taskId,
    ...LIST_PRESET,
  })
}

// ─── Time Logs ────────────────────────────────────────────────────────────────

export function useAddTimeLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, task_id, ...payload }: AddTimeLogPayload) => {
      const { data } = await apiClient.post<TimeLog>(
        `/projects/${project_id}/tasks/${task_id}/time-logs`,
        payload
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projects', variables.project_id, 'tasks'] })
    },
  })
}
