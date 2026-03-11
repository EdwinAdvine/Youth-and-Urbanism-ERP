import api from "@/api/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SurveyQuestion {
  id: string
  type: "likert" | "nps" | "open" | "multichoice" | "rating"
  text: string
  options?: string[]
  required: boolean
}

export interface Survey {
  id: string
  title: string
  survey_type: "engagement" | "enps" | "pulse" | "exit" | "onboarding" | "custom"
  description: string | null
  questions: SurveyQuestion[] | null
  target_audience: { department_ids?: string[]; all?: boolean } | null
  is_anonymous: boolean
  status: "draft" | "active" | "closed"
  opens_at: string | null
  closes_at: string | null
  created_by: string
  created_at: string
  response_count?: number
}

export interface SurveyResponse {
  id: string
  survey_id: string
  respondent_id: string | null
  answers: Record<string, string | number>
  sentiment_score: number | null
  sentiment_label: "positive" | "neutral" | "negative" | null
  nps_score: number | null
  submitted_at: string | null
}

export interface QuestionResult {
  question_text: string
  type: string
  avg_score?: number
  distribution?: Record<string, number>
  text_responses?: string[]
}

export interface SurveyResults {
  survey_id: string
  response_count: number
  response_rate: number
  nps_score: number | null
  avg_sentiment_score: number | null
  question_breakdown: Record<string, QuestionResult>
}

export interface ENPSTrend {
  period: string
  nps_score: number
  response_count: number
}

export interface Recognition {
  id: string
  from_employee_id: string
  to_employee_id: string
  recognition_type: "kudos" | "badge" | "shoutout" | "award"
  badge_name: string | null
  message: string
  points: number
  is_public: boolean
  created_at: string
  from_employee?: { id: string; user?: { full_name: string } }
  to_employee?: { id: string; user?: { full_name: string } }
}

export interface RecognitionSummary {
  total_received: number
  points_total: number
  by_type: Record<string, number>
  top_badges: string[]
}

export interface RecognitionLeader {
  employee_id: string
  employee_name: string
  points: number
  recognition_count: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface OnboardingTemplate {
  id: string
  name: string
  template_type: "onboarding" | "offboarding"
  department_id: string | null
  description: string | null
  is_active: boolean
  tasks?: OnboardingTask[]
}

export interface OnboardingTask {
  id: string
  template_id: string | null
  employee_id: string | null
  task_type: "onboarding" | "offboarding"
  title: string
  description: string | null
  category: string | null
  assigned_to: string | null
  due_date: string | null
  status: "pending" | "in_progress" | "completed" | "skipped"
  completed_at: string | null
  order_index: number
}

export interface OnboardingProgress {
  total_tasks: number
  completed_tasks: number
  completion_pct: number
  overdue_tasks: number
  upcoming_tasks: OnboardingTask[]
}

export interface BuddyAssignment {
  id: string
  new_employee_id: string
  buddy_employee_id: string
  start_date: string
  end_date: string | null
  is_active: boolean
}

// ─── Survey Hooks ─────────────────────────────────────────────────────────────

export function useSurveys(params?: {
  type?: Survey["survey_type"]
  status?: Survey["status"]
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ["hr", "surveys", params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Survey>>("/hr/surveys", { params })
      return data
    },
  })
}

export function useSurvey(id: string) {
  return useQuery({
    queryKey: ["hr", "surveys", id],
    queryFn: async () => {
      const { data } = await api.get<Survey>(`/hr/surveys/${id}`)
      return data
    },
    enabled: Boolean(id),
  })
}

export function useCreateSurvey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Survey>) => {
      const { data } = await api.post<Survey>("/hr/surveys", payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "surveys"] })
    },
  })
}

export function useUpdateSurvey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Survey> & { id: string }) => {
      const { data } = await api.put<Survey>(`/hr/surveys/${id}`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "surveys"] })
      queryClient.invalidateQueries({ queryKey: ["hr", "surveys", variables.id] })
    },
  })
}

export function useDeleteSurvey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/surveys/${id}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "surveys"] })
    },
  })
}

export function useLaunchSurvey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Survey>(`/hr/surveys/${id}/launch`)
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "surveys"] })
      queryClient.invalidateQueries({ queryKey: ["hr", "surveys", id] })
    },
  })
}

export function useCloseSurvey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Survey>(`/hr/surveys/${id}/close`)
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "surveys"] })
      queryClient.invalidateQueries({ queryKey: ["hr", "surveys", id] })
    },
  })
}

export function useSubmitSurveyResponse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      answers,
    }: {
      id: string
      answers: Record<string, string | number>
    }) => {
      const { data } = await api.post<SurveyResponse>(`/hr/surveys/${id}/respond`, { answers })
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "surveys", variables.id, "results"] })
    },
  })
}

// ─── Survey Results Hooks ─────────────────────────────────────────────────────

export function useSurveyResults(id: string) {
  return useQuery({
    queryKey: ["hr", "surveys", id, "results"],
    queryFn: async () => {
      const { data } = await api.get<SurveyResults>(`/hr/surveys/${id}/results`)
      return data
    },
    enabled: Boolean(id),
  })
}

export function useENPSTrend() {
  return useQuery({
    queryKey: ["hr", "surveys", "enps-trend"],
    queryFn: async () => {
      const { data } = await api.get<ENPSTrend[]>("/hr/surveys/enps-trend")
      return data
    },
  })
}

