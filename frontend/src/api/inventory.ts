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
  name: string
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
      const { data } = await apiClient.get<StockLevel[]>('/inventory/stock-levels', { params })
      return data
    },
  })
}

// ─── Stock Movements ──────────────────────────────────────────────────────────

export function useStockMovements(params: { movement_type?: string; search?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['inventory', 'stock-movements', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<StockMovement>>('/inventory/stock-movements', { params })
      return data
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
      const { data } = await apiClient.get<PaginatedResponse<PurchaseOrder>>('/inventory/purchase-orders', { params })
      return data
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
