import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  employee_number: string
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
      const { data } = await apiClient.get<PaginatedResponse<Employee>>('/hr/employees', { params })
      return data
    },
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
  })
}

export function useMyEmployeeProfile() {
  return useQuery({
    queryKey: ['hr', 'employees', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<Employee>('/hr/employees/me')
      return data
    },
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

// ─── Leave Requests ───────────────────────────────────────────────────────────

export function useLeaveRequests(params: { page?: number; limit?: number; status?: LeaveStatus; employee_id?: string }) {
  return useQuery({
    queryKey: ['hr', 'leave-requests', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<LeaveRequest>>('/hr/leave-requests', { params })
      return data
    },
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
  })
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export function useAttendance(params: { page?: number; limit?: number; employee_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['hr', 'attendance', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<AttendanceRecord>>('/hr/attendance', { params })
      return data
    },
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
      const { data } = await apiClient.get<PaginatedResponse<Payslip>>('/hr/payslips', { params })
      return data
    },
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
