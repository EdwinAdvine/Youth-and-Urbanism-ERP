import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string
  name: string
  code: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  payment_terms: string | null
  payment_terms_days: number
  rating: number | null
  tags: string[] | null
  is_active: boolean
  contact_id: string | null
  notes: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface RequisitionLine {
  id: string
  requisition_id: string
  item_id: string
  quantity: number
  estimated_unit_price: number
  supplier_id: string | null
  notes: string | null
}

export interface ProcurementRequisition {
  id: string
  requisition_number: string
  title: string
  description: string | null
  requested_by: string
  department_id: string | null
  status: string
  approved_by: string | null
  approved_at: string | null
  priority: string
  required_by_date: string | null
  total_estimated: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RequisitionDetail extends ProcurementRequisition {
  lines: RequisitionLine[]
}

export interface GRNLine {
  id: string
  grn_id: string
  po_line_id: string
  item_id: string
  ordered_quantity: number
  received_quantity: number
  accepted_quantity: number
  rejected_quantity: number
  rejection_reason: string | null
}

export interface GoodsReceivedNote {
  id: string
  grn_number: string
  purchase_order_id: string
  supplier_id: string
  warehouse_id: string
  received_by: string
  received_date: string
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GRNDetail extends GoodsReceivedNote {
  lines: GRNLine[]
}

export interface SupplierReturnLine {
  id: string
  return_id: string
  item_id: string
  quantity: number
  unit_cost: number
  reason: string | null
}

export interface SupplierReturn {
  id: string
  return_number: string
  supplier_id: string
  grn_id: string | null
  warehouse_id: string
  status: string
  reason: string
  total_value: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface SupplierReturnDetail extends SupplierReturn {
  lines: SupplierReturnLine[]
}

export interface SupplyChainStats {
  total_suppliers: number
  pending_requisitions: number
  open_grns: number
  pending_returns: number
  pending_requisition_value: string
  pending_return_value: string
}

// ─── Paginated response types ─────────────────────────────────────────────────

export interface PaginatedSuppliers {
  total: number
  suppliers: Supplier[]
}

export interface PaginatedRequisitions {
  total: number
  requisitions: ProcurementRequisition[]
}

export interface PaginatedGRNs {
  total: number
  grns: GoodsReceivedNote[]
}

export interface PaginatedReturns {
  total: number
  returns: SupplierReturn[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateSupplierPayload {
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  payment_terms?: string
  payment_terms_days?: number
  rating?: number
  tags?: string[]
  contact_id?: string
  notes?: string
}

export interface UpdateSupplierPayload extends Partial<CreateSupplierPayload> {
  id: string
  is_active?: boolean
}

export interface RequisitionLineIn {
  item_id: string
  quantity: number
  estimated_unit_price: number
  supplier_id?: string
  notes?: string
}

export interface CreateRequisitionPayload {
  title: string
  description?: string
  department_id?: string
  priority?: string
  required_by_date?: string
  notes?: string
  lines: RequisitionLineIn[]
}

export interface UpdateRequisitionPayload extends Partial<Omit<CreateRequisitionPayload, 'lines'>> {
  id: string
  lines?: RequisitionLineIn[]
}

export interface GRNLineIn {
  po_line_id: string
  item_id: string
  ordered_quantity: number
  received_quantity: number
  accepted_quantity: number
  rejected_quantity?: number
  rejection_reason?: string
}

export interface CreateGRNPayload {
  purchase_order_id: string
  supplier_id: string
  warehouse_id: string
  received_date: string
  notes?: string
  lines: GRNLineIn[]
}

export interface ReturnLineIn {
  item_id: string
  quantity: number
  unit_cost: number
  reason?: string
}

export interface CreateReturnPayload {
  supplier_id: string
  grn_id?: string
  warehouse_id: string
  reason: string
  lines: ReturnLineIn[]
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export function useSuppliers(params: {
  search?: string
  is_active?: boolean
  skip?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['supplychain', 'suppliers', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedSuppliers>('/supply-chain/suppliers', { params })
      return data
    },
  })
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: ['supplychain', 'suppliers', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Supplier>(`/supply-chain/suppliers/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSupplierPayload) => {
      const { data } = await apiClient.post<Supplier>('/supply-chain/suppliers', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'suppliers'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSupplierPayload) => {
      const { data } = await apiClient.put<Supplier>(`/supply-chain/suppliers/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'suppliers'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/supply-chain/suppliers/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'suppliers'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

// ─── Requisitions ─────────────────────────────────────────────────────────────

export function useRequisitions(params: {
  status?: string
  priority?: string
  skip?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['supplychain', 'requisitions', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedRequisitions>('/supply-chain/requisitions', { params })
      return data
    },
  })
}

export function useRequisition(id: string) {
  return useQuery({
    queryKey: ['supplychain', 'requisitions', id],
    queryFn: async () => {
      const { data } = await apiClient.get<RequisitionDetail>(`/supply-chain/requisitions/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateRequisitionPayload) => {
      const { data } = await apiClient.post<RequisitionDetail>('/supply-chain/requisitions', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'requisitions'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

export function useUpdateRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRequisitionPayload) => {
      const { data } = await apiClient.put<RequisitionDetail>(`/supply-chain/requisitions/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'requisitions'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

export function useSubmitRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ProcurementRequisition>(`/supply-chain/requisitions/${id}/submit`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'requisitions'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

export function useApproveRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const { data } = await apiClient.post<ProcurementRequisition>(
        `/supply-chain/requisitions/${id}/approve`,
        null,
        { params: { action } }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'requisitions'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

export function useConvertRequisitionToPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<{ message: string; purchase_order_id: string; po_number: string }>(
        `/supply-chain/requisitions/${id}/convert-to-po`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'requisitions'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

// ─── GRNs ─────────────────────────────────────────────────────────────────────

export function useGRNs(params: {
  status?: string
  skip?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['supplychain', 'grns', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedGRNs>('/supply-chain/grn', { params })
      return data
    },
  })
}

export function useGRN(id: string) {
  return useQuery({
    queryKey: ['supplychain', 'grns', id],
    queryFn: async () => {
      const { data } = await apiClient.get<GRNDetail>(`/supply-chain/grn/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateGRN() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateGRNPayload) => {
      const { data } = await apiClient.post<GRNDetail>('/supply-chain/grn', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'grns'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

export function useAcceptGRN() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<GoodsReceivedNote>(`/supply-chain/grn/${id}/accept`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'grns'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useRejectGRN() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<GoodsReceivedNote>(`/supply-chain/grn/${id}/reject`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'grns'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

// ─── Returns ──────────────────────────────────────────────────────────────────

export function useReturns(params: {
  status?: string
  skip?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['supplychain', 'returns', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedReturns>('/supply-chain/returns', { params })
      return data
    },
  })
}

export function useReturn(id: string) {
  return useQuery({
    queryKey: ['supplychain', 'returns', id],
    queryFn: async () => {
      const { data } = await apiClient.get<SupplierReturnDetail>(`/supply-chain/returns/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateReturnPayload) => {
      const { data } = await apiClient.post<SupplierReturnDetail>('/supply-chain/returns', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'returns'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

export function useApproveReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<SupplierReturn>(`/supply-chain/returns/${id}/approve`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'returns'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
    },
  })
}

export function useCompleteReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<SupplierReturn>(`/supply-chain/returns/${id}/complete`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplychain', 'returns'] })
      qc.invalidateQueries({ queryKey: ['supplychain', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useSupplyChainDashboard() {
  return useQuery({
    queryKey: ['supplychain', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<SupplyChainStats>('/supply-chain/dashboard/stats')
      return data
    },
  })
}
