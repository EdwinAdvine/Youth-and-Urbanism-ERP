import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  is_base: boolean
  created_at: string
  updated_at: string
}

export interface ExchangeRate {
  id: string
  from_currency_id: string
  to_currency_id: string
  rate: number
  effective_date: string
  from_currency_code: string | null
  to_currency_code: string | null
  created_at: string
  updated_at: string
}

export interface BankStatement {
  id: string
  account_id: string
  statement_date: string
  opening_balance: number
  closing_balance: number
  file_url: string | null
  line_count: number
  matched_count: number
  is_reconciled: boolean
  created_at: string
  updated_at: string
}

export interface BankStatementLine {
  id: string
  statement_id: string
  date: string
  description: string
  amount: number
  matched_payment_id: string | null
  status: string
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

export interface Reconciliation {
  id: string
  statement_id: string
  reconciled_by: string
  reconciled_at: string
  notes: string | null
}

export interface AutoMatchResult {
  matched: number
  total_lines: number
}

export interface PnLAccountRow {
  account_id: string
  account_code: string
  account_name: string
  amount: number
}

export interface PnLReport {
  from: string
  to: string
  revenue: PnLAccountRow[]
  total_revenue: number
  expenses: PnLAccountRow[]
  total_expenses: number
  net_income: number
}

export interface BalanceSheetAccountRow {
  account_id: string
  account_code: string
  account_name: string
  balance: number
}

export interface BalanceSheetReport {
  as_of: string
  assets: BalanceSheetAccountRow[]
  total_assets: number
  liabilities: BalanceSheetAccountRow[]
  total_liabilities: number
  equity: BalanceSheetAccountRow[]
  total_equity: number
  total_liabilities_and_equity: number
  is_balanced: boolean
}

export interface StatementImportResult {
  id: string
  statement_date: string
  lines_imported: number
  closing_balance: string
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedCurrencies {
  total: number
  currencies: Currency[]
}

export interface PaginatedExchangeRates {
  total: number
  exchange_rates: ExchangeRate[]
}

export interface PaginatedBankStatements {
  total: number
  statements: BankStatement[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateCurrencyPayload {
  code: string
  name: string
  symbol: string
  is_base?: boolean
}

export interface UpdateCurrencyPayload {
  code?: string
  name?: string
  symbol?: string
  is_base?: boolean
}

export interface CreateExchangeRatePayload {
  from_currency_id: string
  to_currency_id: string
  rate: number
  effective_date: string
}

export interface ReconcilePayload {
  notes?: string
}

// ─── Currencies ───────────────────────────────────────────────────────────────

export function useCurrencies() {
  return useQuery({
    queryKey: ['finance', 'currencies'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedCurrencies>('/finance/currencies')
      return data
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
    mutationFn: async ({ id, ...payload }: UpdateCurrencyPayload & { id: string }) => {
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

// ─── Exchange Rates ───────────────────────────────────────────────────────────

export function useExchangeRates(params: { from_currency_id?: string; to_currency_id?: string } = {}) {
  return useQuery({
    queryKey: ['finance', 'exchange-rates', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedExchangeRates>('/finance/exchange-rates', { params })
      return data
    },
  })
}

export function useCreateExchangeRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateExchangeRatePayload) => {
      const { data } = await apiClient.post<ExchangeRate>('/finance/exchange-rates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'exchange-rates'] }),
  })
}

// ─── Bank Statements ──────────────────────────────────────────────────────────

export function useBankStatements(params: { account_id?: string } = {}) {
  return useQuery({
    queryKey: ['finance', 'bank-statements', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedBankStatements>('/finance/bank-statements', { params })
      return data
    },
  })
}

export function useBankStatement(statementId: string) {
  return useQuery({
    queryKey: ['finance', 'bank-statements', statementId],
    queryFn: async () => {
      const { data } = await apiClient.get<BankStatementDetail>(`/finance/bank-statements/${statementId}`)
      return data
    },
    enabled: !!statementId,
  })
}

export function useImportBankStatement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, account_id, statement_date }: { file: File; account_id: string; statement_date: string }) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<StatementImportResult>(
        '/finance/bank-statements/import',
        formData,
        {
          params: { account_id, statement_date },
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bank-statements'] }),
  })
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

export function useAutoMatchStatement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (statementId: string) => {
      const { data } = await apiClient.post<AutoMatchResult>(`/finance/bank-statements/${statementId}/auto-match`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bank-statements'] }),
  })
}

export function useReconcileStatement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ statementId, ...payload }: ReconcilePayload & { statementId: string }) => {
      const { data } = await apiClient.post<Reconciliation>(`/finance/bank-statements/${statementId}/reconcile`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bank-statements'] }),
  })
}

// ─── Financial Reports ────────────────────────────────────────────────────────

export function usePnLReport(params: { from: string; to: string }) {
  return useQuery({
    queryKey: ['finance', 'reports', 'pnl', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PnLReport>('/finance/reports/pnl', { params })
      return data
    },
    enabled: !!params.from && !!params.to,
  })
}

export function useBalanceSheetReport(params: { as_of: string }) {
  return useQuery({
    queryKey: ['finance', 'reports', 'balance-sheet', params],
    queryFn: async () => {
      const { data } = await apiClient.get<BalanceSheetReport>('/finance/reports/balance-sheet', { params })
      return data
    },
    enabled: !!params.as_of,
  })
}
