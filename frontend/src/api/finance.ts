import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface Account {
  id: string
  code: string
  name: string
  account_type: AccountType
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
  invoice_type: InvoiceType
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
  payment_number: string
  amount: number
  currency: string
  payment_method: string
  reference: string | null
  invoice_id: string | null
  payment_date: string
  status: string
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
  entry_date: string
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
  account_type: AccountType
  currency?: string
  description?: string
}

export interface UpdateAccountPayload extends Partial<CreateAccountPayload> {
  id: string
}

export interface CreateInvoicePayload {
  invoice_type: InvoiceType
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
  payment_method?: string
  reference?: string
  invoice_id?: string | null
  payment_date?: string
}

export interface CreateJournalEntryPayload {
  entry_date: string
  description: string
  lines: Omit<JournalLine, 'account_name'>[]
}

// ─── Invoice PDF Export ──────────────────────────────────────────────────────

export async function exportInvoicePDF(invoiceId: string) {
  const { data } = await apiClient.get(`/finance/invoices/${invoiceId}/pdf`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `invoice-${invoiceId}.html`
  a.click()
  window.URL.revokeObjectURL(url)
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
      const { data } = await apiClient.get<any>('/finance/invoices', { params })
      return { total: data.total ?? 0, items: data.invoices ?? data.items ?? [] } as PaginatedResponse<Invoice>
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
      const { data } = await apiClient.get<any>('/finance/payments', { params })
      return { total: data.total ?? 0, items: data.payments ?? data.items ?? [] } as PaginatedResponse<Payment>
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
      const { data } = await apiClient.get<any>('/finance/journal-entries', { params })
      return { total: data.total ?? 0, items: data.journal_entries ?? data.items ?? [] } as PaginatedResponse<JournalEntry>
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

export interface CashFlowReport {
  from: string
  to: string
  operating: { description: string; amount: number }[]
  total_operating: number
  investing: { description: string; amount: number }[]
  total_investing: number
  financing: { description: string; amount: number }[]
  total_financing: number
  net_change: number
}

export function useCashFlowReport(from: string, to: string) {
  return useQuery({
    queryKey: ['finance', 'reports', 'cash-flow', from, to],
    queryFn: async () => {
      const { data } = await apiClient.get<CashFlowReport>('/finance/reports/cash-flow', { params: { from, to } })
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

// ─── Recurring Invoice Types & Hooks ─────────────────────────────────────────

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RecurringInvoice {
  id: string
  customer_name: string
  customer_email: string
  frequency: RecurringFrequency
  next_date: string
  end_date: string | null
  is_active: boolean
  line_items: InvoiceLineItem[]
  subtotal: number
  tax_amount: number
  total: number
  notes: string
  last_generated_at: string | null
  generated_count: number
  created_at: string
  updated_at: string
}

export interface CreateRecurringInvoicePayload {
  customer_name: string
  customer_email?: string
  frequency: RecurringFrequency
  next_date: string
  end_date?: string | null
  line_items: Omit<InvoiceLineItem, 'id' | 'amount'>[]
  tax_amount?: number
  notes?: string
}

export interface UpdateRecurringInvoicePayload extends Partial<CreateRecurringInvoicePayload> {
  id: string
  is_active?: boolean
}

export function useRecurringInvoices(params: { page?: number; limit?: number; is_active?: boolean } = {}) {
  return useQuery({
    queryKey: ['finance', 'recurring-invoices', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/finance/recurring-invoices', { params })
      return { total: data.total ?? 0, items: data.recurring_invoices ?? data.items ?? [] } as PaginatedResponse<RecurringInvoice>
    },
  })
}

export function useCreateRecurringInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateRecurringInvoicePayload) => {
      const { data } = await apiClient.post<RecurringInvoice>('/finance/recurring-invoices', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'recurring-invoices'] }),
  })
}

export function useUpdateRecurringInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRecurringInvoicePayload) => {
      const { data } = await apiClient.put<RecurringInvoice>(`/finance/recurring-invoices/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'recurring-invoices'] }),
  })
}

export function useDeleteRecurringInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/finance/recurring-invoices/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'recurring-invoices'] }),
  })
}

export function useGenerateRecurringInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Invoice>(`/finance/recurring-invoices/${id}/generate`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'recurring-invoices'] })
      qc.invalidateQueries({ queryKey: ['finance', 'invoices'] })
    },
  })
}

// ─── Expense Types & Hooks ───────────────────────────────────────────────────

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed'
export type ExpenseCategory = 'travel' | 'meals' | 'supplies' | 'equipment' | 'software' | 'services' | 'utilities' | 'marketing' | 'other'

export interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  category: ExpenseCategory
  expense_date: string
  receipt_file_id: string | null
  status: ExpenseStatus
  user_id: string
  approver_id: string | null
  approved_at: string | null
  rejection_reason: string | null
  account_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateExpensePayload {
  description: string
  amount: number
  currency?: string
  category: ExpenseCategory
  expense_date: string
  receipt_file_id?: string | null
  account_id?: string | null
}

export interface UpdateExpensePayload extends Partial<CreateExpensePayload> {
  id: string
}

export function useExpenses(params: { page?: number; limit?: number; status?: string; category?: string; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['finance', 'expenses', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/finance/expenses', { params })
      return { total: data.total ?? 0, items: data.expenses ?? data.items ?? [] } as PaginatedResponse<Expense>
    },
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateExpensePayload) => {
      const { data } = await apiClient.post<Expense>('/finance/expenses', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'expenses'] }),
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateExpensePayload) => {
      const { data } = await apiClient.put<Expense>(`/finance/expenses/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'expenses'] }),
  })
}

