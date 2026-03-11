import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  question: string
  options: string[]
  correct_index: number
  points: number
}

export interface CourseModule {
  id: string
  course_id: string
  title: string
  module_type: 'video' | 'document' | 'quiz' | 'scorm'
  content_url: string | null
  duration_minutes: number
  quiz_questions: QuizQuestion[] | null
  order_index: number
  is_required: boolean
}

export interface Course {
  id: string
  title: string
  description: string | null
  category: string | null
  level: 'beginner' | 'intermediate' | 'advanced'
  duration_hours: number
  thumbnail_url: string | null
  skills_taught: string[] | null
  prerequisites: string[] | null
  is_mandatory: boolean
  is_published: boolean
  pass_score: number
  created_at: string
  modules?: CourseModule[]
  enrollment_count?: number
}

export interface CourseEnrollment {
  id: string
  course_id: string
  employee_id: string
  progress_pct: number
  quiz_score: number | null
  status: 'enrolled' | 'in_progress' | 'completed' | 'failed'
  started_at: string | null
  completed_at: string | null
  certificate_url: string | null
  modules_completed: string[] | null
  course?: Course
}

export interface Certification {
  id: string
  employee_id: string
  name: string
  issuer: string | null
  credential_id: string | null
  issue_date: string
  expiry_date: string | null
  course_id: string | null
  is_verified: boolean
}

