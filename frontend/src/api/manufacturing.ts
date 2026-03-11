import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BOMItem {
  id: string
  bom_id: string
  item_id: string
  child_bom_id: string | null
  quantity_required: number
  unit_of_measure: string
  scrap_percentage: number
  sort_order: number
  notes: string | null
  item_name?: string
}

export interface BOM {
  id: string
  bom_number: string
  name: string
  finished_item_id: string
  quantity_produced: number
  version: number
  is_active: boolean
  is_default: boolean
  notes: string | null
  owner_id: string
  created_at: string
  updated_at: string
  finished_item_name?: string
}

export interface BOMDetail extends BOM {
  items: BOMItem[]
}

export interface WorkStation {
  id: string
  name: string
  code: string
  description: string | null
  capacity_per_hour: number | null
  hourly_rate: number
  is_active: boolean
  warehouse_id: string | null
  created_at: string
  updated_at: string
}

export interface WorkOrder {
  id: string
  wo_number: string
  bom_id: string
  workstation_id: string | null
  finished_item_id: string
  planned_quantity: number
  completed_quantity: number
  rejected_quantity: number
  status: string
  priority: string
  planned_start: string | null
  planned_end: string | null
  actual_start: string | null
  actual_end: string | null
  target_warehouse_id: string
  source_warehouse_id: string
  total_material_cost: number
  total_labor_cost: number
  notes: string | null
  assigned_to: string | null
  owner_id: string
  created_at: string
  updated_at: string
  finished_item_name?: string
  bom_name?: string
}

export interface MaterialConsumption {
  id: string
  work_order_id: string
  item_id: string
  planned_quantity: number
  actual_quantity: number
  warehouse_id: string
  stock_movement_id: string | null
  consumed_at: string | null
  notes: string | null
  item_name?: string
}

export interface MaterialAvailability {
  item_id: string
  item_name: string | null
  sku: string | null
  required: number
  available: number
  sufficient: boolean
  shortfall: number
}

export interface QualityCheck {
  id: string
  check_number: string
  work_order_id: string
  inspector_id: string
  checked_at: string
  quantity_inspected: number
  quantity_passed: number
  quantity_failed: number
  status: string
  parameters: Record<string, unknown> | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ManufacturingStats {
  total_boms: number
  total_workstations: number
  wo_draft: number
  wo_planned: number
  wo_in_progress: number
  wo_completed: number
  wo_cancelled: number
  in_progress_material_cost: number
  defect_rate_percent: number
}

export interface BOMCost {
  bom_id: string
  bom_number: string
  unit_cost: number
  total_cost: number
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface BOMItemPayload {
  item_id: string
  child_bom_id?: string | null
  quantity_required: number
  unit_of_measure?: string
  scrap_percentage?: number
  sort_order?: number
  notes?: string
}

export interface CreateBOMPayload {
  name: string
  finished_item_id: string
  quantity_produced?: number
  version?: number
  is_default?: boolean
  notes?: string
  items: BOMItemPayload[]
}

export interface UpdateBOMPayload {
  id: string
  name?: string
  finished_item_id?: string
  quantity_produced?: number
  version?: number
  is_active?: boolean
  is_default?: boolean
  notes?: string
  items?: BOMItemPayload[]
}

export interface CreateWorkStationPayload {
  name: string
  code: string
  description?: string
  capacity_per_hour?: number
  hourly_rate?: number
  warehouse_id?: string
}

export interface UpdateWorkStationPayload extends Partial<CreateWorkStationPayload> {
  id: string
  is_active?: boolean
}

export interface CreateWorkOrderPayload {
  bom_id: string
  workstation_id?: string
  planned_quantity: number
  priority?: string
  planned_start?: string
  planned_end?: string
  target_warehouse_id: string
  source_warehouse_id: string
  notes?: string
  assigned_to?: string
}

export interface UpdateWorkOrderPayload extends Partial<Omit<CreateWorkOrderPayload, 'bom_id'>> {
  id: string
}

export interface CreateQualityCheckPayload {
  work_order_id: string
  quantity_inspected: number
  quantity_passed: number
  quantity_failed: number
  status?: string
  parameters?: Record<string, unknown>
  notes?: string
}

export interface ConsumePayload {
  item_id: string
  quantity: number
  notes?: string
}

// ─── BOM hooks ────────────────────────────────────────────────────────────────

export function useBOMs(params: { search?: string; is_active?: boolean; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['manufacturing', 'bom', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; boms: BOM[] }>('/manufacturing/bom', { params })
      return data
    },
  })
}

