import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  currency: string
  description: string
  is_active: boolean
  balance: number
  created_at: string
  updated_at: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type InvoiceType = 'sales' | 'purchase'

export interface InvoiceLineItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export interface Invoice {
  id: string
  invoice_number: string
  type: InvoiceType
  status: InvoiceStatus
  customer_name: string
  customer_email: string
  issue_date: string
  due_date: string
  line_items: InvoiceLineItem[]
  subtotal: number
  tax_amount: number
  total: number
  notes: string
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  amount: number
  method: string
  reference: string
  invoice_id: string | null
  invoice_number?: string
  description: string
  payment_date: string
  created_at: string
}

export type JournalEntryStatus = 'draft' | 'posted'

export interface JournalLine {
  account_id: string
  account_name?: string
  debit: number
  credit: number
  description: string
}

export interface JournalEntry {
  id: string
  entry_number: string
  date: string
  description: string
  status: JournalEntryStatus
  lines: JournalLine[]
  total_debit: number
  total_credit: number
  created_at: string
  updated_at: string
}

export interface TrialBalanceRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: AccountType
  debit_total: number
  credit_total: number
}

export interface FinanceStats {
  revenue_mtd: number
  outstanding_invoices_count: number
  outstanding_invoices_amount: number
  payments_today: number
  total_accounts: number
  total_invoices: number
}

export interface PaginatedResponse<T> {
  total: number
  items: T[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateAccountPayload {
  code: string
  name: string
  type: AccountType
  currency?: string
  description?: string
}

export interface UpdateAccountPayload extends Partial<CreateAccountPayload> {
  id: string
}

export interface CreateInvoicePayload {
  type: InvoiceType
  customer_name: string
  customer_email?: string
  issue_date: string
  due_date: string
  line_items: Omit<InvoiceLineItem, 'id' | 'amount'>[]
  tax_amount?: number
  notes?: string
}

export interface UpdateInvoicePayload extends Partial<CreateInvoicePayload> {
  id: string
}

export interface CreatePaymentPayload {
  amount: number
  method: string
  reference?: string
  invoice_id?: string | null
  description?: string
  payment_date?: string
}

export interface CreateJournalEntryPayload {
  date: string
  description: string
  lines: Omit<JournalLine, 'account_name'>[]
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export function useAccounts(type?: AccountType) {
  return useQuery({
    queryKey: ['finance', 'accounts', type],
    queryFn: async () => {
      const params = type ? { type } : {}
      const { data } = await apiClient.get<Account[]>('/finance/accounts', { params })
      return data
    },
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAccountPayload) => {
      const { data } = await apiClient.post<Account>('/finance/accounts', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'accounts'] }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateAccountPayload) => {
      const { data } = await apiClient.put<Account>(`/finance/accounts/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'accounts'] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/finance/accounts/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'accounts'] }),
  })
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export function useInvoices(params: { page?: number; limit?: number; status?: string; type?: string } = {}) {
  return useQuery({
    queryKey: ['finance', 'invoices', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Invoice>>('/finance/invoices', { params })
      return data
    },
  })
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['finance', 'invoices', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Invoice>(`/finance/invoices/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateInvoicePayload) => {
      const { data } = await apiClient.post<Invoice>('/finance/invoices', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'invoices'] }),
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateInvoicePayload) => {
      const { data } = await apiClient.put<Invoice>(`/finance/invoices/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'invoices'] })
    },
  })
}

export function useSendInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Invoice>(`/finance/invoices/${id}/send`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'invoices'] }),
  })
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Invoice>(`/finance/invoices/${id}/mark-paid`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'invoices'] })
      qc.invalidateQueries({ queryKey: ['finance', 'dashboard'] })
    },
  })
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function usePayments(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['finance', 'payments', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Payment>>('/finance/payments', { params })
      return data
    },
  })
}

export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePaymentPayload) => {
      const { data } = await apiClient.post<Payment>('/finance/payments', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'payments'] })
      qc.invalidateQueries({ queryKey: ['finance', 'dashboard'] })
    },
  })
}

// ─── Journal Entries ──────────────────────────────────────────────────────────

export function useJournalEntries(params: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['finance', 'journal-entries', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<JournalEntry>>('/finance/journal-entries', { params })
      return data
    },
  })
}

export function useCreateJournalEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateJournalEntryPayload) => {
      const { data } = await apiClient.post<JournalEntry>('/finance/journal-entries', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'journal-entries'] }),
  })
}

export function usePostJournalEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<JournalEntry>(`/finance/journal-entries/${id}/post`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'journal-entries'] }),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useTrialBalance() {
  return useQuery({
    queryKey: ['finance', 'reports', 'trial-balance'],
    queryFn: async () => {
      const { data } = await apiClient.get<TrialBalanceRow[]>('/finance/reports/trial-balance')
      return data
    },
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useFinanceStats() {
  return useQuery({
    queryKey: ['finance', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<FinanceStats>('/finance/dashboard/stats')
      return data
    },
  })
}

// ─── Budget & Tax Types ───────────────────────────────────────────────────────

export interface BudgetLine {
  id: string
  account_id: string
  allocated: number
  spent: number
  account?: { name: string; code: string }
}

export interface Budget {
  id: string
  name: string
  fiscal_year: number
  department_id: string | null
  total_amount: number
  spent_amount: number
  status: string
  lines: BudgetLine[]
  created_at: string
}

export interface TaxRate {
  id: string
  name: string
  rate: number
  is_default: boolean
  is_active: boolean
  created_at: string
}

export interface BudgetVsActualRow {
  budget_id: string
  budget_name: string
  account_id: string
  account_name: string
  account_code: string
  allocated: number
  spent: number
  remaining: number
  variance_pct: number
}

export interface CreateBudgetLinePayload {
  account_id: string
  allocated: number
}

export interface CreateBudgetPayload {
  name: string
  fiscal_year: number
  department_id?: string | null
  status?: string
  lines: CreateBudgetLinePayload[]
}

export interface UpdateBudgetPayload extends Partial<Omit<CreateBudgetPayload, 'lines'>> {
  id: string
}

export interface CreateTaxRatePayload {
  name: string
  rate: number
  is_default?: boolean
}

export interface UpdateTaxRatePayload extends Partial<CreateTaxRatePayload> {
  id: string
  is_active?: boolean
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export function useBudgets(fiscal_year?: number) {
  return useQuery({
    queryKey: ['finance', 'budgets', fiscal_year],
    queryFn: async () => {
      const params = fiscal_year ? { fiscal_year } : {}
      const { data } = await apiClient.get<Budget[]>('/finance/budgets', { params })
      return data
    },
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateBudgetPayload) => {
      const { data } = await apiClient.post<Budget>('/finance/budgets', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'budgets'] }),
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateBudgetPayload) => {
      const { data } = await apiClient.put<Budget>(`/finance/budgets/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'budgets'] }),
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/finance/budgets/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'budgets'] }),
  })
}

