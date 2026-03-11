import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface OperatorSkill {
  id: string
  employee_id: string
  skill_name: string
  proficiency_level: string
  certification_number: string | null
  certified_date: string | null
  expiry_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface SkillCreate {
  employee_id: string
  skill_name: string
  proficiency_level?: string
  certification_number?: string
  certified_date?: string
  expiry_date?: string
  notes?: string
}

export interface SkillsMatrix {
  employees: Record<string, Record<string, { proficiency_level: string; expiry_date: string | null }>>
  skills: string[]
}

export interface ExpiringCert {
  id: string
  employee_id: string
  skill_name: string
  proficiency_level: string
  certification_number: string | null
  expiry_date: string | null
  days_until_expiry: number | null
  expired: boolean
}

export interface CrewAssignment {
  id: string
  work_order_id: string
  workstation_id: string
  employee_id: string
  shift: string
  assignment_date: string
  start_time: string | null
  end_time: string | null
  role: string
  hours_worked: number
  timesheet_pushed: boolean
  created_at: string
}

export interface CrewAssignmentCreate {
  work_order_id: string
  workstation_id: string
  employee_id: string
  shift: string
  assignment_date: string
  role?: string
  start_time?: string
  end_time?: string
}

// Operator Skills
export const useOperatorSkills = (employeeId?: string, skillName?: string) =>
  useQuery({
    queryKey: ['operator-skills', employeeId, skillName],
    queryFn: () =>
      apiClient
        .get<OperatorSkill[]>('/manufacturing/skills', {
          params: { employee_id: employeeId, skill_name: skillName },
        })
        .then(r => r.data),
  })

export const useCreateSkill = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SkillCreate) =>
      apiClient.post<OperatorSkill>('/manufacturing/skills', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operator-skills'] }),
  })
}

export const useUpdateSkill = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OperatorSkill> }) =>
      apiClient.put<OperatorSkill>(`/manufacturing/skills/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operator-skills'] }),
  })
}

export const useDeleteSkill = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/manufacturing/skills/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operator-skills'] }),
  })
}

export const useSkillsMatrix = () =>
  useQuery({
    queryKey: ['skills-matrix'],
    queryFn: () => apiClient.get<SkillsMatrix>('/manufacturing/skills/matrix').then(r => r.data),
  })

export const useExpiringCertifications = (days = 30) =>
  useQuery({
    queryKey: ['expiring-certs', days],
    queryFn: () =>
      apiClient.get<ExpiringCert[]>('/manufacturing/skills/expiring', { params: { days } }).then(r => r.data),
  })

// Crew Assignments
export const useCrewAssignments = (params?: {
  work_order_id?: string
  workstation_id?: string
  employee_id?: string
  assignment_date?: string
}) =>
  useQuery({
    queryKey: ['crew-assignments', params],
    queryFn: () =>
      apiClient.get<CrewAssignment[]>('/manufacturing/crew', { params }).then(r => r.data),
  })

export const useCrewSchedule = (dateFrom?: string, dateTo?: string, workstationId?: string) =>
  useQuery({
    queryKey: ['crew-schedule', dateFrom, dateTo, workstationId],
    queryFn: () =>
      apiClient
        .get<Record<string, CrewAssignment[]>>('/manufacturing/crew/schedule', {
          params: { date_from: dateFrom, date_to: dateTo, workstation_id: workstationId },
        })
        .then(r => r.data),
  })

export const useCreateCrewAssignment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CrewAssignmentCreate) =>
      apiClient.post<CrewAssignment>('/manufacturing/crew', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crew-assignments'] })
      qc.invalidateQueries({ queryKey: ['crew-schedule'] })
    },
  })
}

export const useLogHours = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      hours_worked,
      start_time,
      end_time,
    }: {
      id: string
      hours_worked: number
      start_time?: string
      end_time?: string
    }) =>
      apiClient
        .post<CrewAssignment>(`/manufacturing/crew/${id}/log-hours`, { hours_worked, start_time, end_time })
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crew-assignments'] }),
  })
}

export const usePushTimesheet = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assignment_ids: string[]) =>
      apiClient.post('/manufacturing/crew/push-timesheet', { assignment_ids }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crew-assignments'] }),
  })
}
