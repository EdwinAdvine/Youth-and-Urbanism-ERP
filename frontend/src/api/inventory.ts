import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Warehouse {
  id: string
  name: string
  location: string | null
  is_active: boolean
  address: string | null
  warehouse_type: string
  manager_id: string | null
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
  item_type: string
  tracking_type: string
  weight: number | null
  dimensions: Record<string, number> | null
  barcode: string | null
  min_order_qty: number
  lead_time_days: number
  preferred_supplier_id: string | null
  custom_fields: Record<string, unknown> | null
  max_stock_level: number | null
  created_at: string
}

export interface StockLevel {
  item_id: string
  warehouse_id: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_committed: number
  quantity_incoming: number
  quantity_available: number
  bin_location: string | null
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
  overstock_count: number
  pending_pos: number
  total_inventory_value: number
  total_incoming_units: number
}

export interface PaginatedResponse<T> {
  total: number
  items: T[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateWarehousePayload {
  name: string
  location?: string
  address?: string
  warehouse_type?: string
  manager_id?: string
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
  item_type?: string
  tracking_type?: string
  weight?: number
  dimensions?: Record<string, number>
  barcode?: string
  min_order_qty?: number
  lead_time_days?: number
  preferred_supplier_id?: string
  custom_fields?: Record<string, unknown>
  max_stock_level?: number
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

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Serial Numbers, Units of Measure, Blanket Orders
// ═══════════════════════════════════════════════════════════════════════════════

export interface UnitOfMeasure {
  id: string
  name: string
  abbreviation: string
  category: string
  is_base: boolean
  is_active: boolean
}

export interface UoMConversion {
  id: string
  from_uom_id: string
  to_uom_id: string
  factor: number
  item_id: string | null
  from_uom_name: string | null
  to_uom_name: string | null
}

export interface SerialNumber {
  id: string
  item_id: string
  serial_no: string
  warehouse_id: string | null
  batch_id: string | null
  purchase_order_id: string | null
  status: string
  sold_to_reference: string | null
  notes: string | null
  item_name: string | null
  created_at: string
}

export interface BlanketOrder {
  id: string
  bo_number: string
  supplier_id: string
  start_date: string
  end_date: string | null
  total_value_limit: number | null
  released_value: number
  status: string
  terms: string | null
  notes: string | null
  supplier_name: string | null
  utilization_pct: number | null
  created_at: string
}

export function useUoM() {
  return useQuery({
    queryKey: ['inventory', 'uom'],
    queryFn: async () => {
      const { data } = await apiClient.get<UnitOfMeasure[]>('/inventory/uom')
      return data
    },
  })
}

export function useCreateUoM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<UnitOfMeasure, 'id'>) => {
      const { data } = await apiClient.post<UnitOfMeasure>('/inventory/uom', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'uom'] }),
  })
}

export function useUoMConversions(itemId?: string) {
  return useQuery({
    queryKey: ['inventory', 'uom-conversions', itemId],
    queryFn: async () => {
      const { data } = await apiClient.get<UoMConversion[]>('/inventory/uom/conversions', { params: itemId ? { item_id: itemId } : {} })
      return data
    },
  })
}

export function useSerialNumbers(params: { item_id?: string; status?: string; warehouse_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'serials', params],
    queryFn: async () => {
      const { data } = await apiClient.get<SerialNumber[]>('/inventory/serials', { params })
      return data
    },
  })
}

export function useCreateSerial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<SerialNumber>) => {
      const { data } = await apiClient.post<SerialNumber>('/inventory/serials', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'serials'] }),
  })
}

export function useUpdateSerial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<SerialNumber> & { id: string }) => {
      const { data } = await apiClient.patch<SerialNumber>(`/inventory/serials/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'serials'] }),
  })
}

export function useBlanketOrders(status?: string) {
  return useQuery({
    queryKey: ['inventory', 'blanket-orders', status],
    queryFn: async () => {
      const { data } = await apiClient.get<BlanketOrder[]>('/inventory/blanket-orders', { params: status ? { status } : {} })
      return data
    },
  })
}

export function useCreateBlanketOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<BlanketOrder>) => {
      const { data } = await apiClient.post<BlanketOrder>('/inventory/blanket-orders', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'blanket-orders'] }),
  })
}

export function useUpdateBlanketOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<BlanketOrder> & { id: string }) => {
      const { data } = await apiClient.patch<BlanketOrder>(`/inventory/blanket-orders/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'blanket-orders'] }),
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — WMS: Zones, Bins, Putaway, Pick Lists
// ═══════════════════════════════════════════════════════════════════════════════

