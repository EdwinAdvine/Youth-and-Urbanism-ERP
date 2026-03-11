import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface POSSessionData {
  id: string
  session_number: string
  cashier_id: string
  warehouse_id: string
  opened_at: string
  closed_at: string | null
  opening_balance: number
  closing_balance: number | null
  expected_balance: number | null
  difference: number | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface POSTransactionData {
  id: string
  transaction_number: string
  session_id: string
  customer_name: string | null
  customer_email: string | null
  subtotal: number
  discount_amount: number
  discount_type: string | null
  tax_amount: number
  total: number
  status: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface POSTransactionLine {
  id: string
  transaction_id: string
  item_id: string
  item_name: string
  item_sku: string
  quantity: number
  unit_price: number
  discount_amount: number
  line_total: number
}

export interface POSPaymentData {
  id: string
  transaction_id: string
  payment_method: string
  amount: number
  reference: string | null
  change_given: number
}

export interface POSTransactionDetail extends POSTransactionData {
  lines: POSTransactionLine[]
  payments: POSPaymentData[]
}

export interface POSProduct {
  id: string
  sku: string
  name: string
  category: string | null
  selling_price: string
  cost_price?: string
  unit_of_measure?: string
  stock_on_hand: number
}

export interface POSDashboardStats {
  today_sales_total: string
  today_sales_count: number
  today_avg_sale: string
  top_products: {
    item_name: string
    item_sku: string
    quantity_sold: number
    revenue: string
  }[]
}

export interface ReconciliationData {
  session: POSSessionData
  transaction_counts: Record<string, number>
  total_sales: string
  payment_methods: Record<string, string>
}

export interface ReceiptData {
  transaction_number: string
  date: string
  customer_name: string
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
  receipt_data: Record<string, string> | null
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface OpenSessionPayload {
  warehouse_id: string
  opening_balance: number
  notes?: string
}

export interface CloseSessionPayload {
  id: string
  closing_balance: number
  notes?: string
}

export interface TransactionLinePayload {
  item_id: string
  quantity: number
  unit_price: number
  discount_amount?: number
}

export interface TransactionPaymentPayload {
  payment_method: string
  amount: number
  reference?: string
}

export interface CreateTransactionPayload {
  customer_name?: string
  customer_email?: string
  discount_amount?: number
  discount_type?: string
  tax_amount?: number
  lines: TransactionLinePayload[]
  payments: TransactionPaymentPayload[]
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function usePOSSessions(params: { status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['pos', 'sessions', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; sessions: POSSessionData[] }>('/pos/sessions', { params })
      return data
    },
  })
}

export function useActiveSession() {
  return useQuery({
    queryKey: ['pos', 'sessions', 'active'],
    queryFn: async () => {
      const { data } = await apiClient.get<POSSessionData>('/pos/sessions/active')
      return data
    },
    retry: false,
  })
}

export function usePOSSession(id: string) {
  return useQuery({
    queryKey: ['pos', 'sessions', id],
    queryFn: async () => {
      const { data } = await apiClient.get<POSSessionData>(`/pos/sessions/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useSessionReconciliation(id: string) {
  return useQuery({
    queryKey: ['pos', 'sessions', id, 'reconciliation'],
    queryFn: async () => {
      const { data } = await apiClient.get<ReconciliationData>(`/pos/sessions/${id}/reconciliation`)
      return data
    },
    enabled: !!id,
  })
}

export function useOpenSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: OpenSessionPayload) => {
      const { data } = await apiClient.post<POSSessionData>('/pos/sessions/open', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
    },
  })
}

export function useCloseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: CloseSessionPayload) => {
      const { data } = await apiClient.post<POSSessionData>(`/pos/sessions/${id}/close`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
      qc.invalidateQueries({ queryKey: ['pos', 'dashboard'] })
    },
  })
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function usePOSTransactions(params: { session_id?: string; status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['pos', 'transactions', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; transactions: POSTransactionData[] }>('/pos/transactions', { params })
      return data
    },
  })
}

export function usePOSTransaction(id: string) {
  return useQuery({
    queryKey: ['pos', 'transactions', id],
    queryFn: async () => {
      const { data } = await apiClient.get<POSTransactionDetail>(`/pos/transactions/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTransactionPayload) => {
      const { data } = await apiClient.post<POSTransactionDetail>('/pos/transactions', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'transactions'] })
      qc.invalidateQueries({ queryKey: ['pos', 'products'] })
      qc.invalidateQueries({ queryKey: ['pos', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useRefundTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<POSTransactionData>(`/pos/transactions/${id}/refund`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'transactions'] })
      qc.invalidateQueries({ queryKey: ['pos', 'products'] })
      qc.invalidateQueries({ queryKey: ['pos', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useVoidTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<POSTransactionData>(`/pos/transactions/${id}/void`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'transactions'] })
      qc.invalidateQueries({ queryKey: ['pos', 'products'] })
      qc.invalidateQueries({ queryKey: ['pos', 'dashboard'] })
    },
  })
}

export function useTransactionReceipt(id: string) {
  return useQuery({
    queryKey: ['pos', 'transactions', id, 'receipt'],
    queryFn: async () => {
      const { data } = await apiClient.get<ReceiptData>(`/pos/transactions/${id}/receipt`)
      return data
    },
    enabled: !!id,
  })
}

// ─── Products ─────────────────────────────────────────────────────────────────

export function usePOSProducts(params: { category?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['pos', 'products', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; products: POSProduct[] }>('/pos/products', { params })
      return data
    },
  })
}

export function useSearchProducts(q: string) {
  return useQuery({
    queryKey: ['pos', 'products', 'search', q],
    queryFn: async () => {
      const { data } = await apiClient.get<POSProduct[]>('/pos/products/search', { params: { q } })
      return data
    },
    enabled: q.length > 0,
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function usePOSDashboardStats() {
  return useQuery({
    queryKey: ['pos', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<POSDashboardStats>('/pos/dashboard/stats')
      return data
    },
  })
}
