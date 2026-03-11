import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Warehouse {
  id: string
  name: string
  location: string | null
  is_active: boolean
  created_at: string
}

export interface InventoryItem {
  id: string
  sku: string
  name: string
  description: string | null
  category: string | null
  unit_of_measure: string
  cost_price: number
  selling_price: number
  reorder_level: number
  is_active: boolean
  created_at: string
}

export interface StockLevel {
  item_id: string
  warehouse_id: string
  quantity_on_hand: number
  quantity_reserved: number
  item_name?: string
  warehouse_name?: string
}

export interface StockMovement {
  id: string
  item_id: string
  warehouse_id: string
  movement_type: string
  quantity: number
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  created_at: string
  item_name?: string
  warehouse_name?: string
}

export interface PurchaseOrderLine {
  id: string
  item_id: string
  quantity: number
  unit_price: number
  received_quantity: number
  item_name?: string
}

export interface PurchaseOrder {
  id: string
  po_number: string
  supplier_name: string
  supplier_email: string | null
  status: string
  order_date: string
  expected_date: string | null
  total: number
  notes: string | null
  created_at: string
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  lines: PurchaseOrderLine[]
}

export interface ReorderAlert {
  item_id: string
  sku: string
  item_name: string
  category: string | null
  reorder_level: number
  quantity_on_hand: number
  shortfall: number
}

export interface InventoryStats {
  total_items: number
  low_stock_count: number
  pending_pos: number
  total_inventory_value: number
}

export interface PaginatedResponse<T> {
  total: number
  items: T[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateWarehousePayload {
  name: string
  location?: string
}

export interface UpdateWarehousePayload extends Partial<CreateWarehousePayload> {
  id: string
  is_active?: boolean
}

export interface CreateItemPayload {
  sku?: string
  name: string
  description?: string
  category?: string
  unit_of_measure: string
  cost_price: number
  selling_price: number
  reorder_level?: number
}

export interface UpdateItemPayload extends Partial<CreateItemPayload> {
  id: string
  is_active?: boolean
}

export interface CreateStockMovementPayload {
  item_id: string
  warehouse_id: string
  movement_type: string
  quantity: number
  reference_type?: string
  reference_id?: string
  notes?: string
}

export interface CreatePOLinePayload {
  item_id: string
  quantity: number
  unit_price: number
}

export interface CreatePOPayload {
  supplier_name: string
  supplier_email?: string
  order_date: string
  expected_date?: string
  notes?: string
  lines: CreatePOLinePayload[]
}

// ─── Warehouses ───────────────────────────────────────────────────────────────

export function useWarehouses() {
  return useQuery({
    queryKey: ['inventory', 'warehouses'],
    queryFn: async () => {
      const { data } = await apiClient.get<Warehouse[]>('/inventory/warehouses')
      return data
    },
  })
}

export function useCreateWarehouse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateWarehousePayload) => {
      const { data } = await apiClient.post<Warehouse>('/inventory/warehouses', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'warehouses'] }),
  })
}

export function useUpdateWarehouse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateWarehousePayload) => {
      const { data } = await apiClient.put<Warehouse>(`/inventory/warehouses/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'warehouses'] }),
  })
}

export function useDeleteWarehouse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inventory/warehouses/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'warehouses'] }),
  })
}

// ─── Inventory Items ──────────────────────────────────────────────────────────

export function useInventoryItems(params: { search?: string; category?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['inventory', 'items', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<InventoryItem>>('/inventory/items', { params })
      return data
    },
  })
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: ['inventory', 'items', id],
    queryFn: async () => {
      const { data } = await apiClient.get<InventoryItem>(`/inventory/items/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateItemPayload) => {
      const { data } = await apiClient.post<InventoryItem>('/inventory/items', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateItemPayload) => {
      const { data } = await apiClient.put<InventoryItem>(`/inventory/items/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inventory/items/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

// ─── Stock Levels ─────────────────────────────────────────────────────────────

export function useStockLevels(params: { item_id?: string; warehouse_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'stock-levels', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; stock_levels: StockLevel[] }>('/inventory/stock-levels', { params })
      return data.stock_levels
    },
  })
}

// ─── Stock Movements ──────────────────────────────────────────────────────────

export function useStockMovements(params: { movement_type?: string; search?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['inventory', 'stock-movements', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; stock_movements: StockMovement[] }>('/inventory/stock-movements', { params })
      return { total: data.total, items: data.stock_movements } as PaginatedResponse<StockMovement>
    },
  })
}

export function useCreateStockMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateStockMovementPayload) => {
      const { data } = await apiClient.post<StockMovement>('/inventory/stock-movements', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'stock-movements'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'stock-levels'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'dashboard'] })
    },
  })
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export function usePurchaseOrders(params: { status?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'purchase-orders', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; purchase_orders: PurchaseOrder[] }>('/inventory/purchase-orders', { params })
      return { total: data.total, items: data.purchase_orders } as PaginatedResponse<PurchaseOrder>
    },
  })
}

export function usePurchaseOrderDetail(id: string) {
  return useQuery({
    queryKey: ['inventory', 'purchase-orders', id],
    queryFn: async () => {
      const { data } = await apiClient.get<PurchaseOrderDetail>(`/inventory/purchase-orders/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreatePO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePOPayload) => {
      const { data } = await apiClient.post<PurchaseOrder>('/inventory/purchase-orders', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'dashboard'] })
    },
  })
}

