import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface Asset {
  id: string
  asset_code: string
  name: string
  workstation_id: string | null
  asset_type: string
  manufacturer: string | null
  model_number: string | null
  serial_number: string | null
  purchase_date: string | null
  purchase_cost: number
  warranty_expiry: string | null
  status: string
  total_operating_hours: number
  specifications: Record<string, unknown> | null
  location: string | null
  notes: string | null
  created_at: string
}

export interface AssetCreate {
  asset_code: string
  name: string
  workstation_id?: string
  asset_type: string
  manufacturer?: string
  model_number?: string
  serial_number?: string
  purchase_date?: string
  purchase_cost?: number
  warranty_expiry?: string
  location?: string
  specifications?: Record<string, unknown>
  notes?: string
}

export interface DowntimeRecord {
  id: string
  workstation_id: string
  asset_id: string | null
  work_order_id: string | null
  downtime_type: string
  category: string
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  root_cause: string | null
  resolution: string | null
  reported_by: string
  created_at: string
}

export interface DowntimeCreate {
  workstation_id: string
  asset_id?: string
  work_order_id?: string
  downtime_type: string
  category: string
  start_time: string
  end_time?: string
  root_cause?: string
  resolution?: string
}

export interface ParetoRow {
  category: string
  occurrences: number
  total_minutes: number
  percent: number
  cumulative_percent: number
}

export interface OEEReport {
  workstation_id: string
  period: { from: string; to: string }
  oee: number
  availability: number
  performance: number
  quality: number
  planned_minutes: number
  downtime_minutes: number
  total_inspected: number
  total_passed: number
  planned_qty: number
  completed_qty: number
}

export interface MaintenanceWorkOrder {
  id: string
  mwo_number: string
  asset_id: string
  schedule_id: string | null
  maintenance_type: string
  trigger_type: string
  description: string
  status: string
  priority: string
  assigned_to: string | null
  planned_date: string | null
  started_at: string | null
  completed_at: string | null
  parts_used: Record<string, unknown> | null
  labor_cost: number
  parts_cost: number
  completion_notes: string | null
  created_at: string
}

export interface MWOCreate {
  asset_id: string
  schedule_id?: string
  maintenance_type: string
  trigger_type?: string
  description: string
  priority?: string
  assigned_to?: string
  planned_date?: string
}

// Assets
export const useAssets = (workstationId?: string, status?: string) =>
  useQuery({
    queryKey: ['assets', workstationId, status],
    queryFn: () =>
      apiClient
        .get<Asset[]>('/manufacturing/assets', { params: { workstation_id: workstationId, status } })
        .then(r => r.data),
  })

export const useAsset = (id: string) =>
  useQuery({
    queryKey: ['asset', id],
    queryFn: () => apiClient.get<Asset>(`/manufacturing/assets/${id}`).then(r => r.data),
    enabled: !!id,
  })

export const useAssetHistory = (id: string) =>
  useQuery({
    queryKey: ['asset-history', id],
    queryFn: () =>
      apiClient.get<{ maintenance_work_orders: MaintenanceWorkOrder[]; downtime_records: DowntimeRecord[] }>(
        `/manufacturing/assets/${id}/history`
      ).then(r => r.data),
    enabled: !!id,
  })

export const useCreateAsset = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AssetCreate) => apiClient.post<Asset>('/manufacturing/assets', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })
}

export const useUpdateAsset = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Asset> }) =>
      apiClient.put<Asset>(`/manufacturing/assets/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['asset', id] })
    },
  })
}

// Downtime
export const useDowntimeRecords = (workstationId?: string, assetId?: string) =>
  useQuery({
    queryKey: ['downtime', workstationId, assetId],
    queryFn: () =>
      apiClient
        .get<DowntimeRecord[]>('/manufacturing/downtime', {
          params: { workstation_id: workstationId, asset_id: assetId },
        })
        .then(r => r.data),
  })

export const useLogDowntime = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DowntimeCreate) =>
      apiClient.post<DowntimeRecord>('/manufacturing/downtime', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['downtime'] }),
  })
}

export const useCloseDowntime = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, end_time, root_cause, resolution }: { id: string; end_time: string; root_cause?: string; resolution?: string }) =>
      apiClient.put(`/manufacturing/downtime/${id}/close`, { end_time, root_cause, resolution }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['downtime'] }),
  })
}

export const useDowntimePareto = (workstationId?: string, days = 30) =>
  useQuery({
    queryKey: ['downtime-pareto', workstationId, days],
    queryFn: () =>
      apiClient
        .get<ParetoRow[]>('/manufacturing/downtime/analysis/pareto', {
          params: { workstation_id: workstationId, days },
        })
        .then(r => r.data),
  })

// OEE
export const useOEEReport = (workstationId: string, dateFrom?: string, dateTo?: string) =>
  useQuery({
    queryKey: ['oee', workstationId, dateFrom, dateTo],
    queryFn: () =>
      apiClient
        .get<OEEReport>(`/manufacturing/oee/${workstationId}`, {
          params: { date_from: dateFrom, date_to: dateTo },
        })
        .then(r => r.data),
    enabled: !!workstationId,
  })

// Maintenance Work Orders
export const useMaintenanceWorkOrders = (status?: string, assetId?: string) =>
  useQuery({
    queryKey: ['mwos', status, assetId],
    queryFn: () =>
      apiClient
        .get<MaintenanceWorkOrder[]>('/manufacturing/maintenance-work-orders', {
          params: { status, asset_id: assetId },
        })
        .then(r => r.data),
  })

export const useMaintenanceWorkOrder = (id: string) =>
  useQuery({
    queryKey: ['mwo', id],
    queryFn: () => apiClient.get<MaintenanceWorkOrder>(`/manufacturing/maintenance-work-orders/${id}`).then(r => r.data),
    enabled: !!id,
  })

export const useCreateMWO = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: MWOCreate) =>
      apiClient.post<MaintenanceWorkOrder>('/manufacturing/maintenance-work-orders', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mwos'] }),
  })
}

export const useUpdateMWO = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MaintenanceWorkOrder> }) =>
      apiClient.put<MaintenanceWorkOrder>(`/manufacturing/maintenance-work-orders/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['mwos'] })
      qc.invalidateQueries({ queryKey: ['mwo', id] })
    },
  })
}

export const useCompleteMWO = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      parts_used,
      labor_cost,
      parts_cost,
      completion_notes,
    }: {
      id: string
      parts_used?: Record<string, unknown>
      labor_cost?: number
      parts_cost?: number
      completion_notes?: string
    }) =>
      apiClient
        .post(`/manufacturing/maintenance-work-orders/${id}/complete`, {
          parts_used,
          labor_cost,
          parts_cost,
          completion_notes,
        })
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mwos'] }),
  })
}