export interface WarehouseZone {
  id: string
  warehouse_id: string
  name: string
  zone_type: string
  description: string | null
  is_active: boolean
}

export interface WarehouseBin {
  id: string
  zone_id: string
  warehouse_id: string
  bin_code: string
  bin_type: string
  max_weight: number | null
  max_volume: number | null
  is_active: boolean
}

export interface BinContent {
  id: string
  bin_id: string
  item_id: string
  variant_id: string | null
  batch_id: string | null
  serial_id: string | null
  quantity: number
  item_name: string | null
  bin_code: string | null
}

export interface PutawayRule {
  id: string
  warehouse_id: string
  item_id: string | null
  category: string | null
  zone_id: string | null
  bin_id: string | null
  priority: number
  is_active: boolean
}

export interface PickListLine {
  id: string
  item_id: string
  bin_id: string | null
  quantity_requested: number
  quantity_picked: number
  item_name: string | null
}

export interface PickList {
  id: string
  pick_number: string
  warehouse_id: string
  status: string
  pick_strategy: string
  assigned_to: string | null
  reference_type: string | null
  notes: string | null
  lines: PickListLine[]
  created_at: string
}

export function useWarehouseZones(warehouseId: string) {
  return useQuery({
    queryKey: ['inventory', 'zones', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<WarehouseZone[]>(`/inventory/warehouses/${warehouseId}/zones`)
      return data
    },
    enabled: !!warehouseId,
  })
}

export function useCreateZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<WarehouseZone> & { warehouse_id: string }) => {
      const { data } = await apiClient.post<WarehouseZone>(`/inventory/warehouses/${payload.warehouse_id}/zones`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['inventory', 'zones', v.warehouse_id] }),
  })
}

export function useWarehouseBins(zoneId: string) {
  return useQuery({
    queryKey: ['inventory', 'bins', zoneId],
    queryFn: async () => {
      const { data } = await apiClient.get<WarehouseBin[]>(`/inventory/zones/${zoneId}/bins`)
      return data
    },
    enabled: !!zoneId,
  })
}

export function useCreateBin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<WarehouseBin> & { zone_id: string }) => {
      const { data } = await apiClient.post<WarehouseBin>(`/inventory/zones/${payload.zone_id}/bins`, payload)
      return data
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['inventory', 'bins', v.zone_id] }),
  })
}

export function useBinContents(binId: string) {
  return useQuery({
    queryKey: ['inventory', 'bin-contents', binId],
    queryFn: async () => {
      const { data } = await apiClient.get<BinContent[]>(`/inventory/bins/${binId}/contents`)
      return data
    },
    enabled: !!binId,
  })
}

export function usePutawayRules(warehouseId?: string) {
  return useQuery({
    queryKey: ['inventory', 'putaway-rules', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<PutawayRule[]>('/inventory/putaway-rules', { params: warehouseId ? { warehouse_id: warehouseId } : {} })
      return data
    },
  })
}

export function useCreatePutawayRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PutawayRule>) => {
      const { data } = await apiClient.post<PutawayRule>('/inventory/putaway-rules', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'putaway-rules'] }),
  })
}

export function usePickLists(params: { warehouse_id?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'pick-lists', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PickList[]>('/inventory/pick-lists', { params })
      return data
    },
  })
}

export function useCreatePickList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PickList> & { warehouse_id: string; lines: { item_id: string; quantity_requested: number }[] }) => {
      const { data } = await apiClient.post<PickList>('/inventory/pick-lists', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'pick-lists'] }),
  })
}

export function useUpdatePickListStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.patch(`/inventory/pick-lists/${id}/status`, null, { params: { status } })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'pick-lists'] }),
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — Replenishment & ABC/XYZ Analysis
// ═══════════════════════════════════════════════════════════════════════════════