export function useSendPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<PurchaseOrder>(`/inventory/purchase-orders/${id}/send`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] }),
  })
}

export function useReceivePO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<PurchaseOrder>(`/inventory/purchase-orders/${id}/receive`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'stock-levels'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'stock-movements'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'dashboard'] })
    },
  })
}

export function useCancelPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inventory/purchase-orders/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'dashboard'] })
    },
  })
}

// ─── Reorder Alerts ───────────────────────────────────────────────────────────

export function useReorderAlerts() {
  return useQuery({
    queryKey: ['inventory', 'reorder-alerts'],
    queryFn: async () => {
      const { data } = await apiClient.get<ReorderAlert[]>('/inventory/reorder-alerts')
      return data
    },
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useInventoryStats() {
  return useQuery({
    queryKey: ['inventory', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<InventoryStats>('/inventory/dashboard/stats')
      return data
    },
  })
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  contact_person: string | null
  payment_terms: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateSupplierPayload {
  name: string
  email?: string
  phone?: string
  address?: string
  contact_person?: string
  payment_terms?: string
  notes?: string
}

export interface UpdateSupplierPayload extends Partial<CreateSupplierPayload> {
  id: string
  is_active?: boolean
}

export function useSuppliers(params: { search?: string; is_active?: boolean } = {}) {
  return useQuery({
    queryKey: ['inventory', 'suppliers', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ suppliers: Supplier[] }>('/inventory/suppliers', { params })
      return data.suppliers
    },
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
    mutationFn: async ({ id, ...payload }: UpdateSupplierPayload) => {
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

// ─── Stock Adjustments ───────────────────────────────────────────────────────

export type AdjustmentReason = 'damaged' | 'expired' | 'lost' | 'found' | 'correction' | 'return' | 'other'

export interface StockAdjustment {
  id: string
  item_id: string
  item_name?: string
  warehouse_id: string
  warehouse_name?: string
  adjustment_type: 'increase' | 'decrease'
  quantity: number
  old_quantity: number
  new_quantity: number
  reason: string | null
  notes: string | null
  adjusted_by: string | null
  adjusted_by_name?: string
  created_at: string
}

export interface CreateStockAdjustmentPayload {
  item_id: string
  warehouse_id: string
  adjustment_type: 'increase' | 'decrease'
  quantity: number
  reason: AdjustmentReason
  notes?: string
}

export function useStockAdjustments(params: { item_id?: string; warehouse_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'stock-adjustments', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; stock_adjustments: StockAdjustment[] }>('/inventory/stock-adjustments', { params })
      return data.stock_adjustments
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
      qc.invalidateQueries({ queryKey: ['inventory', 'stock-levels'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'stock-movements'] })
    },
  })
}

// ─── Item History ────────────────────────────────────────────────────────────

export function useItemHistory(itemId: string) {
  return useQuery({
    queryKey: ['inventory', 'items', itemId, 'history'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ movements: StockMovement[] }>(`/inventory/items/${itemId}/history`)
      return data.movements
    },
    enabled: !!itemId,
  })
}

// ─── Inventory Valuation ─────────────────────────────────────────────────────

export interface InventoryValuationItem {
  item_id: string
  item_name: string
  sku: string
  quantity: number
  unit_cost: number
  total_value: number
}

export interface InventoryValuation {
  warehouse_id: string
  warehouse_name: string
  items: InventoryValuationItem[]
  total_value: number
}

export function useInventoryValuation(params: { warehouse_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'valuation', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ warehouses: InventoryValuation[]; grand_total: number }>('/inventory/valuation', { params })
      return data.warehouses
    },
  })
}

// ─── Inventory Counts ────────────────────────────────────────────────────────

export type CountStatus = 'draft' | 'in_progress' | 'completed' | 'reconciled'

export interface InventoryCount {
  id: string
  warehouse_id: string
  warehouse_name?: string
  status: CountStatus
  count_date: string
  notes: string | null
  counted_by: string | null
  counted_by_name?: string
  items: InventoryCountItem[]
  created_at: string
  updated_at: string
}

export interface InventoryCountItem {
  id: string
  item_id: string
  item_name?: string
  sku?: string
  expected_quantity: number
  counted_quantity: number | null
  variance: number | null
}

