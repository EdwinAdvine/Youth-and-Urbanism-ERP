/**
 * HR Extended API client — employee documents, training records, performance
 * reviews, benefits, org chart, and workforce capacity planning.
 *
 * Exports TanStack Query hooks and Axios helper functions for extended HR
 * features. All requests go through `client.ts` (Axios instance with auth
 * interceptors). Backend prefix: `/api/v1/hr`.
 *
 * Key exports:
 *   - useEmployeeDocuments() / useUploadEmployeeDocument() — document vault per employee
 *   - useTrainings() / useCreateTraining() — corporate training session management
 *   - useTrainingAttendees() / useAddTrainingAttendee() — attendee enrolment
 *   - usePerformanceReviews() / useCreatePerformanceReview() — periodic review records
 *   - useEmployeeBenefits() / useAssignBenefit() — benefits administration
 *   - useOrgChart() — hierarchical org chart data
 *   - useWorkforceCapacity() — utilisation and capacity planning metrics
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeDocument {
  id: string
  employee_id: string
  doc_type: string
  file_id: string | null
  file_name: string
  expiry_date: string | null
  uploaded_by: string
  created_at: string
  updated_at: string
}

export interface Training {
  id: string
  name: string
  description: string | null
  date: string
  trainer: string | null
  duration_hours: number
  cost: number | null
  status: string
  created_at: string
  updated_at: string
}

export interface TrainingAttendee {
  id: string
  training_id: string
  employee_id: string
  employee_name: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface PerformanceReview {
  id: string
  employee_id: string
  reviewer_id: string
  period: string
  rating: number
  goals: Record<string, unknown> | null
  strengths: string | null
  areas_for_improvement: string | null
  status: string
  comments: string | null
  created_at: string
  updated_at: string
}

export interface Benefit {
  id: string
  employee_id: string
  benefit_type: string
  amount: number
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Overtime {
  id: string
  employee_id: string
  overtime_date: string
  hours: number
  rate_multiplier: number
  status: string
  approver_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface HeadcountReport {
  total_headcount: number
  by_department: { department: string; count: number }[]
}

export interface AttritionReport {
  year: number
  terminated: number
  active_employees: number
  attrition_rate_pct: number
}

export interface LeaveBalanceReport {
  year: number
  total_employees: number
  balances: {
    employee_id: string
    employee_number: string
    job_title: string | null
    annual_allocation: number
    used: number
    remaining: number
  }[]
}

export interface OrgChartNode {
  id: string | null
  name: string
  description: string | null
  head_id: string | null
  parent_id: string | null
  employees: {
    id: string
    employee_number: string
    job_title: string | null
    employment_type: string | null
  }[]
  children: OrgChartNode[]
}

export interface HRDashboardKPIs {
  total_employees: number
  on_leave_today: number
  avg_salary: number
  attrition_rate_pct: number
  terminated_this_year: number
}

export interface BulkImportResult {
  created: number
  skipped: number
  errors: string[]
}

export interface EmployeeAvailability {
  employee_id: string
  employee_number: string
  range_start: string
  range_end: string
  availability_status: 'available' | 'busy' | 'overloaded' | 'on_leave'
  on_leave_today: boolean
  leave_periods: {
    leave_type: string
    start_date: string
    end_date: string
    days_in_range: number
  }[]
  total_leave_days: number
  business_days: number
  available_days: number
  active_tasks: number
  logged_hours: number
  capacity_hours: number
  utilization_pct: number
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedDocuments {
  total: number
  documents: EmployeeDocument[]
}

export interface PaginatedTrainings {
  total: number
  trainings: Training[]
}

export interface PaginatedAttendees {
  total: number
  attendees: TrainingAttendee[]
}

export interface PaginatedReviews {
  total: number
  reviews: PerformanceReview[]
}

export interface PaginatedBenefits {
  total: number
  benefits: Benefit[]
}

export interface PaginatedOvertime {
  total: number
  overtime: Overtime[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateEmployeeDocumentPayload {
  doc_type: string
  file_id?: string
  file_name: string
  expiry_date?: string
}

export interface CreateTrainingPayload {
  name: string
  description?: string
  date: string
  trainer?: string
  duration_hours?: number
  cost?: number
  status?: string
}

export interface UpdateTrainingPayload {
  name?: string
  description?: string
  date?: string
  trainer?: string
  duration_hours?: number
  cost?: number
  status?: string
}

export interface CreateTrainingAttendeePayload {
  employee_id: string
  status?: string
}

export interface CreatePerformanceReviewPayload {
  employee_id: string
  period: string
  rating: number
  goals?: Record<string, unknown>
  strengths?: string
  areas_for_improvement?: string
  comments?: string
}

export interface UpdatePerformanceReviewPayload {
  period?: string
  rating?: number
  goals?: Record<string, unknown>
  strengths?: string
  areas_for_improvement?: string
  status?: string
  comments?: string
}

export interface CreateBenefitPayload {
  employee_id: string
  benefit_type: string
  amount: number
  start_date: string
  end_date?: string
}

export interface UpdateBenefitPayload {
  benefit_type?: string
  amount?: number
  start_date?: string
  end_date?: string
  is_active?: boolean
}

export interface CreateOvertimePayload {
  employee_id: string
  overtime_date: string
  hours: number
  rate_multiplier?: number
  notes?: string
}

// ─── Employee Documents ───────────────────────────────────────────────────────

export function useEmployeeDocuments(employeeId: string) {
  return useQuery({
    queryKey: ['hr', 'employees', employeeId, 'documents'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedDocuments>(`/hr/employees/${employeeId}/documents`)
      return data
    },
    enabled: !!employeeId,
  })
}

export function useCreateEmployeeDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, ...payload }: CreateEmployeeDocumentPayload & { employeeId: string }) => {
      const { data } = await apiClient.post<EmployeeDocument>(`/hr/employees/${employeeId}/documents`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'employees', variables.employeeId, 'documents'] })
    },
  })
}

export function useDeleteEmployeeDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, docId }: { employeeId: string; docId: string }) => {
      await apiClient.delete(`/hr/employees/${employeeId}/documents/${docId}`)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'employees', variables.employeeId, 'documents'] })
    },
  })
}

// ─── Training ─────────────────────────────────────────────────────────────────

export function useTrainings(params: { status?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['hr', 'training', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedTrainings>('/hr/training', { params })
      return data
    },
  })
}

export function useTraining(trainingId: string) {
  return useQuery({
    queryKey: ['hr', 'training', trainingId],
    queryFn: async () => {
      const { data } = await apiClient.get<Training>(`/hr/training/${trainingId}`)
      return data
    },
    enabled: !!trainingId,
  })
}

export function useCreateTraining() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTrainingPayload) => {
      const { data } = await apiClient.post<Training>('/hr/training', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'training'] }),
  })
}

export function useUpdateTraining() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTrainingPayload & { id: string }) => {
      const { data } = await apiClient.put<Training>(`/hr/training/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'training'] }),
  })
}

export function useTrainingAttendees(trainingId: string) {
  return useQuery({
    queryKey: ['hr', 'training', trainingId, 'attendees'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedAttendees>(`/hr/training/${trainingId}/attendees`)
      return data
    },
    enabled: !!trainingId,
  })
}

export function useAddTrainingAttendee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ trainingId, ...payload }: CreateTrainingAttendeePayload & { trainingId: string }) => {
      const { data } = await apiClient.post<TrainingAttendee>(`/hr/training/${trainingId}/attendees`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'training', variables.trainingId, 'attendees'] })
    },
  })
}

// ─── Performance Reviews ──────────────────────────────────────────────────────

export function usePerformanceReviews(params: { employee_id?: string; status?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['hr', 'performance-reviews', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedReviews>('/hr/performance-reviews', { params })
      return data
    },
  })
}

export function usePerformanceReview(reviewId: string) {
  return useQuery({
    queryKey: ['hr', 'performance-reviews', reviewId],
    queryFn: async () => {
      const { data } = await apiClient.get<PerformanceReview>(`/hr/performance-reviews/${reviewId}`)
      return data
    },
    enabled: !!reviewId,
  })
}

export function useCreatePerformanceReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePerformanceReviewPayload) => {
      const { data } = await apiClient.post<PerformanceReview>('/hr/performance-reviews', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'performance-reviews'] }),
  })
}

export function useUpdatePerformanceReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePerformanceReviewPayload & { id: string }) => {
      const { data } = await apiClient.put<PerformanceReview>(`/hr/performance-reviews/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'performance-reviews'] }),
  })
}

// ─── Benefits ─────────────────────────────────────────────────────────────────

export function useBenefits(params: { employee_id?: string; benefit_type?: string; is_active?: boolean; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['hr', 'benefits', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedBenefits>('/hr/benefits', { params })
      return data
    },
  })
}

export function useBenefit(benefitId: string) {
  return useQuery({
    queryKey: ['hr', 'benefits', benefitId],
    queryFn: async () => {
      const { data } = await apiClient.get<Benefit>(`/hr/benefits/${benefitId}`)
      return data
    },
    enabled: !!benefitId,
  })
}

export function useCreateBenefit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateBenefitPayload) => {
      const { data } = await apiClient.post<Benefit>('/hr/benefits', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'benefits'] }),
  })
}

export function useUpdateBenefit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateBenefitPayload & { id: string }) => {
      const { data } = await apiClient.put<Benefit>(`/hr/benefits/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'benefits'] }),
  })
}

// ─── Overtime ─────────────────────────────────────────────────────────────────

export function useOvertimeRecords(params: { employee_id?: string; status?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['hr', 'overtime', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedOvertime>('/hr/overtime', { params })
      return data
    },
  })
}

export function useCreateOvertime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateOvertimePayload) => {
      const { data } = await apiClient.post<Overtime>('/hr/overtime', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'overtime'] }),
  })
}

export function useApproveOvertime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (overtimeId: string) => {
      const { data } = await apiClient.put<Overtime>(`/hr/overtime/${overtimeId}/approve`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'overtime'] }),
  })
}

export function useRejectOvertime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (overtimeId: string) => {
      const { data } = await apiClient.put<Overtime>(`/hr/overtime/${overtimeId}/reject`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'overtime'] }),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useHeadcountReport() {
  return useQuery({
    queryKey: ['hr', 'reports', 'headcount'],
    queryFn: async () => {
      const { data } = await apiClient.get<HeadcountReport>('/hr/reports/headcount')
      return data
    },
  })
}

export function useAttritionReport(params: { year?: number } = {}) {
  return useQuery({
    queryKey: ['hr', 'reports', 'attrition', params],
    queryFn: async () => {
      const { data } = await apiClient.get<AttritionReport>('/hr/reports/attrition', { params })
      return data
    },
  })
}

export function useLeaveBalanceReport() {
  return useQuery({
    queryKey: ['hr', 'reports', 'leave-balance'],
    queryFn: async () => {
      const { data } = await apiClient.get<LeaveBalanceReport>('/hr/reports/leave-balance')
      return data
    },
  })
}

// ─── Org Chart ────────────────────────────────────────────────────────────────

export function useOrgChart() {
  return useQuery({
    queryKey: ['hr', 'org-chart'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ org_chart: OrgChartNode[] }>('/hr/org-chart')
      return data
    },
  })
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export function useHRDashboardKPIs() {
  return useQuery({
    queryKey: ['hr', 'dashboard', 'kpis'],
    queryFn: async () => {
      const { data } = await apiClient.get<HRDashboardKPIs>('/hr/dashboard/kpis')
      return data
    },
  })
}

// ─── Attendance Bulk Import ───────────────────────────────────────────────────

// ─── Employee Availability ────────────────────────────────────────────────────

export function useEmployeeAvailability(
  employeeId: string,
  params: { start_date?: string; end_date?: string } = {},
) {
  return useQuery({
    queryKey: ['hr', 'employees', employeeId, 'availability', params],
    queryFn: async () => {
      const { data } = await apiClient.get<EmployeeAvailability>(
        `/hr/employees/${employeeId}/availability`,
        { params },
      )
      return data
    },
    enabled: !!employeeId,
  })
}

// ─── Attendance Bulk Import ───────────────────────────────────────────────────

export function useBulkImportAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<BulkImportResult>('/hr/attendance/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'attendance'] }),
  })
}