export function useSubmitExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<Expense>(`/finance/expenses/${id}/submit`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'expenses'] }),
  })
}

export function useApproveExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<Expense>(`/finance/expenses/${id}/approve`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'expenses'] }),
  })
}

export function useRejectExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await apiClient.put<Expense>(`/finance/expenses/${id}/reject`, { reason })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'expenses'] }),
  })
}

export function useReimburseExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<Expense>(`/finance/expenses/${id}/reimburse`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'expenses'] }),
  })
}

export function useUploadReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ expenseId, file }: { expenseId: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post(`/finance/expenses/${expenseId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'expenses'] }),
  })
}

export async function getExpenseReceiptUrl(expenseId: string): Promise<string> {
  const { data } = await apiClient.get<{ url: string }>(`/finance/expenses/${expenseId}/receipt`)
  return data.url
}

// ─── Vendor Bill Types & Hooks ───────────────────────────────────────────────

export type VendorBillStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'cancelled'

export interface VendorBillLineItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export interface VendorBill {
  id: string
  bill_number: string
  vendor_name: string
  vendor_email: string
  status: VendorBillStatus
  issue_date: string
  due_date: string
  line_items: VendorBillLineItem[]
  subtotal: number
  tax_amount: number
  total: number
  notes: string
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateVendorBillPayload {
  vendor_name: string
  vendor_email?: string
  issue_date: string
  due_date: string
  line_items: Omit<VendorBillLineItem, 'id' | 'amount'>[]
  tax_amount?: number
  notes?: string
}

export interface UpdateVendorBillPayload extends Partial<CreateVendorBillPayload> {
  id: string
}

export function useVendorBills(params: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['finance', 'vendor-bills', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/finance/vendor-bills', { params })
      return { total: data.total ?? 0, items: data.vendor_bills ?? data.items ?? [] } as PaginatedResponse<VendorBill>
    },
  })
}

export function useCreateVendorBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateVendorBillPayload) => {
      const { data } = await apiClient.post<VendorBill>('/finance/vendor-bills', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'vendor-bills'] }),
  })
}

export function useUpdateVendorBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateVendorBillPayload) => {
      const { data } = await apiClient.put<VendorBill>(`/finance/vendor-bills/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'vendor-bills'] }),
  })
}

export function useApproveVendorBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<VendorBill>(`/finance/vendor-bills/${id}/approve`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'vendor-bills'] }),
  })
}

export function usePayVendorBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<VendorBill>(`/finance/vendor-bills/${id}/pay`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'vendor-bills'] })
      qc.invalidateQueries({ queryKey: ['finance', 'payments'] })
    },
  })
}

export function useDeleteVendorBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/finance/vendor-bills/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'vendor-bills'] }),
  })
}