export interface CreateInventoryCountPayload {
  warehouse_id: string
  count_date: string
  notes?: string
  item_ids?: string[]
}

export interface UpdateInventoryCountPayload {
  id: string
  status?: CountStatus
  items?: { item_id: string; counted_quantity: number }[]
}

export function useInventoryCounts(params: { warehouse_id?: string; status?: CountStatus } = {}) {
  return useQuery({
    queryKey: ['inventory', 'counts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ counts: InventoryCount[] }>('/inventory/counts', { params })
      return data.counts
    },
  })
}

export function useCreateInventoryCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateInventoryCountPayload) => {
      const { data } = await apiClient.post<InventoryCount>('/inventory/counts', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'counts'] }),
  })
}

export function useUpdateInventoryCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateInventoryCountPayload) => {
      const { data } = await apiClient.put<InventoryCount>(`/inventory/counts/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'counts'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'stock-levels'] })
    },
  })
}

// ─── Turnover & Aging Reports ────────────────────────────────────────────────

export interface TurnoverReport {
  items: {
    item_id: string
    item_name: string
    sku: string
    avg_inventory: number
    total_sold: number
    turnover_ratio: number
    days_of_supply: number
  }[]
  avg_turnover_ratio: number
}

export interface AgingReport {
  items: {
    item_id: string
    item_name: string
    sku: string
    quantity: number
    last_movement_date: string
    days_since_movement: number
    aging_bucket: '0-30' | '31-60' | '61-90' | '90+'
  }[]
}

export function useTurnoverReport(params: { period_start?: string; period_end?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'reports', 'turnover', params],
    queryFn: async () => {
      const { data } = await apiClient.get<TurnoverReport>('/inventory/reports/turnover', { params })
      return data
    },
  })
}

export function useAgingReport() {
  return useQuery({
    queryKey: ['inventory', 'reports', 'aging'],
    queryFn: async () => {
      const { data } = await apiClient.get<AgingReport>('/inventory/reports/aging')
      return data
    },
  })
}

// ─── Item Variants ───────────────────────────────────────────────────────────

export interface ItemVariant {
  id: string
  item_id: string
  variant_name: string
  sku: string
  price_adjustment: number
  attributes: Record<string, string>
  is_active: boolean
  created_at: string
}

export interface CreateItemVariantPayload {
  item_id: string
  variant_name: string
  sku?: string
  price_adjustment?: number
  attributes?: Record<string, string>
}

export interface UpdateItemVariantPayload {
  id: string
  item_id: string
  variant_name?: string
  sku?: string
  price_adjustment?: number
  attributes?: Record<string, string>
  is_active?: boolean
}

export function useItemVariants(itemId: string) {
  return useQuery({
    queryKey: ['inventory', 'items', itemId, 'variants'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ variants: ItemVariant[] }>(`/inventory/items/${itemId}/variants`)
      return data.variants
    },
    enabled: !!itemId,
  })
}

export function useCreateItemVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateItemVariantPayload) => {
      const { data } = await apiClient.post<ItemVariant>(`/inventory/items/${payload.item_id}/variants`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

export function useUpdateItemVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, item_id, ...payload }: UpdateItemVariantPayload) => {
      const { data } = await apiClient.put<ItemVariant>(`/inventory/items/${item_id}/variants/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

export function useDeleteItemVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, variantId }: { itemId: string; variantId: string }) => {
      await apiClient.delete(`/inventory/items/${itemId}/variants/${variantId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

// ─── Batch / Serial Numbers ──────────────────────────────────────────────────

export interface BatchNumber {
  id: string
  item_id: string
  item_name?: string
  batch_no: string
  quantity: number
  manufacture_date: string | null
  expiry_date: string | null
  warehouse_id: string
  warehouse_name?: string
  status: 'active' | 'expired'
  created_at: string
}

export interface CreateItemBatchPayload {
  item_id: string
  batch_no: string
  quantity: number
  manufacture_date: string
  expiry_date?: string
  warehouse_id: string
}

export function useItemBatches(params: { item_id?: string; warehouse_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'batches', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; batches: BatchNumber[] }>('/inventory/batches', { params })
      return data.batches
    },
  })
}

export function useCreateItemBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ item_id, ...rest }: CreateItemBatchPayload) => {
      const { data } = await apiClient.post<BatchNumber>(`/inventory/items/${item_id}/batches`, rest)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'batches'] }),
  })
}

// ─── Import / Export Items ───────────────────────────────────────────────────

export function useImportItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post<{ imported: number; errors: string[] }>('/inventory/items/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  })
}

export function useExportItems() {
  return useMutation({
    mutationFn: async (params: { format?: 'csv' | 'xlsx'; category?: string } = {}) => {
      const { data } = await apiClient.get('/inventory/items/export', {
        params,
        responseType: 'blob',
      })
      return data
    },
  })
}
