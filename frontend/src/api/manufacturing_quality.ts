import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InspectionPlanItem {
  id: string
  plan_id: string
  sequence: number
  parameter_name: string
  measurement_type: string
  target_value: string | null
  lower_limit: number | null
  upper_limit: number | null
  unit_of_measure: string | null
  is_critical: boolean
  instructions: string | null
  sample_size: number
}

export interface InspectionPlan {
  id: string
  plan_number: string
  name: string
  description: string | null
  bom_id: string | null
  routing_step_id: string | null
  is_active: boolean
  version: number
  owner_id: string
  created_at: string
  updated_at: string
}

export interface InspectionPlanDetail extends InspectionPlan {
  items: InspectionPlanItem[]
}

export interface InspectionPlanCreate {
  name: string
  description?: string
  bom_id?: string
  routing_step_id?: string
  items?: Array<{
    sequence: number
    parameter_name: string
    measurement_type?: string
    target_value?: string
    lower_limit?: number
    upper_limit?: number
    unit_of_measure?: string
    is_critical?: boolean
    instructions?: string
    sample_size?: number
  }>
}

export interface NCR {
  id: string
  ncr_number: string
  work_order_id: string | null
  quality_check_id: string | null
  item_id: string | null
  supplier_id: string | null
  description: string
  severity: string
  status: string
  quantity_affected: number
  root_cause: string | null
  disposition: string | null
  reported_by: string
  assigned_to: string | null
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

export interface NCRCreate {
  work_order_id?: string
  quality_check_id?: string
  item_id?: string
  supplier_id?: string
  description: string
  severity?: string
  quantity_affected?: number
  assigned_to?: string
}

export interface CAPA {
  id: string
  capa_number: string
  ncr_id: string | null
  capa_type: string
  description: string
  root_cause_analysis: string | null
  corrective_action: string | null
  preventive_action: string | null
  status: string
  priority: string
  assigned_to: string | null
  due_date: string | null
  completed_at: string | null
  effectiveness_verified: boolean
  verification_notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CAPACreate {
  ncr_id?: string
  capa_type?: string
  description: string
  root_cause_analysis?: string
  corrective_action?: string
  preventive_action?: string
  priority?: string
  assigned_to?: string
  due_date?: string
}

export interface SPCDataPoint {
  id: string
  measured_value: number
  measured_at: string
  sample_number: number
  subgroup: number | null
  is_out_of_control: boolean
}

export interface SPCControlChart {
  plan_item: {
    id: string
    parameter_name: string
    target_value: string | null
    lower_limit: number | null
    upper_limit: number | null
  }
  statistics: {
    mean: number
    std_dev: number
    ucl: number | null
    lcl: number | null
    total_points: number
    out_of_control_count: number
  }
  data_points: SPCDataPoint[]
}

export interface SupplierQualityScorecard {
  supplier_id: string
  total_ncrs: number
  open_ncrs: number
  ncrs_by_severity: Record<string, number>
  quality_score: number
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useInspectionPlans = (params?: { bom_id?: string; is_active?: boolean }) =>
  useQuery({
    queryKey: ['inspection-plans', params],
    queryFn: () => apiClient.get<InspectionPlan[]>('/manufacturing/inspection-plans', { params }).then(r => r.data),
  })

export const useInspectionPlan = (planId: string) =>
  useQuery({
    queryKey: ['inspection-plan', planId],
    queryFn: () => apiClient.get<InspectionPlanDetail>(`/manufacturing/inspection-plans/${planId}`).then(r => r.data),
    enabled: !!planId,
  })

export const useNCRs = (params?: { status?: string; severity?: string; work_order_id?: string; supplier_id?: string }) =>
  useQuery({
    queryKey: ['ncrs', params],
    queryFn: () => apiClient.get<NCR[]>('/manufacturing/ncr', { params }).then(r => r.data),
  })

export const useNCR = (ncrId: string) =>
  useQuery({
    queryKey: ['ncr', ncrId],
    queryFn: () => apiClient.get<NCR>(`/manufacturing/ncr/${ncrId}`).then(r => r.data),
    enabled: !!ncrId,
  })

export const useCAPAs = (params?: { status?: string; capa_type?: string; ncr_id?: string }) =>
  useQuery({
    queryKey: ['capas', params],
    queryFn: () => apiClient.get<CAPA[]>('/manufacturing/capa', { params }).then(r => r.data),
  })

export const useCAPA = (capaId: string) =>
  useQuery({
    queryKey: ['capa', capaId],
    queryFn: () => apiClient.get<CAPA>(`/manufacturing/capa/${capaId}`).then(r => r.data),
    enabled: !!capaId,
  })

export const useSPCControlChart = (planItemId: string, workOrderId?: string) =>
  useQuery({
    queryKey: ['spc-chart', planItemId, workOrderId],
    queryFn: () =>
      apiClient.get<SPCControlChart>(`/manufacturing/spc/control-chart/${planItemId}`, {
        params: workOrderId ? { work_order_id: workOrderId } : undefined,
      }).then(r => r.data),
    enabled: !!planItemId,
  })

export const useSupplierQualityScorecard = (supplierId: string) =>
  useQuery({
    queryKey: ['supplier-quality-scorecard', supplierId],
    queryFn: () => apiClient.get<SupplierQualityScorecard>(`/manufacturing/quality/supplier-scorecard/${supplierId}`).then(r => r.data),
    enabled: !!supplierId,
  })

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useCreateInspectionPlan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: InspectionPlanCreate) =>
      apiClient.post<InspectionPlanDetail>('/manufacturing/inspection-plans', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection-plans'] }),
  })
}

