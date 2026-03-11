import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface CapacitySlot {
  id: string
  workstation_id: string
  slot_date: string
  shift: string
  total_minutes: number
  allocated_minutes: number
  status: string
}

export interface CapacitySlotCreate {
  workstation_id: string
  slot_date: string
  shift: string
  total_minutes: number
}

export interface WorkstationCapacity {
  workstation_id: string
  weeks: number
  total_minutes: number
  allocated_minutes: number
  utilization_percent: number
  slots: CapacitySlot[]
}

export interface RoughCutRow {
  workstation_id: string
  capacity_minutes: number
  allocated_minutes: number
  demand_minutes: number
  free_minutes: number
  overloaded: boolean
}

export interface ScheduleEntry {
  id: string
  work_order_id: string
  routing_step_id: string | null
  workstation_id: string
  scheduled_start: string
  scheduled_end: string
  actual_start: string | null
  actual_end: string | null
  status: string
  sequence: number
}

export interface ProductionScenario {
  id: string
  name: string
  description: string | null
  status: string
  parameters: Record<string, unknown> | null
  results: Record<string, unknown> | null
  created_by: string
  created_at: string
}

export interface ScenarioCreate {
  name: string
  description?: string
  parameters?: Record<string, unknown>
}

// Capacity Slots
export const useCapacitySlots = (workstationId?: string, dateFrom?: string, dateTo?: string) =>
  useQuery({
    queryKey: ['capacity-slots', workstationId, dateFrom, dateTo],
    queryFn: () =>
      apiClient
        .get<CapacitySlot[]>('/manufacturing/capacity-slots', {
          params: { workstation_id: workstationId, date_from: dateFrom, date_to: dateTo },
        })
        .then(r => r.data),
  })

export const useCreateCapacitySlot = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CapacitySlotCreate) =>
      apiClient.post<CapacitySlot>('/manufacturing/capacity-slots', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capacity-slots'] }),
  })
}

// Workstation Capacity
export const useWorkstationCapacity = (workstationId: string, weeks = 4) =>
  useQuery({
    queryKey: ['workstation-capacity', workstationId, weeks],
    queryFn: () =>
      apiClient
        .get<WorkstationCapacity>(`/manufacturing/capacity/workstation/${workstationId}`, { params: { weeks } })
        .then(r => r.data),
    enabled: !!workstationId,
  })

export const useRoughCutCapacity = (weeks = 8) =>
  useQuery({
    queryKey: ['rough-cut-capacity', weeks],
    queryFn: () =>
      apiClient.get<RoughCutRow[]>('/manufacturing/capacity/rough-cut', { params: { weeks } }).then(r => r.data),
  })

// Schedule / Gantt
export const useGanttData = (scenarioId?: string, dateFrom?: string, dateTo?: string) =>
  useQuery({
    queryKey: ['gantt', scenarioId, dateFrom, dateTo],
    queryFn: () =>
      apiClient
        .get<ScheduleEntry[]>('/manufacturing/schedule', {
          params: { scenario_id: scenarioId, date_from: dateFrom, date_to: dateTo },
        })
        .then(r => r.data),
  })

export const useUpdateScheduleEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScheduleEntry> }) =>
      apiClient.put<ScheduleEntry>(`/manufacturing/schedule/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gantt'] }),
  })
}

export const useRunScheduler = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (scenarioId?: string) =>
      apiClient
        .post('/manufacturing/schedule/run', null, { params: { scenario_id: scenarioId } })
        .then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gantt'] })
      qc.invalidateQueries({ queryKey: ['capacity-slots'] })
    },
  })
}

// Scenarios
export const useScenarios = () =>
  useQuery({
    queryKey: ['production-scenarios'],
    queryFn: () => apiClient.get<ProductionScenario[]>('/manufacturing/scenarios').then(r => r.data),
  })

export const useScenario = (id: string) =>
  useQuery({
    queryKey: ['production-scenario', id],
    queryFn: () => apiClient.get<ProductionScenario>(`/manufacturing/scenarios/${id}`).then(r => r.data),
    enabled: !!id,
  })

export const useCreateScenario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ScenarioCreate) =>
      apiClient.post<ProductionScenario>('/manufacturing/scenarios', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production-scenarios'] }),
  })
}

export const useUpdateScenario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductionScenario> }) =>
      apiClient.put<ProductionScenario>(`/manufacturing/scenarios/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['production-scenarios'] })
      qc.invalidateQueries({ queryKey: ['production-scenario', id] })
    },
  })
}

export const useRunScenario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (scenarioId: string) =>
      apiClient.post(`/manufacturing/scenarios/${scenarioId}/run`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-scenarios'] })
      qc.invalidateQueries({ queryKey: ['gantt'] })
    },
  })
}

export const useDeleteScenario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/manufacturing/scenarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production-scenarios'] }),
  })
}
