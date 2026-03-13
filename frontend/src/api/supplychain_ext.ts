/**
 * Supply Chain Extended API client — shipments, returns, and quality inspections.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/supplychain`.
 *
 * Key exports:
 *   - useShipments() — list shipments with status/supplier filters
 *   - useTrackShipment() — get live tracking events for a shipment
 *   - useReturns() — manage return orders (refund/exchange/repair)
 *   - useQualityInspections() — fetch quality inspection records
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Shipment {
  id: string
  shipment_number: string
  order_id: string | null
  purchase_order_id: string | null
  supplier_id: string | null
  supplier_name: string | null
  origin: string
  destination: string
  carrier: string | null
  tracking_number: string | null
  status: 'pending' | 'in_transit' | 'delivered' | 'delayed' | 'cancelled'
  estimated_departure: string | null
  actual_departure: string | null
  estimated_arrival: string | null
  actual_arrival: string | null
  weight_kg: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ShipmentEvent {
  id: string
  shipment_id: string
  status: string
  location: string | null
  description: string
  timestamp: string
}

export interface ReturnOrder {
  id: string
  return_number: string
  order_id: string | null
  customer_id: string | null
  customer_name: string | null
  reason: string
  status: 'requested' | 'approved' | 'received' | 'refunded' | 'rejected' | 'closed'
  return_type: 'refund' | 'exchange' | 'repair'
  total_value: number
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  items?: ReturnOrderItem[]
}

export interface ReturnOrderItem {
  id: string
  return_id: string
  item_id: string
  item_name: string | null
  quantity: number
  unit_price: number
  reason: string | null
}

export interface QualityInspection {
  id: string
  inspection_number: string
  reference_type: 'grn' | 'shipment' | 'production'
  reference_id: string
  inspector_id: string
  inspector_name: string | null
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'partial'
  inspected_at: string | null
  total_inspected: number
  total_passed: number
  total_failed: number
  parameters: Record<string, unknown> | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SupplierRating {
  id: string
  supplier_id: string
  supplier_name: string | null
  period: string
  quality_score: number
  delivery_score: number
  price_score: number
  communication_score: number
  overall_score: number
  total_orders: number
  on_time_deliveries: number
  defect_rate: number
  notes: string | null
  rated_by: string
  created_at: string
}

export interface Contract {
  id: string
  contract_number: string
  supplier_id: string
  supplier_name: string | null
  title: string
  description: string | null
  contract_type: 'supply' | 'service' | 'framework'
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'renewed'
  start_date: string
  end_date: string
  total_value: number | null
  currency: string
  payment_terms: string | null
  auto_renew: boolean
  renewal_notice_days: number | null
  attachments: string[] | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface LeadTimeReport {
  supplier_id: string
  supplier_name: string
  avg_lead_time_days: number
  min_lead_time_days: number
  max_lead_time_days: number
  order_count: number
}

export interface SupplierPerformanceReport {
  supplier_id: string
  supplier_name: string
  overall_score: number
  quality_score: number
  delivery_score: number
  price_score: number
  total_orders: number
  total_value: number
  on_time_percentage: number
  defect_rate: number
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedShipments {
  total: number
  shipments: Shipment[]
}

export interface PaginatedReturnOrders {
  total: number
  returns: ReturnOrder[]
}

export interface PaginatedInspections {
  total: number
  inspections: QualityInspection[]
}

export interface PaginatedContracts {
  total: number
  contracts: Contract[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateShipmentPayload {
  order_id?: string
  purchase_order_id?: string
  supplier_id?: string
  origin: string
  destination: string
  carrier?: string
  tracking_number?: string
  estimated_departure?: string
  estimated_arrival?: string
  weight_kg?: number
  notes?: string
}

export interface CreateReturnPayload {
  order_id?: string
  customer_id?: string
  reason: string
  return_type: 'refund' | 'exchange' | 'repair'
  notes?: string
  items: { item_id: string; quantity: number; unit_price: number; reason?: string }[]
}

export interface UpdateReturnPayload {
  id: string
  status?: string
  notes?: string
}

export interface CreateQualityInspectionPayload {
  reference_type: 'grn' | 'shipment' | 'production'
  reference_id: string
  total_inspected: number
  total_passed: number
  total_failed: number
  parameters?: Record<string, unknown>
  notes?: string
}

export interface CreateSupplierRatingPayload {
  supplier_id: string
  period: string
  quality_score: number
  delivery_score: number
  price_score: number
  communication_score: number
  notes?: string
}

export interface CreateContractPayload {
  supplier_id: string
  title: string
  description?: string
  contract_type: 'supply' | 'service' | 'framework'
  start_date: string
  end_date: string
  total_value?: number
  currency?: string
  payment_terms?: string
  auto_renew?: boolean
  renewal_notice_days?: number
}

export interface UpdateContractPayload extends Partial<CreateContractPayload> {
  id: string
  status?: string
}

// ─── Shipments ────────────────────────────────────────────────────────────────

export function useShipments(params: { status?: string; supplier_id?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'shipments', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedShipments>('/supply-chain/shipments', { params })
      return data
    },
  })
}

export function useCreateShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateShipmentPayload) => {
      const { data } = await apiClient.post<Shipment>('/supply-chain/shipments', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'shipments'] }),
  })
}

export function useUpdateShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateShipmentPayload> & { id: string; status?: string }) => {
      const { data } = await apiClient.put<Shipment>(`/supply-chain/shipments/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'shipments'] }),
  })
}

export function useTrackShipment(shipmentId: string) {
  return useQuery({
    queryKey: ['supplychain', 'shipments', shipmentId, 'tracking'],
    queryFn: async () => {
      const { data } = await apiClient.get<ShipmentEvent[]>(`/supply-chain/shipments/${shipmentId}/tracking`)
      return data
    },
    enabled: !!shipmentId,
  })
}

// ─── Returns ──────────────────────────────────────────────────────────────────

export function useReturns(params: { status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'return-orders', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedReturnOrders>('/supply-chain/return-orders', { params })
      return data
    },
  })
}

export function useCreateReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateReturnPayload) => {
      const { data } = await apiClient.post<ReturnOrder>('/supply-chain/return-orders', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'return-orders'] }),
  })
}

export function useUpdateReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateReturnPayload) => {
      const { data } = await apiClient.put<ReturnOrder>(`/supply-chain/return-orders/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'return-orders'] }),
  })
}

// ─── Quality Inspections ──────────────────────────────────────────────────────

export function useQualityInspections(params: { status?: string; reference_type?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'quality-inspections', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedInspections>('/supply-chain/quality-inspections', { params })
      return data
    },
  })
}

export function useCreateQualityInspection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateQualityInspectionPayload) => {
      const { data } = await apiClient.post<QualityInspection>('/supply-chain/quality-inspections', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'quality-inspections'] }),
  })
}

// ─── Supplier Ratings ─────────────────────────────────────────────────────────

export function useSupplierRatings(params: { supplier_id?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'supplier-ratings', params],
    queryFn: async () => {
      const { data } = await apiClient.get<SupplierRating[]>('/supply-chain/supplier-ratings', { params })
      return data
    },
  })
}

export function useCreateSupplierRating() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSupplierRatingPayload) => {
      const { data } = await apiClient.post<SupplierRating>('/supply-chain/supplier-ratings', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'supplier-ratings'] }),
  })
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export function useContracts(params: { status?: string; supplier_id?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'contracts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedContracts>('/supply-chain/contracts', { params })
      return data
    },
  })
}

export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateContractPayload) => {
      const { data } = await apiClient.post<Contract>('/supply-chain/contracts', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'contracts'] }),
  })
}

export function useUpdateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateContractPayload) => {
      const { data } = await apiClient.put<Contract>(`/supply-chain/contracts/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'contracts'] }),
  })
}

export function useDeleteContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/supply-chain/contracts/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplychain', 'contracts'] }),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useLeadTimeReport(params: { start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'reports', 'lead-time', params],
    queryFn: async () => {
      const { data } = await apiClient.get<LeadTimeReport[]>('/supply-chain/reports/lead-time', { params })
      return data
    },
  })
}

export function useSupplierPerformanceReport(params: { start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['supplychain', 'reports', 'supplier-performance', params],
    queryFn: async () => {
      const { data } = await apiClient.get<SupplierPerformanceReport[]>('/supply-chain/reports/supplier-performance', { params })
      return data
    },
  })
}