export const useUpdateInspectionPlan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; is_active?: boolean }) =>
      apiClient.put<InspectionPlan>(`/manufacturing/inspection-plans/${id}`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['inspection-plans'] })
      qc.invalidateQueries({ queryKey: ['inspection-plan', vars.id] })
    },
  })
}

export const useAddInspectionPlanItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, ...data }: { planId: string; sequence: number; parameter_name: string; measurement_type?: string; target_value?: string; lower_limit?: number; upper_limit?: number; unit_of_measure?: string; is_critical?: boolean; instructions?: string; sample_size?: number }) =>
      apiClient.post<InspectionPlanItem>(`/manufacturing/inspection-plans/${planId}/items`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection-plan'] }),
  })
}

export const useCreateNCR = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: NCRCreate) => apiClient.post<NCR>('/manufacturing/ncr', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ncrs'] }),
  })
}

export const useUpdateNCR = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<NCRCreate> & { status?: string; root_cause?: string; disposition?: string; resolution_notes?: string }) =>
      apiClient.put<NCR>(`/manufacturing/ncr/${id}`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ncrs'] })
      qc.invalidateQueries({ queryKey: ['ncr', vars.id] })
    },
  })
}

export const useCreateCAPA = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CAPACreate) => apiClient.post<CAPA>('/manufacturing/capa', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capas'] }),
  })
}

export const useUpdateCAPA = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CAPACreate> & { status?: string }) =>
      apiClient.put<CAPA>(`/manufacturing/capa/${id}`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['capas'] })
      qc.invalidateQueries({ queryKey: ['capa', vars.id] })
    },
  })
}

export const useVerifyCAPA = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ capaId, verification_notes, is_effective }: { capaId: string; verification_notes: string; is_effective: boolean }) =>
      apiClient.post<CAPA>(`/manufacturing/capa/${capaId}/verify`, { verification_notes, is_effective }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capas'] })
      qc.invalidateQueries({ queryKey: ['capa'] })
    },
  })
}

export const useRecordSPCDataPoint = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { inspection_plan_item_id: string; work_order_id: string; measured_value: number; sample_number: number; subgroup?: number }) =>
      apiClient.post('/manufacturing/spc/data-points', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spc-chart'] }),
  })
}