export function useBudgetVsActual(fiscal_year: number) {
  return useQuery({
    queryKey: ['finance', 'reports', 'budget-vs-actual', fiscal_year],
    queryFn: async () => {
      const { data } = await apiClient.get<BudgetVsActualRow[]>('/finance/reports/budget-vs-actual', {
        params: { fiscal_year },
      })
      return data
    },
    enabled: !!fiscal_year,
  })
}

// ─── Tax Rates ────────────────────────────────────────────────────────────────

export function useTaxRates() {
  return useQuery({
    queryKey: ['finance', 'tax-rates'],
    queryFn: async () => {
      const { data } = await apiClient.get<TaxRate[]>('/finance/tax-rates')
      return data
    },
  })
}

export function useCreateTaxRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTaxRatePayload) => {
      const { data } = await apiClient.post<TaxRate>('/finance/tax-rates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'tax-rates'] }),
  })
}

export function useUpdateTaxRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTaxRatePayload) => {
      const { data } = await apiClient.put<TaxRate>(`/finance/tax-rates/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'tax-rates'] }),
  })
}

// ─── Currency Types & Hooks ──────────────────────────────────────────────────

export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  is_base: boolean
  created_at: string
  updated_at: string
}

export interface ExchangeRateEntry {
  id: string
  from_currency_id: string
  to_currency_id: string
  rate: number
  effective_date: string
  from_currency_code?: string
  to_currency_code?: string
  created_at: string
}

export interface CreateCurrencyPayload {
  code: string
  name: string
  symbol: string
  is_base?: boolean
}

export interface CreateExchangeRatePayload {
  from_currency_id: string
  to_currency_id: string
  rate: number
  effective_date: string
}

export function useCurrencies() {
  return useQuery({
    queryKey: ['finance', 'currencies'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ currencies: Currency[] }>('/finance/currencies')
      return data.currencies
    },
  })
}

export function useCreateCurrency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCurrencyPayload) => {
      const { data } = await apiClient.post<Currency>('/finance/currencies', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'currencies'] }),
  })
}

export function useUpdateCurrency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateCurrencyPayload> & { id: string }) => {
      const { data } = await apiClient.put<Currency>(`/finance/currencies/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'currencies'] }),
  })
}

