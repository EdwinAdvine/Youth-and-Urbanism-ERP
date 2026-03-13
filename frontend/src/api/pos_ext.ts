/**
 * POS Extended API client — terminals, discounts, receipts, and loyalty programs.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/pos`.
 *
 * Key exports:
 *   - useTerminals() / useCreateTerminal() — manage POS terminal hardware configs
 *   - useDiscounts() / useCreateDiscount() — discount rules (% or fixed, per-item or order)
 *   - useSessionSummary() — revenue and payment method breakdown for a session
 *   - useCloseSession() — close a terminal session with reconciliation data
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface POSTerminalType {
  id: string
  name: string
  code: string
  description: string | null
  location: string | null
  warehouse_id: string | null
  is_active: boolean
  settings_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface POSDiscount {
  id: string
  name: string
  code: string | null
  discount_type: 'percentage' | 'fixed'
  value: number
  min_order_amount: number | null
  max_discount_amount: number | null
  applies_to: 'order' | 'item'
  product_ids: string[] | null
  category_ids: string[] | null
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface POSReceipt {
  transaction_id: string
  transaction_number: string
  terminal_name: string | null
  cashier_name: string | null
  date: string
  lines: {
    item_name: string
    item_sku: string
    quantity: number
    unit_price: string
    discount: string
    line_total: string
  }[]
  subtotal: string
  discount: string
  tax: string
  total: string
  payments: {
    method: string
    amount: string
    reference: string | null
    change: string
  }[]
  store_name: string | null
  store_address: string | null
}

export interface POSCashMovement {
  id: string
  session_id: string
  type: 'cash_in' | 'cash_out'
  amount: number
  reason: string
  reference: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
}

export interface DailySalesData {
  date: string
  total_sales: number
  transaction_count: number
  avg_transaction: number
  refund_count: number
  refund_total: number
  net_sales: number
}

export interface CashierReportData {
  cashier_id: string
  cashier_name: string
  transaction_count: number
  total_sales: number
  avg_transaction: number
  refund_count: number
  items_sold: number
}

export interface ProductReportData {
  item_id: string
  item_name: string
  item_sku: string
  quantity_sold: number
  revenue: number
  avg_price: number
  return_count: number
}

export interface SessionSummary {
  session_id: string
  session_number: string
  opened_at: string
  closed_at: string | null
  total_sales: number
  transaction_count: number
  cash_sales: number
  card_sales: number
  other_sales: number
  cash_movements_in: number
  cash_movements_out: number
  expected_cash: number
  actual_cash: number | null
  difference: number | null
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedTerminals {
  total: number
  terminals: POSTerminalType[]
}

export interface PaginatedDiscounts {
  total: number
  discounts: POSDiscount[]
}

export interface PaginatedCashMovements {
  total: number
  movements: POSCashMovement[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateTerminalPayload {
  name: string
  code: string
  description?: string
  location?: string
  warehouse_id?: string
  is_active?: boolean
  settings_json?: Record<string, unknown>
}

export interface CreateDiscountPayload {
  name: string
  code?: string
  discount_type: 'percentage' | 'fixed'
  value: number
  min_order_amount?: number
  max_discount_amount?: number
  applies_to?: 'order' | 'item'
  product_ids?: string[]
  category_ids?: string[]
  valid_from: string
  valid_until?: string
  is_active?: boolean
}

export interface CreateCashMovementPayload {
  session_id: string
  type: 'cash_in' | 'cash_out'
  amount: number
  reason: string
  reference?: string
}

export interface OfflineSyncPayload {
  transactions: {
    lines: { item_id: string; quantity: number; unit_price: number; discount_amount?: number }[]
    payments: { payment_method: string; amount: number; reference?: string }[]
    customer_name?: string
    customer_email?: string
    created_at: string
  }[]
}

// ─── Terminals ────────────────────────────────────────────────────────────────

export function useTerminals(params: { is_active?: boolean; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['pos', 'terminals', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedTerminals>('/pos/terminals', { params })
      return data
    },
  })
}

export function useCreateTerminal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTerminalPayload) => {
      const { data } = await apiClient.post<POSTerminalType>('/pos/terminals', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'terminals'] }),
  })
}

export function useUpdateTerminal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateTerminalPayload> & { id: string }) => {
      const { data } = await apiClient.put<POSTerminalType>(`/pos/terminals/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'terminals'] }),
  })
}

export function useDeleteTerminal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/pos/terminals/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'terminals'] }),
  })
}

// ─── Sessions (extended) ──────────────────────────────────────────────────────

export function useCloseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, closing_balance, notes }: { id: string; closing_balance: number; notes?: string }) => {
      const { data } = await apiClient.post(`/pos/sessions/${id}/close`, { closing_balance, notes })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
      qc.invalidateQueries({ queryKey: ['pos', 'dashboard'] })
    },
  })
}

export function useSessionSummary(sessionId: string) {
  return useQuery({
    queryKey: ['pos', 'sessions', sessionId, 'summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<SessionSummary>(`/pos/sessions/${sessionId}/summary`)
      return data
    },
    enabled: !!sessionId,
  })
}

// ─── Discounts ────────────────────────────────────────────────────────────────

export function useDiscounts(params: { is_active?: boolean; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['pos', 'discounts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedDiscounts>('/pos/discounts', { params })
      return data
    },
  })
}

export function useCreateDiscount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateDiscountPayload) => {
      const { data } = await apiClient.post<POSDiscount>('/pos/discounts', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'discounts'] }),
  })
}

export function useUpdateDiscount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateDiscountPayload> & { id: string }) => {
      const { data } = await apiClient.put<POSDiscount>(`/pos/discounts/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'discounts'] }),
  })
}

export function useDeleteDiscount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/pos/discounts/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'discounts'] }),
  })
}

// ─── Receipts ─────────────────────────────────────────────────────────────────

export function useGenerateReceipt(transactionId: string) {
  return useQuery({
    queryKey: ['pos', 'receipts', transactionId],
    queryFn: async () => {
      const { data } = await apiClient.get<POSReceipt>(`/pos/transactions/${transactionId}/receipt`)
      return data
    },
    enabled: !!transactionId,
  })
}

export function useRefundTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { data } = await apiClient.post(`/pos/transactions/${transactionId}/refund`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'transactions'] })
      qc.invalidateQueries({ queryKey: ['pos', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

// ─── Cash Movements ───────────────────────────────────────────────────────────

export function useCashMovements(params: { session_id?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['pos', 'cash-movements', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedCashMovements>('/pos/cash-movements', { params })
      return data
    },
  })
}

export function useCreateCashMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCashMovementPayload) => {
      const { data } = await apiClient.post<POSCashMovement>('/pos/cash-movements', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'cash-movements'] })
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
    },
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useDailySalesReport(params: { start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['pos', 'reports', 'daily-sales', params],
    queryFn: async () => {
      const { data } = await apiClient.get<DailySalesData[]>('/pos/reports/daily-sales', { params })
      return data
    },
  })
}

export function useCashierReport(params: { start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['pos', 'reports', 'cashier', params],
    queryFn: async () => {
      const { data } = await apiClient.get<CashierReportData[]>('/pos/reports/cashier', { params })
      return data
    },
  })
}

export function useProductReport(params: { start_date?: string; end_date?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['pos', 'reports', 'products', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ProductReportData[]>('/pos/reports/products', { params })
      return data
    },
  })
}

// ─── Offline Sync ─────────────────────────────────────────────────────────────

export function useOfflineSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: OfflineSyncPayload) => {
      const { data } = await apiClient.post('/pos/offline/sync', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

// ─── E-Commerce → POS: Sync Products ─────────────────────────────────────────

export interface SyncFromEcommercePayload {
  store_id?: string
  warehouse_id: string
}

export interface SyncFromEcommerceResult {
  synced: number
  skipped: number
  warehouse_id: string
  message: string
}

export function useSyncFromEcommerce() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SyncFromEcommercePayload) => {
      const { data } = await apiClient.post<SyncFromEcommerceResult>(
        '/pos/products/sync-from-ecommerce',
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['ecommerce'] })
    },
  })
}
