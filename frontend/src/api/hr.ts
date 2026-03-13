/**
 * HR API client — employees, departments, leave requests, and attendance.
 *
 * Exports TanStack Query hooks and Axios helper functions for the core HR
 * module. All requests go through `client.ts` (Axios instance with auth
 * interceptors). Backend prefix: `/api/v1/hr`.
 *
 * Key exports:
 *   - useDepartments() / useCreateDepartment() — org-chart department management
 *   - useEmployees() / useEmployee() — employee roster with department/manager joins
 *   - useCreateEmployee() / useUpdateEmployee() — employee lifecycle mutations
 *   - useLeaveRequests() / useCreateLeaveRequest() — leave application and approval
 *   - useApproveLeave() / useRejectLeave() — manager approval workflow
 *   - useAttendance() / useClockIn() / useClockOut() — daily attendance tracking
 *   - usePayslips() — payroll slip history per employee
 *
 * Note: leave approval triggers an email notification via the Celery task queue.
 * Attendance clock-in/out is date-scoped per employee.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { REFERENCE_PRESET, LIST_PRESET, DETAIL_PRESET, DASHBOARD_PRESET } from '@/utils/queryDefaults'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Department {
  id: string
  name: string
  description: string
  head_id: string | null
  head_name?: string
  employee_count: number
  parent_id: string | null
  created_at: string
  updated_at: string
}

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'
export type LeaveType = 'annual' | 'sick' | 'personal' | 'maternity' | 'paternity' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'remote' | 'on_leave'

export interface Employee {
  id: string
  user_id: string
  employee_number: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  department_id: string | null
  department_name?: string
  job_title: string
  employment_type: EmploymentType
  hire_date: string
  salary: number | null
  is_active: boolean
  manager_id: string | null
  manager_name?: string
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export interface LeaveRequest {
  id: string
  employee_id: string
  employee_name?: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason: string
  status: LeaveStatus
  approved_by?: string | null
  approved_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface LeaveBalance {
  annual_allocation: number
  used_days: number
  remaining_days: number
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  employee_name?: string
  date: string
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  hours_worked: number | null
  notes: string | null
  created_at: string
}

export interface HRDashboardStats {
  total_employees: number
  on_leave_today: number
  attendance_rate: number
  open_leave_requests: number
  departments_count: number
  new_hires_this_month: number
}

export interface PaginatedResponse<T> {
  total: number
  items: T[]
}

export interface CreateDepartmentPayload {
  name: string
  description?: string
  head_id?: string | null
  parent_id?: string | null
}

export interface UpdateDepartmentPayload extends Partial<CreateDepartmentPayload> {
  id: string
}

export interface CreateEmployeePayload {
  user_id?: string
  employee_number?: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  department_id?: string | null
  job_title: string
  employment_type: EmploymentType
  hire_date: string
  salary?: number | null
  manager_id?: string | null
}

export interface UpdateEmployeePayload extends Partial<CreateEmployeePayload> {
  id: string
}

export interface CreateLeaveRequestPayload {
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason: string
}

// ─── Departments ──────────────────────────────────────────────────────────────

export function useDepartments() {
  return useQuery({
    queryKey: ['hr', 'departments'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; departments: Department[] }>('/hr/departments')
      return data.departments
    },
    ...REFERENCE_PRESET,
  })
}

export function useCreateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateDepartmentPayload) => {
      const { data } = await apiClient.post<Department>('/hr/departments', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'departments'] }),
  })
}

export function useUpdateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateDepartmentPayload) => {
      const { data } = await apiClient.put<Department>(`/hr/departments/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'departments'] }),
  })
}

export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/departments/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'departments'] }),
  })
}

// ─── Employees ────────────────────────────────────────────────────────────────

export function useEmployees(params: { page?: number; limit?: number; department_id?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: ['hr', 'employees', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/hr/employees', { params })
      return { total: data.total ?? 0, items: data.employees ?? data.items ?? [] } as PaginatedResponse<Employee>
    },
    ...LIST_PRESET,
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['hr', 'employees', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Employee>(`/hr/employees/${id}`)
      return data
    },
    enabled: !!id,
    ...DETAIL_PRESET,
  })
}

export function useMyEmployeeProfile() {
  return useQuery({
    queryKey: ['hr', 'employees', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<Employee>('/hr/employees/me')
      return data
    },
    ...DETAIL_PRESET,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateEmployeePayload) => {
      const { data } = await apiClient.post<Employee>('/hr/employees', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'employees'] }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateEmployeePayload) => {
      const { data } = await apiClient.put<Employee>(`/hr/employees/${id}`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['hr', 'employees'] })
      qc.invalidateQueries({ queryKey: ['hr', 'employees', variables.id] })
    },
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/employees/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'employees'] })
      qc.invalidateQueries({ queryKey: ['hr', 'dashboard'] })
    },
  })
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

export function useLeaveRequests(params: { page?: number; limit?: number; status?: LeaveStatus; employee_id?: string }) {
  return useQuery({
    queryKey: ['hr', 'leave-requests', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/hr/leave-requests', { params })
      return { total: data.total ?? 0, items: data.leave_requests ?? data.items ?? [] } as PaginatedResponse<LeaveRequest>
    },
    ...LIST_PRESET,
  })
}

export function useCreateLeaveRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateLeaveRequestPayload) => {
      const { data } = await apiClient.post<LeaveRequest>('/hr/leave-requests', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'leave-requests'] }),
  })
}

export function useApproveLeaveRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<LeaveRequest>(`/hr/leave-requests/${id}/approve`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'leave-requests'] }),
  })
}

export function useRejectLeaveRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<LeaveRequest>(`/hr/leave-requests/${id}/reject`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'leave-requests'] }),
  })
}

// ─── Leave Balance ────────────────────────────────────────────────────────────

export function useLeaveBalance(employeeId: string) {
  return useQuery({
    queryKey: ['hr', 'leave-balance', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get<LeaveBalance>(`/hr/leave-balance/${employeeId}`)
      return data
    },
    enabled: !!employeeId,
    ...DETAIL_PRESET,
  })
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export function useAttendance(params: { page?: number; limit?: number; employee_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['hr', 'attendance', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/hr/attendance', { params })
      return { total: data.total ?? 0, items: data.attendance ?? data.records ?? data.items ?? [] } as PaginatedResponse<AttendanceRecord>
    },
    ...LIST_PRESET,
  })
}

export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<AttendanceRecord>('/hr/attendance/check-in')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'attendance'] }),
  })
}

export function useCheckOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.put<AttendanceRecord>('/hr/attendance/check-out')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'attendance'] }),
  })
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export function useHRDashboardStats() {
  return useQuery({
    queryKey: ['hr', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<HRDashboardStats>('/hr/dashboard/stats')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

// ─── Payroll Types ────────────────────────────────────────────────────────────

export interface SalaryStructure {
  id: string
  name: string
  base_salary: number
  allowances: Record<string, number> | null
  deductions: Record<string, number> | null
  is_active: boolean
  created_at: string
}

export interface Payslip {
  id: string
  employee_id: string
  salary_structure_id: string | null
  period_start: string
  period_end: string
  gross_pay: number
  deductions_total: number
  net_pay: number
  status: string
  approved_by: string | null
  created_at: string
}

export interface CreateSalaryStructurePayload {
  name: string
  base_salary: number
  allowances?: Record<string, number> | null
  deductions?: Record<string, number> | null
  is_active?: boolean
}

export interface UpdateSalaryStructurePayload extends Partial<CreateSalaryStructurePayload> {
  id: string
}

export interface GeneratePayslipsPayload {
  period_start: string
  period_end: string
  salary_structure_id?: string | null
  employee_ids?: string[] | null
}

// ─── Salary Structures ────────────────────────────────────────────────────────

export function useSalaryStructures() {
  return useQuery({
    queryKey: ['hr', 'salary-structures'],
    queryFn: async () => {
      const { data } = await apiClient.get<SalaryStructure[]>('/hr/salary-structures')
      return data
    },
    ...REFERENCE_PRESET,
  })
}

export function useCreateSalaryStructure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSalaryStructurePayload) => {
      const { data } = await apiClient.post<SalaryStructure>('/hr/salary-structures', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'salary-structures'] }),
  })
}

export function useUpdateSalaryStructure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSalaryStructurePayload) => {
      const { data } = await apiClient.put<SalaryStructure>(`/hr/salary-structures/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'salary-structures'] }),
  })
}

export function useDeleteSalaryStructure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/salary-structures/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'salary-structures'] }),
  })
}

// ─── Payslips ─────────────────────────────────────────────────────────────────

export function usePayslips(params?: {
  status?: string
  period_start?: string
  period_end?: string
  employee_id?: string
}) {
  return useQuery({
    queryKey: ['hr', 'payslips', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/hr/payslips', { params })
      return { total: data.total ?? 0, items: data.payslips ?? data.items ?? [] } as PaginatedResponse<Payslip>
    },
    ...LIST_PRESET,
  })
}

export function usePayslipDetail(id: string) {
  return useQuery({
    queryKey: ['hr', 'payslips', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Payslip>(`/hr/payslips/${id}`)
      return data
    },
    enabled: !!id,
    ...DETAIL_PRESET,
  })
}

export function useGeneratePayslips() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: GeneratePayslipsPayload) => {
      const { data } = await apiClient.post<Payslip[]>('/hr/payslips/generate', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'payslips'] }),
  })
}

export function useApprovePayslip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Payslip>(`/hr/payslips/${id}/approve`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'payslips'] })
    },
  })
}

export function useMarkPayslipPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Payslip>(`/hr/payslips/${id}/mark-paid`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'payslips'] })
    },
  })
}

// ─── Tax Brackets ────────────────────────────────────────────────────────────

export interface TaxBracket {
  id: string
  name: string
  country_code: string
  min_amount: number
  max_amount: number | null
  rate: number
  effective_from: string
  created_at: string
  updated_at: string
}

export interface CreateTaxBracketPayload {
  name: string
  country_code?: string
  min_amount: number
  max_amount?: number | null
  rate: number
  effective_from: string
}

export interface UpdateTaxBracketPayload extends Partial<CreateTaxBracketPayload> {
  id: string
}

export function useTaxBrackets(countryCode?: string) {
  return useQuery({
    queryKey: ['hr', 'tax-brackets', countryCode],
    queryFn: async () => {
      const params = countryCode ? { country_code: countryCode } : {}
      const { data } = await apiClient.get<{ tax_brackets: TaxBracket[] }>('/hr/tax-brackets', { params })
      return data.tax_brackets
    },
    ...REFERENCE_PRESET,
  })
}

export function useCreateTaxBracket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTaxBracketPayload) => {
      const { data } = await apiClient.post<TaxBracket>('/hr/tax-brackets', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'tax-brackets'] }),
  })
}

export function useUpdateTaxBracket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTaxBracketPayload) => {
      const { data } = await apiClient.put<TaxBracket>(`/hr/tax-brackets/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'tax-brackets'] }),
  })
}

export function useDeleteTaxBracket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/tax-brackets/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'tax-brackets'] }),
  })
}

// ─── Statutory Deductions ────────────────────────────────────────────────────

export interface StatutoryDeduction {
  id: string
  name: string
  country_code: string
  calculation_type: 'percentage' | 'fixed'
  value: number
  max_amount: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateStatutoryDeductionPayload {
  name: string
  country_code?: string
  calculation_type: 'percentage' | 'fixed'
  value: number
  max_amount?: number | null
  is_active?: boolean
}

export interface UpdateStatutoryDeductionPayload extends Partial<CreateStatutoryDeductionPayload> {
  id: string
}

export function useStatutoryDeductions() {
  return useQuery({
    queryKey: ['hr', 'statutory-deductions'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ statutory_deductions: StatutoryDeduction[] }>('/hr/statutory-deductions')
      return data.statutory_deductions
    },
    ...REFERENCE_PRESET,
  })
}

export function useCreateStatutoryDeduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateStatutoryDeductionPayload) => {
      const { data } = await apiClient.post<StatutoryDeduction>('/hr/statutory-deductions', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'statutory-deductions'] }),
  })
}

export function useUpdateStatutoryDeduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateStatutoryDeductionPayload) => {
      const { data } = await apiClient.put<StatutoryDeduction>(`/hr/statutory-deductions/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'statutory-deductions'] }),
  })
}

export function useDeleteStatutoryDeduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/statutory-deductions/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'statutory-deductions'] }),
  })
}

// ─── Employee Documents ──────────────────────────────────────────────────────

export interface EmployeeDocument {
  id: string
  employee_id: string
  employee_name?: string
  document_type: string
  title: string
  file_url: string
  file_name: string
  file_size: number
  expiry_date: string | null
  notes: string | null
  uploaded_by: string | null
  uploaded_by_name?: string
  created_at: string
  updated_at: string
}

export function useEmployeeDocuments(employeeId: string) {
  return useQuery({
    queryKey: ['hr', 'employee-documents', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ documents: EmployeeDocument[] }>(`/hr/employees/${employeeId}/documents`)
      return data.documents
    },
    enabled: !!employeeId,
    ...LIST_PRESET,
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, formData }: { employeeId: string; formData: FormData }) => {
      const { data } = await apiClient.post<EmployeeDocument>(`/hr/employees/${employeeId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'employee-documents'] }),
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, documentId }: { employeeId: string; documentId: string }) => {
      await apiClient.delete(`/hr/employees/${employeeId}/documents/${documentId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'employee-documents'] }),
  })
}

// ─── Training ────────────────────────────────────────────────────────────────

export type TrainingStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface Training {
  id: string
  title: string
  description: string | null
  trainer: string | null
  start_date: string
  end_date: string
  location: string | null
  status: TrainingStatus
  max_attendees: number | null
  cost: number | null
  department_id: string | null
  department_name?: string
  attendee_count: number
  created_at: string
  updated_at: string
}

export interface TrainingAttendee {
  id: string
  training_id: string
  employee_id: string
  employee_name?: string
  status: 'registered' | 'attended' | 'absent' | 'cancelled'
  score: number | null
  feedback: string | null
  created_at: string
}

export interface CreateTrainingPayload {
  title: string
  description?: string
  trainer?: string
  start_date: string
  end_date: string
  location?: string
  status?: TrainingStatus
  max_attendees?: number
  cost?: number
  department_id?: string | null
}

export interface UpdateTrainingPayload extends Partial<CreateTrainingPayload> {
  id: string
}

export function useTrainings(params: { status?: TrainingStatus; department_id?: string } = {}) {
  return useQuery({
    queryKey: ['hr', 'trainings', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ trainings: Training[] }>('/hr/trainings', { params })
      return data.trainings
    },
    ...LIST_PRESET,
  })
}

export function useCreateTraining() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTrainingPayload) => {
      const { data } = await apiClient.post<Training>('/hr/trainings', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'trainings'] }),
  })
}

export function useUpdateTraining() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTrainingPayload) => {
      const { data } = await apiClient.put<Training>(`/hr/trainings/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'trainings'] }),
  })
}

export function useTrainingAttendees(trainingId: string) {
  return useQuery({
    queryKey: ['hr', 'trainings', trainingId, 'attendees'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ attendees: TrainingAttendee[] }>(`/hr/trainings/${trainingId}/attendees`)
      return data.attendees
    },
    enabled: !!trainingId,
    ...LIST_PRESET,
  })
}

export function useAddTrainingAttendee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ trainingId, employee_id }: { trainingId: string; employee_id: string }) => {
      const { data } = await apiClient.post<TrainingAttendee>(`/hr/trainings/${trainingId}/attendees`, { employee_id })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'trainings'] }),
  })
}

export function useRemoveTrainingAttendee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ trainingId, attendeeId }: { trainingId: string; attendeeId: string }) => {
      await apiClient.delete(`/hr/trainings/${trainingId}/attendees/${attendeeId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'trainings'] }),
  })
}

// ─── Performance Reviews ─────────────────────────────────────────────────────

export interface PerformanceReview {
  id: string
  employee_id: string
  employee_name?: string
  reviewer_id: string
  reviewer_name?: string
  review_period: string
  rating: number
  goals: string | null
  strengths: string | null
  areas_for_improvement: string | null
  comments: string | null
  status: 'draft' | 'submitted' | 'acknowledged'
  created_at: string
  updated_at: string
}

export interface CreatePerformanceReviewPayload {
  employee_id: string
  review_period: string
  rating: number
  goals?: string
  strengths?: string
  areas_for_improvement?: string
  comments?: string
  status?: 'draft' | 'submitted' | 'acknowledged'
}

export interface UpdatePerformanceReviewPayload extends Partial<Omit<CreatePerformanceReviewPayload, 'employee_id'>> {
  id: string
}

export function usePerformanceReviews(params: { employee_id?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['hr', 'performance-reviews', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ reviews: PerformanceReview[] }>('/hr/performance-reviews', { params })
      return data.reviews
    },
    ...LIST_PRESET,
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
    mutationFn: async ({ id, ...payload }: UpdatePerformanceReviewPayload) => {
      const { data } = await apiClient.put<PerformanceReview>(`/hr/performance-reviews/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'performance-reviews'] }),
  })
}

// ─── Benefits ────────────────────────────────────────────────────────────────

export type BenefitType = 'health' | 'dental' | 'vision' | 'life' | 'retirement' | 'other'

export interface Benefit {
  id: string
  employee_id: string
  employee_name?: string
  benefit_type: BenefitType
  provider: string | null
  plan_name: string
  coverage_start: string
  coverage_end: string | null
  employer_contribution: number
  employee_contribution: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateBenefitPayload {
  employee_id: string
  benefit_type: BenefitType
  provider?: string
  plan_name: string
  coverage_start: string
  coverage_end?: string
  employer_contribution: number
  employee_contribution: number
}

export interface UpdateBenefitPayload extends Partial<Omit<CreateBenefitPayload, 'employee_id'>> {
  id: string
  is_active?: boolean
}

export function useBenefits(params: { employee_id?: string; benefit_type?: BenefitType } = {}) {
  return useQuery({
    queryKey: ['hr', 'benefits', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ benefits: Benefit[] }>('/hr/benefits', { params })
      return data.benefits
    },
    ...LIST_PRESET,
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
    mutationFn: async ({ id, ...payload }: UpdateBenefitPayload) => {
      const { data } = await apiClient.put<Benefit>(`/hr/benefits/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'benefits'] }),
  })
}

// ─── Overtime ────────────────────────────────────────────────────────────────

export type OvertimeStatus = 'pending' | 'approved' | 'rejected'

export interface Overtime {
  id: string
  employee_id: string
  employee_name?: string
  date: string
  hours: number
  reason: string
  status: OvertimeStatus
  approved_by: string | null
  approved_by_name?: string
  rate_multiplier: number
  created_at: string
  updated_at: string
}

export interface CreateOvertimePayload {
  employee_id: string
  date: string
  hours: number
  reason: string
  rate_multiplier?: number
}

export function useOvertime(params: { employee_id?: string; status?: OvertimeStatus; date_from?: string; date_to?: string } = {}) {
  return useQuery({
    queryKey: ['hr', 'overtime', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ records: Overtime[] }>('/hr/overtime', { params })
      return data.records
    },
    ...LIST_PRESET,
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
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<Overtime>(`/hr/overtime/${id}/approve`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'overtime'] }),
  })
}

export function useRejectOvertime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<Overtime>(`/hr/overtime/${id}/reject`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'overtime'] }),
  })
}

// ─── Org Chart ───────────────────────────────────────────────────────────────

export interface OrgChartNode {
  id: string
  name: string
  job_title: string
  department_name: string | null
  avatar_url: string | null
  children: OrgChartNode[]
}

export function useOrgChart() {
  return useQuery({
    queryKey: ['hr', 'org-chart'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ nodes: OrgChartNode[] }>('/hr/org-chart')
      return data.nodes
    },
    ...REFERENCE_PRESET,
  })
}

// ─── HR Reports & KPIs ──────────────────────────────────────────────────────

export interface HRReportData {
  headcount_by_department: { department: string; count: number }[]
  headcount_by_type: { type: string; count: number }[]
  turnover_rate: number
  avg_tenure_months: number
  cost_by_department: { department: string; total_cost: number }[]
  leave_summary: { leave_type: string; total_days: number; count: number }[]
  payroll_summary: { period: string; gross: number; deductions: number; net: number }[]
  tax_summary: { tax_name: string; total: number }[]
}

export interface HRKPIs {
  total_employees: number
  active_employees: number
  avg_salary: number
  total_payroll_cost: number
  attrition_rate: number
  avg_leave_balance: number
  training_completion_rate: number
  overtime_hours_this_month: number
}

export function useHRReports(params: { period_start?: string; period_end?: string } = {}) {
  return useQuery({
    queryKey: ['hr', 'reports', params],
    queryFn: async () => {
      const { data } = await apiClient.get<HRReportData>('/hr/reports', { params })
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

export function useHRKPIs() {
  return useQuery({
    queryKey: ['hr', 'kpis'],
    queryFn: async () => {
      const { data } = await apiClient.get<HRKPIs>('/hr/kpis')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

// ─── Pay Runs ────────────────────────────────────────────────────────────────

export interface PayRun {
  id: string
  period_start: string
  period_end: string
  status: 'draft' | 'generated' | 'reviewed' | 'approved' | 'processed'
  total_gross: number
  total_deductions: number
  total_net: number
  created_by: string
  approved_by: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
  payslips?: { id: string; employee_id: string; gross_pay: string; deductions_total: string; net_pay: string; status: string }[]
}

export interface GeneratePayRunPayload {
  period_start: string
  period_end: string
  salary_structure_id?: string | null
  employee_ids?: string[] | null
}

export function usePayRuns(statusFilter?: string) {
  return useQuery({
    queryKey: ['hr', 'pay-runs', statusFilter],
    queryFn: async () => {
      const params = statusFilter ? { status: statusFilter } : {}
      const { data } = await apiClient.get<{ pay_runs: PayRun[] }>('/hr/pay-runs', { params })
      return data.pay_runs
    },
    ...LIST_PRESET,
  })
}

export function usePayRun(id: string) {
  return useQuery({
    queryKey: ['hr', 'pay-runs', id],
    queryFn: async () => {
      const { data } = await apiClient.get<PayRun>(`/hr/pay-runs/${id}`)
      return data
    },
    enabled: !!id,
    ...DETAIL_PRESET,
  })
}

export function useGeneratePayRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: GeneratePayRunPayload) => {
      const { data } = await apiClient.post('/hr/pay-runs/generate', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'pay-runs'] })
      qc.invalidateQueries({ queryKey: ['hr', 'payslips'] })
    },
  })
}

export function useApprovePayRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<PayRun>(`/hr/pay-runs/${id}/approve`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'pay-runs'] })
      qc.invalidateQueries({ queryKey: ['hr', 'payslips'] })
    },
  })
}

export function useProcessPayRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<PayRun>(`/hr/pay-runs/${id}/process`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'pay-runs'] })
      qc.invalidateQueries({ queryKey: ['hr', 'payslips'] })
    },
  })
}