export function useDeleteCurrency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/finance/currencies/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'currencies'] }),
  })
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ['finance', 'exchange-rates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ exchange_rates: ExchangeRateEntry[] }>('/finance/exchange-rates')
      return data.exchange_rates
    },
  })
}

export function useCreateExchangeRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateExchangeRatePayload) => {
      const { data } = await apiClient.post<ExchangeRateEntry>('/finance/exchange-rates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'exchange-rates'] }),
  })
}

// ─── Bank Statement Types & Hooks ────────────────────────────────────────────

export interface BankStatementSummary {
  id: string
  account_id: string
  statement_date: string
  opening_balance: number
  closing_balance: number
  line_count: number
  matched_count: number
  is_reconciled: boolean
  created_at: string
}

export interface BankStatementLine {
  id: string
  statement_id: string
  date: string
  description: string
  amount: number
  matched_payment_id: string | null
  status: 'unmatched' | 'matched' | 'excluded'
}

export interface BankStatementDetail {
  id: string
  account_id: string
  account_name: string | null
  statement_date: string
  opening_balance: string
  closing_balance: string
  is_reconciled: boolean
  lines: BankStatementLine[]
}

export function useBankStatements(accountId?: string) {
  return useQuery({
    queryKey: ['finance', 'bank-statements', accountId],
    queryFn: async () => {
      const params = accountId ? { account_id: accountId } : {}
      const { data } = await apiClient.get<{ statements: BankStatementSummary[] }>('/finance/bank-statements', { params })
      return data.statements
    },
  })
}

export function useBankStatement(id: string) {
  return useQuery({
    queryKey: ['finance', 'bank-statements', id],
    queryFn: async () => {
      const { data } = await apiClient.get<BankStatementDetail>(`/finance/bank-statements/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useImportBankStatement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, statementDate, file }: { accountId: string; statementDate: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post(
        `/finance/bank-statements/import?account_id=${accountId}&statement_date=${statementDate}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bank-statements'] }),
  })
}

export function useAutoMatchStatement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (statementId: string) => {
      const { data } = await apiClient.post(`/finance/bank-statements/${statementId}/auto-match`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bank-statements'] }),
  })
}

export function useReconcileStatement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ statementId, notes }: { statementId: string; notes?: string }) => {
      const { data } = await apiClient.post(`/finance/bank-statements/${statementId}/reconcile`, { notes })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bank-statements'] }),
  })
}

// ─── P&L & Balance Sheet Hooks ───────────────────────────────────────────────

export interface PnLReport {
  from: string
  to: string
  revenue: { account_id: string; account_code: string; account_name: string; amount: number }[]
  total_revenue: number
  expenses: { account_id: string; account_code: string; account_name: string; amount: number }[]
  total_expenses: number
  net_income: number
}

export interface BalanceSheetReport {
  as_of: string
  assets: { account_id: string; account_code: string; account_name: string; balance: number }[]
  total_assets: number
  liabilities: { account_id: string; account_code: string; account_name: string; balance: number }[]
  total_liabilities: number
  equity: { account_id: string; account_code: string; account_name: string; balance: number }[]
  total_equity: number
  total_liabilities_and_equity: number
  is_balanced: boolean
}

export function usePnLReport(from: string, to: string) {
  return useQuery({
    queryKey: ['finance', 'reports', 'pnl', from, to],
    queryFn: async () => {
      const { data } = await apiClient.get<PnLReport>('/finance/reports/pnl', { params: { from, to } })
      return data
    },
    enabled: !!from && !!to,
  })
}

export function useBalanceSheet(asOf: string) {
  return useQuery({
    queryKey: ['finance', 'reports', 'balance-sheet', asOf],
    queryFn: async () => {
      const { data } = await apiClient.get<BalanceSheetReport>('/finance/reports/balance-sheet', { params: { as_of: asOf } })
      return data
    },
    enabled: !!asOf,
  })
}
