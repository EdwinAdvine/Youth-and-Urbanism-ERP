/**
 * HR ATS API client — applicant tracking system covering job requisitions,
 * candidate profiles, applications, interviews, and offer letters.
 *
 * Exports TanStack Query hooks and Axios helper functions for the HR Applicant
 * Tracking System. All requests go through `client.ts` (Axios instance with
 * auth interceptors). Backend prefix: `/api/v1/hr`.
 *
 * Key exports:
 *   - useJobRequisitions() / useCreateRequisition() — open role management
 *   - useCandidates() / useCandidate() — candidate profiles with AI resume summary
 *   - useCreateCandidate() / useUpdateCandidate() — candidate mutations
 *   - useCandidateApplications() / useCreateApplication() — application pipeline
 *   - useAdvanceApplicationStage() / useRejectApplication() — stage progression
 *   - useInterviews() / useScheduleInterview() — interview scheduling
 *   - useOfferLetters() / useCreateOfferLetter() — offer generation and tracking
 *
 * Note: candidate AI summary (ai_summary) is populated server-side on resume upload.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobRequisition {
  id: string
  title: string
  department_id: string | null
  hiring_manager_id: string | null
  job_type: 'full_time' | 'part_time' | 'contract' | 'intern'
  location: string | null
  remote_policy: 'onsite' | 'hybrid' | 'remote'
  salary_min: number | null
  salary_max: number | null
  currency: string
  headcount: number
  description: string | null
  requirements: string | null
  skills_required: string[] | null
  status: 'draft' | 'open' | 'on_hold' | 'filled' | 'cancelled'
  published_at: string | null
  target_hire_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Candidate {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  linkedin_url: string | null
  resume_file_id: string | null
  resume_file_name: string | null
  skills_extracted: string[] | null
  ai_summary: string | null
  source: string | null
  is_blacklisted: boolean
  notes: string | null
  created_at: string
}

export interface CandidateApplication {
  id: string
  candidate_id: string
  requisition_id: string
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
  ai_match_score: number | null
  ai_match_notes: string | null
  rejection_reason: string | null
  offer_amount: number | null
  notes: string | null
  assigned_to: string | null
  created_at: string
  candidate?: Candidate
  requisition?: JobRequisition
  interviews?: Interview[]
}

export interface Interview {
  id: string
  application_id: string
  interview_type: 'video' | 'phone' | 'in_person' | 'technical' | 'panel'
  scheduled_at: string
  duration_minutes: number
  interviewer_ids: string[] | null
  meeting_url: string | null
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  feedback: string | null
  rating: number | null
  recommendation: 'advance' | 'reject' | 'hold' | null
}

export interface ATSDashboard {
  open_requisitions: number
  total_candidates: number
  applications_by_stage: Record<string, number>
  avg_time_to_hire_days: number
  interviews_this_week: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateRequisitionPayload {
  title: string
  department_id?: string | null
  hiring_manager_id?: string | null
  job_type: JobRequisition['job_type']
  location?: string | null
  remote_policy?: JobRequisition['remote_policy']
  salary_min?: number | null
  salary_max?: number | null
  currency?: string
  headcount?: number
  description?: string | null
  requirements?: string | null
  skills_required?: string[] | null
  target_hire_date?: string | null
}

export interface UpdateRequisitionPayload extends Partial<CreateRequisitionPayload> {
  id: string
}

export interface CreateCandidatePayload {
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  linkedin_url?: string | null
  resume_file_id?: string | null
  resume_file_name?: string | null
  skills_extracted?: string[] | null
  source?: string | null
  notes?: string | null
}

export interface UpdateCandidatePayload extends Partial<Omit<CreateCandidatePayload, 'email'>> {
  id: string
}

export interface CreateApplicationPayload {
  candidate_id: string
  requisition_id: string
  stage?: CandidateApplication['stage']
  notes?: string | null
  assigned_to?: string | null
}

export interface UpdateApplicationStagePayload {
  stage: CandidateApplication['stage']
  notes?: string | null
  rejection_reason?: string | null
}

export interface CreateInterviewPayload {
  application_id: string
  interview_type: Interview['interview_type']
  scheduled_at: string
  duration_minutes?: number
  interviewer_ids?: string[] | null
  meeting_url?: string | null
}

export interface SubmitInterviewFeedbackPayload {
  feedback: string
  rating: number
  recommendation: Interview['recommendation']
  status: Interview['status']
}

// ─── Requisitions ─────────────────────────────────────────────────────────────

export function useRequisitions(params?: {
  status?: JobRequisition['status']
  department_id?: string
  search?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['hr', 'ats', 'requisitions', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<JobRequisition>>('/hr/requisitions', { params })
      return data
    },
  })
}

export function useRequisition(id: string) {
  return useQuery({
    queryKey: ['hr', 'ats', 'requisitions', id],
    queryFn: async () => {
      const { data } = await apiClient.get<JobRequisition>(`/hr/requisitions/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateRequisitionPayload) => {
      const { data } = await apiClient.post<JobRequisition>('/hr/requisitions', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'ats', 'requisitions'] }),
  })
}

export function useUpdateRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRequisitionPayload) => {
      const { data } = await apiClient.put<JobRequisition>(`/hr/requisitions/${id}`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'requisitions'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'requisitions', variables.id] })
    },
  })
}

export function usePublishRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<JobRequisition>(`/hr/requisitions/${id}/publish`)
      return data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'requisitions'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'requisitions', id] })
    },
  })
}

export function useCloseRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<JobRequisition>(`/hr/requisitions/${id}/close`)
      return data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'requisitions'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'requisitions', id] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'dashboard'] })
    },
  })
}

export function useRequisitionPipeline(id: string) {
  return useQuery({
    queryKey: ['hr', 'ats', 'requisitions', id, 'pipeline'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ stages: Record<string, CandidateApplication[]> }>(
        `/hr/requisitions/${id}/pipeline`,
      )
      return data
    },
    enabled: !!id,
  })
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export function useCandidates(params?: {
  search?: string
  is_blacklisted?: boolean
  source?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['hr', 'ats', 'candidates', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Candidate>>('/hr/candidates', { params })
      return data
    },
  })
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: ['hr', 'ats', 'candidates', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Candidate>(`/hr/candidates/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCandidatePayload) => {
      const { data } = await apiClient.post<Candidate>('/hr/candidates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'ats', 'candidates'] }),
  })
}

export function useUpdateCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCandidatePayload) => {
      const { data } = await apiClient.put<Candidate>(`/hr/candidates/${id}`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'candidates'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'candidates', variables.id] })
    },
  })
}

export function useBlacklistCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Candidate>(`/hr/candidates/${id}/blacklist`)
      return data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'candidates'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'candidates', id] })
    },
  })
}

export function useAIScreenCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidate_id, requisition_id }: { candidate_id: string; requisition_id: string }) => {
      const { data } = await apiClient.post<{ ai_match_score: number; ai_match_notes: string; ai_summary: string }>(
        `/hr/candidates/${candidate_id}/ai-screen`,
        { requisition_id },
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'candidates', variables.candidate_id] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'applications'] })
    },
  })
}

// ─── Applications ─────────────────────────────────────────────────────────────

export function useApplications(params?: {
  requisition_id?: string
  stage?: CandidateApplication['stage']
  assigned_to?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['hr', 'ats', 'applications', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<CandidateApplication>>('/hr/applications', { params })
      return data
    },
  })
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: ['hr', 'ats', 'applications', id],
    queryFn: async () => {
      const { data } = await apiClient.get<CandidateApplication>(`/hr/applications/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateApplicationPayload) => {
      const { data } = await apiClient.post<CandidateApplication>('/hr/applications', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'applications'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'dashboard'] })
    },
  })
}

export function useUpdateApplicationStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateApplicationStagePayload & { id: string }) => {
      const { data } = await apiClient.put<CandidateApplication>(`/hr/applications/${id}/stage`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'applications'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'applications', variables.id] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'dashboard'] })
    },
  })
}

export function useAssignApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id }: { id: string; user_id: string }) => {
      const { data } = await apiClient.put<CandidateApplication>(`/hr/applications/${id}/assign`, { user_id })
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'applications'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'applications', variables.id] })
    },
  })
}

export function useSetOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, offer_amount }: { id: string; offer_amount: number }) => {
      const { data } = await apiClient.put<CandidateApplication>(`/hr/applications/${id}/offer`, { offer_amount })
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'applications'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'applications', variables.id] })
    },
  })
}

// ─── Interviews ───────────────────────────────────────────────────────────────

export function useInterviews(params?: {
  application_id?: string
  status?: Interview['status']
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['hr', 'ats', 'interviews', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Interview>>('/hr/interviews', { params })
      return data
    },
  })
}

export function useCreateInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateInterviewPayload) => {
      const { data } = await apiClient.post<Interview>('/hr/interviews', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'interviews'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'dashboard'] })
    },
  })
}

export function useSubmitInterviewFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: SubmitInterviewFeedbackPayload & { id: string }) => {
      const { data } = await apiClient.put<Interview>(`/hr/interviews/${id}/feedback`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'interviews'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'applications'] })
    },
  })
}

export function useCancelInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Interview>(`/hr/interviews/${id}/cancel`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'interviews'] })
      qc.invalidateQueries({ queryKey: ['hr', 'ats', 'dashboard'] })
    },
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useATSDashboard() {
  return useQuery({
    queryKey: ['hr', 'ats', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<ATSDashboard>('/hr/ats/dashboard')
      return data
    },
  })
}

export function useATSDiversity() {
  return useQuery({
    queryKey: ['hr', 'ats', 'diversity'],
    queryFn: async () => {
      const { data } = await apiClient.get<Record<string, unknown>>('/hr/ats/diversity')
      return data
    },
  })
}