// ─── Recognition Hooks ────────────────────────────────────────────────────────

export function useRecognitions(params?: {
  to_employee_id?: string
  from_employee_id?: string
  type?: Recognition["recognition_type"]
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ["hr", "recognitions", params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Recognition>>("/hr/recognitions", { params })
      return data
    },
  })
}

export function useCreateRecognition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Recognition, "id" | "created_at" | "from_employee" | "to_employee">) => {
      const { data } = await api.post<Recognition>("/hr/recognitions", payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "recognitions"] })
    },
  })
}

export function useDeleteRecognition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/recognitions/${id}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "recognitions"] })
    },
  })
}

export function useEmployeeRecognitionSummary(empId: string) {
  return useQuery({
    queryKey: ["hr", "employees", empId, "recognition-summary"],
    queryFn: async () => {
      const { data } = await api.get<RecognitionSummary>(`/hr/employees/${empId}/recognition-summary`)
      return data
    },
    enabled: Boolean(empId),
  })
}

export function useRecognitionLeaderboard() {
  return useQuery({
    queryKey: ["hr", "recognitions", "leaderboard"],
    queryFn: async () => {
      const { data } = await api.get<RecognitionLeader[]>("/hr/recognitions/leaderboard")
      return data
    },
  })
}

// ─── Onboarding Template Hooks ────────────────────────────────────────────────

export function useOnboardingTemplates(params?: {
  template_type?: OnboardingTemplate["template_type"]
  department_id?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ["hr", "onboarding", "templates", params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<OnboardingTemplate>>(
        "/hr/onboarding/templates",
        { params }
      )
      return data
    },
  })
}

export function useCreateOnboardingTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<OnboardingTemplate, "id">) => {
      const { data } = await api.post<OnboardingTemplate>("/hr/onboarding/templates", payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "templates"] })
    },
  })
}

export function useUpdateOnboardingTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<OnboardingTemplate> & { id: string }) => {
      const { data } = await api.put<OnboardingTemplate>(
        `/hr/onboarding/templates/${id}`,
        payload
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "templates"] })
    },
  })
}

export function useDeleteOnboardingTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/onboarding/templates/${id}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "templates"] })
    },
  })
}

// ─── Onboarding Task Hooks ────────────────────────────────────────────────────

export function useOnboardingTasks(params?: {
  employee_id?: string
  task_type?: OnboardingTask["task_type"]
  status?: OnboardingTask["status"]
  category?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ["hr", "onboarding", "tasks", params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<OnboardingTask>>(
        "/hr/onboarding/tasks",
        { params }
      )
      return data
    },
  })
}

export function useEmployeeOnboardingTasks(empId: string) {
  return useQuery({
    queryKey: ["hr", "onboarding", "employees", empId, "tasks"],
    queryFn: async () => {
      const { data } = await api.get<OnboardingTask[]>(
        `/hr/onboarding/employees/${empId}/tasks`
      )
      return data
    },
    enabled: Boolean(empId),
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: OnboardingTask["status"]
    }) => {
      const { data } = await api.put<OnboardingTask>(
        `/hr/onboarding/tasks/${id}/status`,
        { status }
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "tasks"] })
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "employees"] })
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "dashboard"] })
    },
  })
}

export function useStartOnboarding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      template_id,
    }: {
      id: string
      template_id?: string
    }) => {
      const { data } = await api.post<OnboardingTask[]>(
        `/hr/onboarding/employees/${id}/start`,
        { template_id }
      )
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "employees", variables.id] })
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "dashboard"] })
    },
  })
}

export function useOffboardEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      template_id,
    }: {
      id: string
      template_id?: string
    }) => {
      const { data } = await api.post<OnboardingTask[]>(
        `/hr/onboarding/employees/${id}/offboard`,
        { template_id }
      )
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "employees", variables.id] })
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "dashboard"] })
    },
  })
}

export function useOnboardingProgress(empId: string) {
  return useQuery({
    queryKey: ["hr", "onboarding", "employees", empId, "progress"],
    queryFn: async () => {
      const { data } = await api.get<OnboardingProgress>(
        `/hr/onboarding/employees/${empId}/progress`
      )
      return data
    },
    enabled: Boolean(empId),
  })
}

export function useOnboardingDashboard() {
  return useQuery({
    queryKey: ["hr", "onboarding", "dashboard"],
    queryFn: async () => {
      const { data } = await api.get<Record<string, unknown>>("/hr/onboarding/dashboard")
      return data
    },
  })
}

// ─── Buddy Assignment Hooks ───────────────────────────────────────────────────

export function useBuddyAssignments() {
  return useQuery({
    queryKey: ["hr", "onboarding", "buddies"],
    queryFn: async () => {
      const { data } = await api.get<BuddyAssignment[]>("/hr/onboarding/buddies")
      return data
    },
  })
}

export function useCreateBuddyAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      payload: Omit<BuddyAssignment, "id" | "is_active">
    ) => {
      const { data } = await api.post<BuddyAssignment>("/hr/onboarding/buddies", payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "buddies"] })
    },
  })
}

export function useDeactivateBuddy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/onboarding/buddies/${id}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "onboarding", "buddies"] })
    },
  })
}