export interface PurchaseSuggestion {
  id: string
  item_id: string
  warehouse_id: string
  supplier_id: string | null
  suggested_qty: number
  reason: string | null
  status: string
  item_name: string | null
  warehouse_name: string | null
  created_at: string
}

export interface ItemClassification {
  id: string
  item_id: string
  warehouse_id: string
  abc_class: string | null
  xyz_class: string | null
  combined_class: string | null
  annual_consumption_value: number
  demand_variability: number | null
  calculated_at: string | null
  item_name: string | null
}

export function usePurchaseSuggestions(status = 'pending') {
  return useQuery({
    queryKey: ['inventory', 'purchase-suggestions', status],
    queryFn: async () => {
      const { data } = await apiClient.get<PurchaseSuggestion[]>('/inventory/purchase-suggestions', { params: { status } })
      return data
    },
  })
}

export function useRunReplenishmentCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/inventory/purchase-suggestions/run')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'purchase-suggestions'] }),
  })
}

export function useAcceptSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/inventory/purchase-suggestions/${id}/accept`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'purchase-suggestions'] }),
  })
}

export function useDismissSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/inventory/purchase-suggestions/${id}/dismiss`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'purchase-suggestions'] }),
  })
}

export function useABCAnalysis(warehouseId?: string) {
  return useQuery({
    queryKey: ['inventory', 'abc-analysis', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ItemClassification[]>('/inventory/abc-analysis', { params: warehouseId ? { warehouse_id: warehouseId } : {} })
      return data
    },
  })
}

export function useCalculateABC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (warehouseId?: string) => {
      const { data } = await apiClient.post('/inventory/abc-analysis/calculate', null, { params: warehouseId ? { warehouse_id: warehouseId } : {} })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'abc-analysis'] }),
  })
}

export function useOverstockAlerts() {
  return useQuery({
    queryKey: ['inventory', 'overstock-alerts'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ item_id: string; item_name: string; sku: string; quantity_on_hand: number; max_stock_level: number; excess: number }[]>('/inventory/overstock-alerts')
      return data
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — Kits, Supplier Pricing, Landed Costs
// ═══════════════════════════════════════════════════════════════════════════════

export interface KitComponent {
  id: string
  component_item_id: string
  quantity: number
  is_optional: boolean
  item_name: string | null
}

export interface Kit {
  id: string
  kit_item_id: string
  description: string | null
  is_active: boolean
  kit_item_name: string | null
  components: KitComponent[]
}

export interface SupplierPrice {
  id: string
  supplier_id: string
  item_id: string
  unit_price: number
  min_order_qty: number
  lead_time_days: number
  currency: string
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  supplier_name: string | null
  item_name: string | null
}

export interface LandedCostLine {
  id: string
  cost_type: string
  amount: number
  currency: string
  description: string | null
}

export interface LandedCostVoucher {
  id: string
  voucher_number: string
  purchase_order_id: string | null
  status: string
  notes: string | null
  cost_lines: LandedCostLine[]
  total_cost: number
  created_at: string
}

export function useKits() {
  return useQuery({
    queryKey: ['inventory', 'kits'],
    queryFn: async () => {
      const { data } = await apiClient.get<Kit[]>('/inventory/kits')
      return data
    },
  })
}

export function useCreateKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { kit_item_id: string; description?: string; components: { component_item_id: string; quantity: number; is_optional?: boolean }[] }) => {
      const { data } = await apiClient.post<Kit>('/inventory/kits', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'kits'] }),
  })
}

export function useSupplierPrices(params: { item_id?: string; supplier_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'supplier-prices', params],
    queryFn: async () => {
      const { data } = await apiClient.get<SupplierPrice[]>('/inventory/supplier-prices', { params })
      return data
    },
  })
}

export function useCreateSupplierPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<SupplierPrice>) => {
      const { data } = await apiClient.post<SupplierPrice>('/inventory/supplier-prices', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'supplier-prices'] }),
  })
}

export function useLandedCosts() {
  return useQuery({
    queryKey: ['inventory', 'landed-costs'],
    queryFn: async () => {
      const { data } = await apiClient.get<LandedCostVoucher[]>('/inventory/landed-costs')
      return data
    },
  })
}

