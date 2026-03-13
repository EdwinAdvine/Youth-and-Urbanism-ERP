/**
 * Inventory Extended API client — suppliers, stock adjustments, item variants,
 * batch/expiry tracking, cycle counts, valuation reports, and turnover analysis.
 *
 * Exports TanStack Query hooks and Axios helper functions for the Inventory
 * module's extended features. All requests go through `client.ts` (Axios
 * instance with auth interceptors). Backend prefix: `/api/v1/inventory`.
 *
 * Key exports:
 *   - useSuppliers() / useCreateSupplier() — supplier directory management
 *   - useStockAdjustments() / useCreateStockAdjustment() — manual stock corrections
 *   - useItemVariants() / useCreateVariant() — SKU variant management
 *   - useBatchNumbers() / useCreateBatch() — batch/lot tracking with expiry dates
 *   - useInventoryCounts() / useCreateCount() — physical cycle count sessions
 *   - useValuationReport() — COGS and retail value by warehouse
 *   - useTurnoverReport() — inventory turnover ratios per item
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  contact_person: string | null
  payment_terms: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StockAdjustment {
  id: string
  item_id: string
  warehouse_id: string
  old_quantity: number
  new_quantity: number
  reason: string | null
  adjusted_by: string
  created_at: string
  updated_at: string
}

export interface ItemVariant {
  id: string
  item_id: string
  variant_name: string
  sku: string
  price_adjustment: number
  attributes: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BatchNumber {
  id: string
  item_id: string
  batch_no: string
  manufacture_date: string
  expiry_date: string | null
  quantity: number
  warehouse_id: string
  created_at: string
  updated_at: string
}

export interface InventoryCount {
  id: string
  warehouse_id: string
  count_date: string
  status: string
  counted_by: string
  notes: string | null
  lines: {
    item_id: string
    item_name: string
    expected_qty: number
    actual_qty: number | null
  }[] | null
  created_at: string
  updated_at: string
}

export interface ItemHistoryEntry {
  id: string
  item_id: string
  warehouse_id: string
  movement_type: string
  quantity: number
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  created_by: string
  created_at: string
}

export interface ValuationWarehouse {
  warehouse_id: string
  warehouse_name: string
  cost_value: string
  retail_value: string
  total_units: number
}

export interface ValuationReport {
  warehouses: ValuationWarehouse[]
  grand_total_cost: string
  grand_total_retail: string
  grand_total_units: number
}

export interface TurnoverItem {
  item_id: string
  sku: string
  item_name: string
  total_issued: number
  current_on_hand: number
  turnover_ratio: number
}

export interface TurnoverReport {
  days: number
  items: TurnoverItem[]
}

export interface AgingEntry {
  item_id: string
  sku: string
  item_name: string
  warehouse_id: string
  warehouse_name: string
  quantity_on_hand: number
  age_days: number
  stock_value: number
}

export interface AgingReport {
  buckets: {
    '0_30': AgingEntry[]
    '31_60': AgingEntry[]
    '61_90': AgingEntry[]
    '90_plus': AgingEntry[]
  }
  summary: {
    '0_30_count': number
    '31_60_count': number
    '61_90_count': number
    '90_plus_count': number
  }
}

export interface ImportResult {
  created: number
  skipped: number
  errors: { row: number; error: string }[]
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedSuppliers {
  total: number
  suppliers: Supplier[]
}

export interface PaginatedStockAdjustments {
  total: number
  stock_adjustments: StockAdjustment[]
}

export interface PaginatedCounts {
  total: number
  counts: InventoryCount[]
}

export interface PaginatedItemHistory {
  total: number
  item_id: string
  item_name: string
  movements: ItemHistoryEntry[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateSupplierPayload {
  name: string
  email?: string
  phone?: string
  address?: string
  contact_person?: string
  payment_terms?: string
}

export interface UpdateSupplierPayload {
  name?: string
  email?: string
  phone?: string
  address?: string
  contact_person?: string
  payment_terms?: string
  is_active?: boolean
}

export interface CreateStockAdjustmentPayload {
  item_id: string
  warehouse_id: string
  new_quantity: number
  reason?: string
}

export interface CreateItemVariantPayload {
  variant_name: string
  sku: string
  price_adjustment?: number
  attributes?: Record<string, unknown>
}

export interface UpdateItemVariantPayload {
  variant_name?: string
  sku?: string
  price_adjustment?: number
  attributes?: Record<string, unknown>
  is_active?: boolean
}

export interface CreateBatchPayload {
  batch_no: string
  manufacture_date: string
  expiry_date?: string
  quantity: number
  warehouse_id: string
}

export interface CreateCountPayload {
  warehouse_id: string
  count_date: string
  notes?: string
}

export interface UpdateCountPayload {
  status?: string
  notes?: string
  lines?: {
    item_id: string
    item_name?: string
    expected_qty: number
    actual_qty: number | null
  }[]
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export function useSuppliers(params: { search?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['inventory', 'suppliers', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedSuppliers>('/inventory/suppliers', { params })
      return data
    },
  })
}

export function useSupplier(supplierId: string) {
  return useQuery({
    queryKey: ['inventory', 'suppliers', supplierId],
    queryFn: async () => {
      const { data } = await apiClient.get<Supplier>(`/inventory/suppliers/${supplierId}`)
      return data
    },
    enabled: !!supplierId,
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSupplierPayload) => {
      const { data } = await apiClient.post<Supplier>('/inventory/suppliers', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'suppliers'] }),
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSupplierPayload & { id: string }) => {
      const { data } = await apiClient.put<Supplier>(`/inventory/suppliers/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'suppliers'] }),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inventory/suppliers/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'suppliers'] }),
  })
}

// ─── Stock Adjustments ────────────────────────────────────────────────────────

export function useStockAdjustments(params: { item_id?: string; warehouse_id?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['inventory', 'stock-adjustments', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedStockAdjustments>('/inventory/stock-adjustments', { params })
      return data
    },
  })
}

export function useCreateStockAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateStockAdjustmentPayload) => {
      const { data } = await apiClient.post<StockAdjustment>('/inventory/stock-adjustments', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'stock-adjustments'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] })
    },
  })
}

// ─── Item History ─────────────────────────────────────────────────────────────

export function useItemHistory(itemId: string, params: { warehouse_id?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['inventory', 'items', itemId, 'history', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedItemHistory>(`/inventory/items/${itemId}/history`, { params })
      return data
    },
    enabled: !!itemId,
  })
}

// ─── Item Variants ────────────────────────────────────────────────────────────

export function useItemVariants(itemId: string) {
  return useQuery({
    queryKey: ['inventory', 'items', itemId, 'variants'],
    queryFn: async () => {
      const { data } = await apiClient.get<ItemVariant[]>(`/inventory/items/${itemId}/variants`)
      return data
    },
    enabled: !!itemId,
  })
}

export function useCreateItemVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, ...payload }: CreateItemVariantPayload & { itemId: string }) => {
      const { data } = await apiClient.post<ItemVariant>(`/inventory/items/${itemId}/variants`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['inventory', 'items', variables.itemId, 'variants'] })
    },
  })
}

export function useUpdateItemVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ variantId, ...payload }: UpdateItemVariantPayload & { variantId: string }) => {
      const { data } = await apiClient.put<ItemVariant>(`/inventory/variants/${variantId}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

export function useDeleteItemVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (variantId: string) => {
      await apiClient.delete(`/inventory/variants/${variantId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

// ─── Batch Tracking ───────────────────────────────────────────────────────────

export function useItemBatches(itemId: string) {
  return useQuery({
    queryKey: ['inventory', 'items', itemId, 'batches'],
    queryFn: async () => {
      const { data } = await apiClient.get<BatchNumber[]>(`/inventory/items/${itemId}/batches`)
      return data
    },
    enabled: !!itemId,
  })
}

export function useCreateBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, ...payload }: CreateBatchPayload & { itemId: string }) => {
      const { data } = await apiClient.post<BatchNumber>(`/inventory/items/${itemId}/batches`, payload)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['inventory', 'items', variables.itemId, 'batches'] })
    },
  })
}

export function useBatch(batchId: string) {
  return useQuery({
    queryKey: ['inventory', 'batches', batchId],
    queryFn: async () => {
      const { data } = await apiClient.get<BatchNumber>(`/inventory/batches/${batchId}`)
      return data
    },
    enabled: !!batchId,
  })
}

// ─── Physical Counts ──────────────────────────────────────────────────────────

export function useInventoryCounts(params: { warehouse_id?: string; status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['inventory', 'counts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedCounts>('/inventory/counts', { params })
      return data
    },
  })
}

export function useCreateInventoryCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCountPayload) => {
      const { data } = await apiClient.post<InventoryCount>('/inventory/counts', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'counts'] }),
  })
}

export function useUpdateInventoryCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCountPayload & { id: string }) => {
      const { data } = await apiClient.put<InventoryCount>(`/inventory/counts/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'counts'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] })
    },
  })
}

// ─── Valuation Report ─────────────────────────────────────────────────────────

export function useStockValuation(params: { warehouse_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'valuation', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ValuationReport>('/inventory/valuation', { params })
      return data
    },
  })
}

// ─── Turnover Report ──────────────────────────────────────────────────────────

export function useTurnoverReport(params: { days?: number; warehouse_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'reports', 'turnover', params],
    queryFn: async () => {
      const { data } = await apiClient.get<TurnoverReport>('/inventory/reports/turnover', { params })
      return data
    },
  })
}

// ─── Aging Report ─────────────────────────────────────────────────────────────

export function useAgingReport(params: { warehouse_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'reports', 'aging', params],
    queryFn: async () => {
      const { data } = await apiClient.get<AgingReport>('/inventory/reports/aging', { params })
      return data
    },
  })
}

// ─── Import / Export ──────────────────────────────────────────────────────────

export function useImportItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<ImportResult>('/inventory/items/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

export function useExportItems() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get('/inventory/items/export', {
        responseType: 'blob',
      })
      return data
    },
  })
}
