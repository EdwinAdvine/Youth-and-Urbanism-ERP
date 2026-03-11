import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LotSerial {
  id: string
  tracking_number: string
  tracking_type: string
  item_id: string
  work_order_id: string | null
  parent_tracking_id: string | null
  quantity: number
  status: string
  manufactured_date: string | null
  expiry_date: string | null
  supplier_id: string | null
  grn_id: string | null
  metadata_json: Record<string, unknown> | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface LotSerialCreate {
  tracking_number: string
  tracking_type?: string
  item_id: string
  work_order_id?: string
  parent_tracking_id?: string
  quantity?: number
  manufactured_date?: string
  expiry_date?: string
  supplier_id?: string
  grn_id?: string
  metadata_json?: Record<string, unknown>
}

export interface TraceEvent {
  id: string
  lot_serial_id: string
  event_type: string
  work_order_id: string | null
  reference_type: string | null
  reference_id: string | null
  quantity: number | null
  notes: string | null
  event_timestamp: string
  recorded_by: string
}

export interface TraceEventCreate {
  event_type: string
  work_order_id?: string
  reference_type?: string
  reference_id?: string
  quantity?: number
  notes?: string
}

export interface TraceForwardResult {
  lot: { id: string; tracking_number: string; item_id: string; status: string }
  downstream_lots: Array<{
    id: string
    tracking_number: string
    tracking_type: string
    item_id: string
    status: string
    quantity: number
    work_order_id: string | null
  }>
  events: Array<{
    event_type: string
    timestamp: string | null
    work_order_id: string | null
    quantity: number | null
    notes: string | null
  }>
}

export interface TraceBackwardResult {
  lot: { id: string; tracking_number: string; item_id: string; status: string }
  upstream_lots: Array<{
    id: string
    tracking_number: string
    tracking_type: string
    item_id: string
    status: string
    quantity: number
    supplier_id: string | null
    grn_id: string | null
  }>
  origin: Record<string, unknown>
}

export interface GenealogyNode {
  id: string
  tracking_number: string
  tracking_type: string
  item_id: string
  status: string
  quantity: number
  children: GenealogyNode[]
}

export interface BatchRecord {
  id: string
  batch_number: string
  work_order_id: string
  bom_id: string
  status: string
  material_verification: Record<string, unknown> | null
  process_parameters: Record<string, unknown> | null
  quality_results: Record<string, unknown> | null
  deviations: Record<string, unknown> | null
  approved_by: string | null
  approved_at: string | null
  electronic_signature: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface BatchRecordCreate {
  batch_number: string
  work_order_id: string
  bom_id: string
  material_verification?: Record<string, unknown>
  process_parameters?: Record<string, unknown>
  quality_results?: Record<string, unknown>
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useLots = (params?: { item_id?: string; work_order_id?: string; tracking_type?: string; status?: string }) =>
  useQuery({
    queryKey: ['lots', params],
    queryFn: () => apiClient.get<LotSerial[]>('/manufacturing/lots', { params }).then(r => r.data),
  })

export const useLot = (lotId: string) =>
  useQuery({
    queryKey: ['lot', lotId],
    queryFn: () => apiClient.get<LotSerial>(`/manufacturing/lots/${lotId}`).then(r => r.data),
    enabled: !!lotId,
  })

export const useLotEvents = (lotId: string) =>
  useQuery({
    queryKey: ['lot-events', lotId],
    queryFn: () => apiClient.get<TraceEvent[]>(`/manufacturing/lots/${lotId}/events`).then(r => r.data),
    enabled: !!lotId,
  })

export const useTraceForward = (lotId: string) =>
  useQuery({
    queryKey: ['trace-forward', lotId],
    queryFn: () => apiClient.get<TraceForwardResult>(`/manufacturing/lots/${lotId}/trace-forward`).then(r => r.data),
    enabled: !!lotId,
  })

export const useTraceBackward = (lotId: string) =>
  useQuery({
    queryKey: ['trace-backward', lotId],
    queryFn: () => apiClient.get<TraceBackwardResult>(`/manufacturing/lots/${lotId}/trace-backward`).then(r => r.data),
    enabled: !!lotId,
  })

export const useGenealogy = (lotId: string) =>
  useQuery({
    queryKey: ['genealogy', lotId],
    queryFn: () => apiClient.get<{ genealogy_tree: GenealogyNode; queried_lot_id: string }>(`/manufacturing/lots/${lotId}/genealogy`).then(r => r.data),
    enabled: !!lotId,
  })

export const useBatchRecords = (params?: { work_order_id?: string; status?: string }) =>
  useQuery({
    queryKey: ['batch-records', params],
    queryFn: () => apiClient.get<BatchRecord[]>('/manufacturing/batch-records', { params }).then(r => r.data),
  })

export const useBatchRecord = (recordId: string) =>
  useQuery({
    queryKey: ['batch-record', recordId],
    queryFn: () => apiClient.get<BatchRecord>(`/manufacturing/batch-records/${recordId}`).then(r => r.data),
    enabled: !!recordId,
  })

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useCreateLot = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: LotSerialCreate) => apiClient.post<LotSerial>('/manufacturing/lots', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }),
  })
}

export const useRecordTraceEvent = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lotId, ...data }: TraceEventCreate & { lotId: string }) =>
      apiClient.post<TraceEvent>(`/manufacturing/lots/${lotId}/events`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lot-events', vars.lotId] })
      qc.invalidateQueries({ queryKey: ['lot', vars.lotId] })
    },
  })
}

export const useCreateBatchRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BatchRecordCreate) => apiClient.post<BatchRecord>('/manufacturing/batch-records', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batch-records'] }),
  })
}

export const useUpdateBatchRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: string; material_verification?: Record<string, unknown>; process_parameters?: Record<string, unknown>; quality_results?: Record<string, unknown>; deviations?: Record<string, unknown> }) =>
      apiClient.put<BatchRecord>(`/manufacturing/batch-records/${id}`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['batch-records'] })
      qc.invalidateQueries({ queryKey: ['batch-record', vars.id] })
    },
  })
}

export const useApproveBatchRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, electronic_signature }: { recordId: string; electronic_signature: string }) =>
      apiClient.post<BatchRecord>(`/manufacturing/batch-records/${recordId}/approve`, { electronic_signature }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batch-records'] })
      qc.invalidateQueries({ queryKey: ['batch-record'] })
    },
  })
}