export function useCreateLandedCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { purchase_order_id?: string; notes?: string; cost_lines: { cost_type: string; amount: number; currency?: string; description?: string }[] }) => {
      const { data } = await apiClient.post<LandedCostVoucher>('/inventory/landed-costs', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'landed-costs'] }),
  })
}

export function useApplyLandedCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, allocation_method = 'by_value' }: { id: string; allocation_method?: string }) => {
      const { data } = await apiClient.post(`/inventory/landed-costs/${id}/apply`, null, { params: { allocation_method } })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'landed-costs'] }),
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — Costing & Audit Trail
// ═══════════════════════════════════════════════════════════════════════════════

export interface CostingConfig {
  id: string
  item_id: string
  method: string
  standard_cost: number | null
  item_name: string | null
}

export interface CostLayer {
  id: string
  item_id: string
  warehouse_id: string
  purchase_order_id: string | null
  quantity_received: number
  quantity_remaining: number
  unit_cost: number
  receipt_date: string
  item_name: string | null
  created_at: string
}

export interface InventoryAuditEntry {
  id: string
  entity_type: string
  entity_id: string
  field_name: string
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
}

export function useCostingConfigs() {
  return useQuery({
    queryKey: ['inventory', 'costing-config'],
    queryFn: async () => {
      const { data } = await apiClient.get<CostingConfig[]>('/inventory/costing-config')
      return data
    },
  })
}

export function useCreateCostingConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { item_id: string; method: string; standard_cost?: number }) => {
      const { data } = await apiClient.post<CostingConfig>('/inventory/costing-config', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'costing-config'] }),
  })
}

export function useCostLayers(params: { item_id?: string; warehouse_id?: string } = {}) {
  return useQuery({
    queryKey: ['inventory', 'cost-layers', params],
    queryFn: async () => {
      const { data } = await apiClient.get<CostLayer[]>('/inventory/cost-layers', { params })
      return data
    },
  })
}

export function useProfitabilityReport() {
  return useQuery({
    queryKey: ['inventory', 'profitability'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ item_id: string; sku: string; name: string; cost_price: number; selling_price: number; margin: number; margin_pct: number }[]>('/inventory/profitability')
      return data
    },
  })
}

export function useInventoryAuditTrail(params: { entity_type?: string; entity_id?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['inventory', 'audit-trail', params],
    queryFn: async () => {
      const { data } = await apiClient.get<InventoryAuditEntry[]>('/inventory/audit-trail', { params })
      return data
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — Automation Rules & AI Forecasting
// ═══════════════════════════════════════════════════════════════════════════════

export interface InventoryAutomationRule {
  id: string
  name: string
  trigger_event: string
  conditions: Record<string, unknown> | null
  action_type: string
  action_config: Record<string, unknown> | null
  is_active: boolean
  last_triggered_at: string | null
  created_at: string
}

export function useAutomationRules() {
  return useQuery({
    queryKey: ['inventory', 'automation-rules'],
    queryFn: async () => {
      const { data } = await apiClient.get<InventoryAutomationRule[]>('/inventory/automation-rules')
      return data
    },
  })
}

export function useCreateAutomationRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<InventoryAutomationRule>) => {
      const { data } = await apiClient.post<InventoryAutomationRule>('/inventory/automation-rules', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'automation-rules'] }),
  })
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<InventoryAutomationRule> & { id: string }) => {
      const { data } = await apiClient.patch<InventoryAutomationRule>(`/inventory/automation-rules/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'automation-rules'] }),
  })
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inventory/automation-rules/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'automation-rules'] }),
  })
}

export function useInventoryInsights() {
  return useQuery({
    queryKey: ['inventory', 'forecast', 'insights'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ generated_at: string; summary: Record<string, number>; insights: { type: string; message: string }[] }>('/inventory/forecast/insights')
      return data
    },
  })
}

export function useDemandForecast(itemId: string, periods = 3) {
  return useQuery({
    queryKey: ['inventory', 'forecast', 'demand', itemId, periods],
    queryFn: async () => {
      const { data } = await apiClient.get<{ item_id: string; item_name: string | null; data_points_used: number; forecast: { period: number; forecasted_demand: number; confidence: string }[] }>(`/inventory/forecast/demand/${itemId}`, { params: { periods } })
      return data
    },
    enabled: !!itemId,
  })
}