// ─── Fixed Asset Types & Hooks ───────────────────────────────────────────────

export type DepreciationMethod = 'straight_line' | 'declining_balance' | 'sum_of_years'
export type AssetStatus = 'active' | 'fully_depreciated' | 'disposed'

export interface FixedAsset {
  id: string
  name: string
  asset_code: string
  category: string
  status: AssetStatus
  purchase_date: string
  purchase_cost: number
  salvage_value: number
  useful_life_years: number
  depreciation_method: DepreciationMethod
  accumulated_depreciation: number
  current_value: number
  disposed_at: string | null
  disposal_amount: number | null
  notes: string
  created_at: string
  updated_at: string
}

export interface CreateFixedAssetPayload {
  name: string
  asset_code: string
  category: string
  purchase_date: string
  purchase_cost: number
  salvage_value?: number
  useful_life_years: number
  depreciation_method: DepreciationMethod
  notes?: string
}

export interface UpdateFixedAssetPayload extends Partial<CreateFixedAssetPayload> {
  id: string
}

export function useFixedAssets(params: { page?: number; limit?: number; status?: string; category?: string } = {}) {
  return useQuery({
    queryKey: ['finance', 'fixed-assets', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/finance/fixed-assets', { params })
      return { total: data.total ?? 0, items: data.fixed_assets ?? data.items ?? [] } as PaginatedResponse<FixedAsset>
    },
  })
}

export function useCreateFixedAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateFixedAssetPayload) => {
      const { data } = await apiClient.post<FixedAsset>('/finance/fixed-assets', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fixed-assets'] }),
  })
}

export function useUpdateFixedAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateFixedAssetPayload) => {
      const { data } = await apiClient.put<FixedAsset>(`/finance/fixed-assets/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fixed-assets'] }),
  })
}

export function useDepreciateAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<FixedAsset>(`/finance/fixed-assets/${id}/depreciate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fixed-assets'] }),
  })
}

export function useDisposeAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, disposal_amount }: { id: string; disposal_amount: number }) => {
      const { data } = await apiClient.post<FixedAsset>(`/finance/fixed-assets/${id}/dispose`, { disposal_amount })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fixed-assets'] }),
  })
}

// ─── Aged Receivables & Payables Types & Hooks ───────────────────────────────

export interface AgedItem {
  id: string
  name: string
  reference: string
  total: number
  current: number
  days_30: number
  days_60: number
  days_90: number
  days_120_plus: number
}

export interface AgedReport {
  items: AgedItem[]
  totals: {
    total: number
    current: number
    days_30: number
    days_60: number
    days_90: number
    days_120_plus: number
  }
  as_of: string
}

export function useAgedReceivables(asOf?: string) {
  return useQuery({
    queryKey: ['finance', 'reports', 'aged-receivables', asOf],
    queryFn: async () => {
      const params = asOf ? { as_of: asOf } : {}
      const { data } = await apiClient.get<AgedReport>('/finance/reports/aged-receivables', { params })
      return data
    },
  })
}

export function useAgedPayables(asOf?: string) {
  return useQuery({
    queryKey: ['finance', 'reports', 'aged-payables', asOf],
    queryFn: async () => {
      const params = asOf ? { as_of: asOf } : {}
      const { data } = await apiClient.get<AgedReport>('/finance/reports/aged-payables', { params })
      return data
    },
  })
}

// ─── Finance KPI Types & Hooks ───────────────────────────────────────────────

export interface FinanceKPIs {
  revenue: number
  revenue_prev_period: number
  revenue_change_pct: number
  expenses: number
  expenses_prev_period: number
  expenses_change_pct: number
  profit: number
  profit_prev_period: number
  profit_change_pct: number
  cash_position: number
  cash_position_prev_period: number
  cash_position_change_pct: number
  accounts_receivable: number
  accounts_payable: number
  gross_margin_pct: number
  net_margin_pct: number
  current_ratio: number
  quick_ratio: number
}

export function useFinanceKPIs(from?: string, to?: string) {
  return useQuery({
    queryKey: ['finance', 'kpis', from, to],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await apiClient.get<FinanceKPIs>('/finance/reports/kpis', { params })
      return data
    },
  })
}