export interface LMSDashboard {
  total_courses: number
  enrolled_employees: number
  completions_this_month: number
  avg_completion_pct: number
  top_courses: Array<{ course_id: string; title: string; enrollments: number }>
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateCoursePayload {
  title: string
  description?: string | null
  category?: string | null
  level?: Course['level']
  duration_hours?: number
  thumbnail_url?: string | null
  skills_taught?: string[] | null
  prerequisites?: string[] | null
  is_mandatory?: boolean
  is_published?: boolean
  pass_score?: number
}

export interface UpdateCoursePayload extends Partial<CreateCoursePayload> {
  id: string
}

export interface CreateCourseModulePayload {
  title: string
  module_type: CourseModule['module_type']
  content_url?: string | null
  duration_minutes?: number
  quiz_questions?: QuizQuestion[] | null
  order_index?: number
  is_required?: boolean
}

export interface UpdateCourseModulePayload extends Partial<CreateCourseModulePayload> {
  courseId: string
  moduleId: string
}

export interface CreateEnrollmentPayload {
  course_id: string
  employee_id?: string
}

export interface UpdateProgressPayload {
  module_id: string
  quiz_answers?: number[] | null
}

export interface CreateCertificationPayload {
  employee_id: string
  name: string
  issuer?: string | null
  credential_id?: string | null
  issue_date: string
  expiry_date?: string | null
  course_id?: string | null
}

export interface UpdateCertificationPayload extends Partial<Omit<CreateCertificationPayload, 'employee_id'>> {
  id: string
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export function useCourses(params?: {
  category?: string
  level?: Course['level']
  is_mandatory?: boolean
  is_published?: boolean
  search?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['hr', 'lms', 'courses', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: Course[]; total: number; page: number; limit: number }>(
        '/hr/courses',
        { params },
      )
      return data
    },
  })
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: ['hr', 'lms', 'courses', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Course>(`/hr/courses/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCoursePayload) => {
      const { data } = await apiClient.post<Course>('/hr/courses', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses'] }),
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCoursePayload) => {
      const { data } = await apiClient.put<Course>(`/hr/courses/${id}`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses'] })
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses', variables.id] })
    },
  })
}

export function useDeleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/courses/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses'] })
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'dashboard'] })
    },
  })
}

export function usePublishCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Course>(`/hr/courses/${id}/publish`)
      return data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses'] })
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses', id] })
    },
  })
}

export function useCourseLeaderboard(id: string) {
  return useQuery({
    queryKey: ['hr', 'lms', 'courses', id, 'leaderboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<
        Array<{ employee_id: string; employee_name: string; quiz_score: number; completed_at: string }>
      >(`/hr/courses/${id}/leaderboard`)
      return data
    },
    enabled: !!id,
  })
}

export function useRecommendedCourses() {
  return useQuery({
    queryKey: ['hr', 'lms', 'courses', 'recommended'],
    queryFn: async () => {
      const { data } = await apiClient.get<Course[]>('/hr/courses/recommended')
      return data
    },
  })
}

// ─── Course Modules ───────────────────────────────────────────────────────────

export function useCourseModules(courseId: string) {
  return useQuery({
    queryKey: ['hr', 'lms', 'courses', courseId, 'modules'],
    queryFn: async () => {
      const { data } = await apiClient.get<CourseModule[]>(`/hr/courses/${courseId}/modules`)
      return data
    },
    enabled: !!courseId,
  })
}

export function useCreateCourseModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ courseId, ...payload }: CreateCourseModulePayload & { courseId: string }) => {
      const { data } = await apiClient.post<CourseModule>(`/hr/courses/${courseId}/modules`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses', variables.courseId, 'modules'] })
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses', variables.courseId] })
    },
  })
}

export function useUpdateCourseModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ courseId, moduleId, ...payload }: UpdateCourseModulePayload) => {
      const { data } = await apiClient.put<CourseModule>(`/hr/courses/${courseId}/modules/${moduleId}`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses', variables.courseId, 'modules'] })
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses', variables.courseId] })
    },
  })
}

export function useDeleteCourseModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ courseId, moduleId }: { courseId: string; moduleId: string }) => {
      await apiClient.delete(`/hr/courses/${courseId}/modules/${moduleId}`)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses', variables.courseId, 'modules'] })
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'courses', variables.courseId] })
    },
  })
}

// ─── Enrollments ──────────────────────────────────────────────────────────────

export function useEnrollments(params?: {
  course_id?: string
  employee_id?: string
  status?: CourseEnrollment['status']
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['hr', 'lms', 'enrollments', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: CourseEnrollment[]; total: number; page: number; limit: number }>(
        '/hr/enrollments',
        { params },
      )
      return data
    },
  })
}

export function useCreateEnrollment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateEnrollmentPayload) => {
      const { data } = await apiClient.post<CourseEnrollment>('/hr/enrollments', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'enrollments'] })
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'dashboard'] })
    },
  })
}

export function useUpdateProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ enrollmentId, ...payload }: UpdateProgressPayload & { enrollmentId: string }) => {
      const { data } = await apiClient.post<CourseEnrollment>(`/hr/enrollments/${enrollmentId}/progress`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'enrollments'] })
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'learning-path'] })
      // Invalidate specific enrollment if it was fetched directly
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'enrollments', variables.enrollmentId] })
    },
  })
}

export function useEmployeeLearningPath(empId: string) {
  return useQuery({
    queryKey: ['hr', 'lms', 'learning-path', empId],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        enrolled: CourseEnrollment[]
        recommended: Course[]
        completed: CourseEnrollment[]
      }>(`/hr/employees/${empId}/learning-path`)
      return data
    },
    enabled: !!empId,
  })
}

export function useLMSDashboard() {
  return useQuery({
    queryKey: ['hr', 'lms', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<LMSDashboard>('/hr/lms/dashboard')
      return data
    },
  })
}

// ─── Certifications ───────────────────────────────────────────────────────────

export function useCertifications(params?: {
  employee_id?: string
  expiring_soon?: boolean
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['hr', 'lms', 'certifications', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: Certification[]; total: number; page: number; limit: number }>(
        '/hr/certifications',
        { params },
      )
      return data
    },
  })
}

export function useExpiringCertifications() {
  return useQuery({
    queryKey: ['hr', 'lms', 'certifications', 'expiring'],
    queryFn: async () => {
      const { data } = await apiClient.get<Certification[]>('/hr/certifications/expiring')
      return data
    },
  })
}

export function useCreateCertification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCertificationPayload) => {
      const { data } = await apiClient.post<Certification>('/hr/certifications', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'certifications'] })
    },
  })
}

export function useUpdateCertification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCertificationPayload) => {
      const { data } = await apiClient.put<Certification>(`/hr/certifications/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'certifications'] })
    },
  })
}

export function useDeleteCertification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/certifications/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'lms', 'certifications'] })
    },
  })
}
