import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface POSSessionData {
  id: string
  session_number: string
  cashier_id: string
  warehouse_id: string
  terminal_id: string | null
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
  customer_id: string | null
  subtotal: number
  discount_amount: number
  discount_type: string | null
  tax_amount: number
  tip_amount: number
  total: number
  status: string
  held_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface POSTransactionLine {
  id: string
  transaction_id: string
  item_id: string
  variant_id: string | null
  batch_id: string | null
  bundle_id: string | null
  item_name: string
  item_sku: string
  quantity: number
  unit_price: number
  discount_amount: number
  line_total: number
  modifiers: Record<string, unknown> | null
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
  terminal_id?: string
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
  variant_id?: string
  batch_id?: string
  bundle_id?: string
  quantity: number
  unit_price: number
  discount_amount?: number
  modifier_ids?: string[]
}

export interface TransactionPaymentPayload {
  payment_method: string
  amount: number
  reference?: string
}

export interface CreateTransactionPayload {
  customer_name?: string
  customer_email?: string
  customer_id?: string
  discount_amount?: number
  discount_type?: string
  tax_amount?: number
  tip_amount?: number
  lines: TransactionLinePayload[]
  payments: TransactionPaymentPayload[]
}

export interface HoldTransactionPayload {
  lines: TransactionLinePayload[]
  customer_name?: string
  customer_email?: string
  customer_id?: string
  discount_amount?: number
  discount_type?: string
  tax_amount?: number
  notes?: string
}

export interface QuickAddProductPayload {
  name: string
  selling_price: number
  cost_price?: number
  category?: string
  initial_stock?: number
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

// ─── Hold / Suspend / Layaway ────────────────────────────────────────────────

export function useHoldTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: HoldTransactionPayload) => {
      const { data } = await apiClient.post<POSTransactionDetail>('/pos/transactions/hold', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'transactions'] })
      qc.invalidateQueries({ queryKey: ['pos', 'held'] })
      qc.invalidateQueries({ queryKey: ['pos', 'products'] })
    },
  })
}

export function useHeldTransactions(sessionId?: string) {
  return useQuery({
    queryKey: ['pos', 'held', sessionId],
    queryFn: async () => {
      const params = sessionId ? { session_id: sessionId } : {}
      const { data } = await apiClient.get<POSTransactionDetail[]>('/pos/transactions/held', { params })
      return data
    },
  })
}

export function useResumeHeldTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (txnId: string) => {
      const { data } = await apiClient.post<{ message: string; transaction: POSTransactionDetail }>(`/pos/transactions/${txnId}/resume`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'held'] })
      qc.invalidateQueries({ queryKey: ['pos', 'products'] })
    },
  })
}

export function useCancelHeldTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (txnId: string) => {
      const { data } = await apiClient.post<{ message: string }>(`/pos/transactions/${txnId}/cancel-hold`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'held'] })
      qc.invalidateQueries({ queryKey: ['pos', 'products'] })
    },
  })
}

// ─── Quick-Add Product ───────────────────────────────────────────────────────

export function useQuickAddProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: QuickAddProductPayload) => {
      const { data } = await apiClient.post<POSProduct>('/pos/products/quick-add', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'products'] })
    },
  })
}

// ─── Variants ────────────────────────────────────────────────────────────────

export interface ProductVariant {
  id: string
  item_id: string
  variant_name: string
  variant_value: string
  sku_suffix: string
  price_adjustment: string
  is_active: boolean
  stock_on_hand: number
}

export function useProductVariants(itemId: string) {
  return useQuery({
    queryKey: ['pos', 'products', itemId, 'variants'],
    queryFn: async () => {
      const { data } = await apiClient.get<ProductVariant[]>(`/pos/products/${itemId}/variants`)
      return data
    },
    enabled: !!itemId,
  })
}

// ─── Product Modifiers ───────────────────────────────────────────────────────

export interface ModifierOption {
  id: string
  name: string
  price_adjustment: string
}

export interface ModifierGroup {
  id: string
  name: string
  selection_type: string
  is_required: boolean
  min_selections: number
  max_selections: number
  modifiers: ModifierOption[]
}

export function useProductModifiers(itemId: string) {
  return useQuery({
    queryKey: ['pos', 'products', itemId, 'modifiers'],
    queryFn: async () => {
      const { data } = await apiClient.get<ModifierGroup[]>(`/pos/products/${itemId}/modifiers`)
      return data
    },
    enabled: !!itemId,
  })
}

// ─── Tips Report ─────────────────────────────────────────────────────────────

export interface TipsReportEntry {
  session_id: string
  cashier_id: string
  total_tips: string
  transaction_count: number
}

export function useTipsReport(params: { date_from?: string; date_to?: string; session_id?: string } = {}) {
  return useQuery({
    queryKey: ['pos', 'reports', 'tips', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ tips: TipsReportEntry[] }>('/pos/reports/tips', { params })
      return data
    },
  })
}

// ─── X/Z Readings ────────────────────────────────────────────────────────────

export interface FiscalReading {
  reading_type: string
  session_id: string
  session_number: string
  cashier_id: string
  opened_at: string
  closed_at: string | null
  opening_balance: string
  closing_balance: string | null
  transaction_counts: Record<string, number>
  gross_sales: string
  total_tax: string
  total_discounts: string
  total_tips: string
  total_refunds: string
  net_sales: string
  payment_methods: Record<string, string>
  cash_movements: Record<string, string>
  expected_cash_in_drawer: string
  actual_cash_in_drawer: string | null
  cash_variance: string | null
  generated_at: string
}

export function useXReading(sessionId: string) {
  return useQuery({
    queryKey: ['pos', 'sessions', sessionId, 'x-reading'],
    queryFn: async () => {
      const { data } = await apiClient.get<FiscalReading>(`/pos/sessions/${sessionId}/x-reading`)
      return data
    },
    enabled: !!sessionId,
  })
}

export function useZReading(sessionId: string) {
  return useQuery({
    queryKey: ['pos', 'sessions', sessionId, 'z-reading'],
    queryFn: async () => {
      const { data } = await apiClient.get<FiscalReading>(`/pos/sessions/${sessionId}/z-reading`)
      return data
    },
    enabled: !!sessionId,
  })
}

// ─── Profitability Report ────────────────────────────────────────────────────

export interface ProfitabilityProduct {
  item_id: string
  item_name: string
  item_sku: string
  category: string | null
  quantity_sold: number
  revenue: string
  cost_price: string
  cogs: string
  gross_margin: string
  margin_percentage: string
}

export function useProfitabilityReport(params: { date_from?: string; date_to?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['pos', 'reports', 'profitability', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        products: ProfitabilityProduct[]
        summary: { total_revenue: string; total_cogs: string; total_gross_margin: string; overall_margin_percentage: string }
      }>('/pos/reports/profitability', { params })
      return data
    },
  })
}