export function useBOMDetail(id: string) {
  return useQuery({
    queryKey: ['manufacturing', 'bom', id],
    queryFn: async () => {
      const { data } = await apiClient.get<BOMDetail>(`/manufacturing/bom/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useBOMCost(id: string) {
  return useQuery({
    queryKey: ['manufacturing', 'bom', id, 'cost'],
    queryFn: async () => {
      const { data } = await apiClient.get<BOMCost>(`/manufacturing/bom/${id}/cost`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateBOM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateBOMPayload) => {
      const { data } = await apiClient.post<BOMDetail>('/manufacturing/bom', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'bom'] }),
  })
}

export function useUpdateBOM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateBOMPayload) => {
      const { data } = await apiClient.put<BOMDetail>(`/manufacturing/bom/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'bom'] }),
  })
}

export function useDeleteBOM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/manufacturing/bom/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'bom'] }),
  })
}

// ─── WorkStation hooks ────────────────────────────────────────────────────────

export function useWorkStations() {
  return useQuery({
    queryKey: ['manufacturing', 'workstations'],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkStation[]>('/manufacturing/workstations')
      return data
    },
  })
}

export function useCreateWorkStation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateWorkStationPayload) => {
      const { data } = await apiClient.post<WorkStation>('/manufacturing/workstations', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'workstations'] }),
  })
}

export function useUpdateWorkStation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateWorkStationPayload) => {
      const { data } = await apiClient.put<WorkStation>(`/manufacturing/workstations/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'workstations'] }),
  })
}

// ─── Work Order hooks ─────────────────────────────────────────────────────────

export function useWorkOrders(params: { status?: string; priority?: string; search?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['manufacturing', 'work-orders', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; work_orders: WorkOrder[] }>('/manufacturing/work-orders', { params })
      return data
    },
  })
}

export function useWorkOrderDetail(id: string) {
  return useQuery({
    queryKey: ['manufacturing', 'work-orders', id],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkOrder>(`/manufacturing/work-orders/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateWorkOrderPayload) => {
      const { data } = await apiClient.post<WorkOrder>('/manufacturing/work-orders', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] })
      qc.invalidateQueries({ queryKey: ['manufacturing', 'dashboard'] })
    },
  })
}

export function useUpdateWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateWorkOrderPayload) => {
      const { data } = await apiClient.put<WorkOrder>(`/manufacturing/work-orders/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] }),
  })
}

export function useStartWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<WorkOrder>(`/manufacturing/work-orders/${id}/start`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] })
      qc.invalidateQueries({ queryKey: ['manufacturing', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useCompleteWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, completed_quantity, rejected_quantity = 0 }: { id: string; completed_quantity: number; rejected_quantity?: number }) => {
      const { data } = await apiClient.post<WorkOrder>(
        `/manufacturing/work-orders/${id}/complete`,
        null,
        { params: { completed_quantity, rejected_quantity } },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] })
      qc.invalidateQueries({ queryKey: ['manufacturing', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useCancelWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<WorkOrder>(`/manufacturing/work-orders/${id}/cancel`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] })
      qc.invalidateQueries({ queryKey: ['manufacturing', 'dashboard'] })
    },
  })
}

export function useMaterialAvailability(woId: string) {
  return useQuery({
    queryKey: ['manufacturing', 'work-orders', woId, 'availability'],
    queryFn: async () => {
      const { data } = await apiClient.get<MaterialAvailability[]>(`/manufacturing/work-orders/${woId}/material-availability`)
      return data
    },
    enabled: !!woId,
  })
}

// ─── Material Consumption hooks ───────────────────────────────────────────────

export function useConsumeMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ woId, ...payload }: ConsumePayload & { woId: string }) => {
      const { data } = await apiClient.post<MaterialConsumption>(`/manufacturing/work-orders/${woId}/consume`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturing'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useWorkOrderConsumption(woId: string) {
  return useQuery({
    queryKey: ['manufacturing', 'work-orders', woId, 'consumption'],
    queryFn: async () => {
      const { data } = await apiClient.get<MaterialConsumption[]>(`/manufacturing/work-orders/${woId}/consumption`)
      return data
    },
    enabled: !!woId,
  })
}

// ─── Quality Check hooks ──────────────────────────────────────────────────────

export function useQualityChecks(params: { work_order_id?: string; status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['manufacturing', 'quality-checks', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; quality_checks: QualityCheck[] }>('/manufacturing/quality-checks', { params })
      return data
    },
  })
}

export function useCreateQualityCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateQualityCheckPayload) => {
      const { data } = await apiClient.post<QualityCheck>('/manufacturing/quality-checks', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'quality-checks'] }),
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useRemoveBOMItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ bomId, itemId }: { bomId: string; itemId: string }) => {
      await apiClient.delete(`/manufacturing/bom/${bomId}/items/${itemId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'bom'] }),
  })
}

export function useDeleteQualityCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/manufacturing/quality-checks/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'quality-checks'] }),
  })
}

export function useDeleteWorkStation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/manufacturing/workstations/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturing', 'workstations'] }),
  })
}

export function useManufacturingStats() {
  return useQuery({
    queryKey: ['manufacturing', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<ManufacturingStats>('/manufacturing/dashboard/stats')
      return data
    },
  })
}
