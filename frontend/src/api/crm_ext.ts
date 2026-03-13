/**
 * CRM Extended API client — campaigns, quotes, products, custom fields,
 * scoring rules, and bulk import.
 *
 * Exports TanStack Query hooks and Axios helper functions for extended CRM
 * features. All requests go through `client.ts` (Axios instance with auth
 * interceptors). Backend prefix: `/api/v1/crm`.
 *
 * Key exports:
 *   - useCampaigns() / useCreateCampaign() — marketing campaign management
 *   - useQuotes() / useCreateQuote() — sales quotes linked to deals
 *   - useCRMProducts() / useCreateCRMProduct() — product/service catalog
 *   - useCustomFieldDefinitions() / useCreateCustomFieldDefinition() — per-entity custom fields
 *   - useScoringRules() / useCreateScoringRule() — lead/deal scoring configuration
 *   - useContactImport() — bulk CSV contact import with error reporting
 *   - useCampaignStats() — campaign performance metrics (open/click rates, ROI)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string
  name: string
  campaign_type: string
  status: string
  budget: number | null
  spent: number
  start_date: string | null
  end_date: string | null
  description: string | null
  owner_id: string
  contacts_count?: number
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  deal_id: string | null
  contact_id: string
  quote_number: string
  items: Record<string, unknown>[] | null
  subtotal: number
  tax_amount: number
  total: number
  status: string
  valid_until: string | null
  notes: string | null
  owner_id: string
  contact_name?: string
  deal_title?: string
  created_at: string
  updated_at: string
}

export interface CRMProduct {
  id: string
  name: string
  description: string | null
  price: number
  sku: string
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PipelineStage {
  stage: string
  count: number
  total_value: number
  conversion_rate: number
}

export interface PipelineReport {
  total_opportunities: number
  stages: PipelineStage[]
  win_rate: number
}

export interface SalesForecastMonth {
  month: string
  opportunity_count: number
  total_value: number
  weighted_value: number
}

export interface SalesForecast {
  forecasts: SalesForecastMonth[]
}

export interface TimelineEntry {
  type: string
  id: string
  title: string
  status: string | null
  value: number | null
  timestamp: string
}

export interface ContactTimeline {
  contact_id: string
  contact_name: string
  timeline: TimelineEntry[]
}

export interface CampaignAnalytics {
  campaign_id: string
  name: string
  total_contacts: number
  status_breakdown: Record<string, number>
  sent: number
  open_rate: number
  click_rate: number
  conversion_rate: number
  budget: number | null
  spent: number
  roi: number | null
}

export interface ImportResult {
  created: number
  skipped: number
  errors: { row: number; error: string }[]
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedCampaigns {
  total: number
  campaigns: Campaign[]
}

export interface PaginatedQuotes {
  total: number
  quotes: Quote[]
}

export interface PaginatedProducts {
  total: number
  products: CRMProduct[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateCampaignPayload {
  name: string
  campaign_type?: string
  status?: string
  budget?: number
  spent?: number
  start_date?: string
  end_date?: string
  description?: string
}

export interface UpdateCampaignPayload {
  name?: string
  campaign_type?: string
  status?: string
  budget?: number
  spent?: number
  start_date?: string
  end_date?: string
  description?: string
}

export interface CreateQuotePayload {
  deal_id?: string
  contact_id: string
  quote_number: string
  items?: Record<string, unknown>[]
  subtotal: number
  tax_amount?: number
  total: number
  status?: string
  valid_until?: string
  notes?: string
}

export interface UpdateQuotePayload {
  deal_id?: string
  contact_id?: string
  quote_number?: string
  items?: Record<string, unknown>[]
  subtotal?: number
  tax_amount?: number
  total?: number
  status?: string
  valid_until?: string
  notes?: string
}

export interface CreateProductPayload {
  name: string
  description?: string
  price: number
  sku: string
  category?: string
  is_active?: boolean
}

export interface UpdateProductPayload {
  name?: string
  description?: string
  price?: number
  sku?: string
  category?: string
  is_active?: boolean
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export function useCampaigns(params: { status?: string; campaign_type?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['crm', 'campaigns', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedCampaigns>('/crm/campaigns', { params })
      return data
    },
  })
}

export function useCampaign(campaignId: string) {
  return useQuery({
    queryKey: ['crm', 'campaigns', campaignId],
    queryFn: async () => {
      const { data } = await apiClient.get<Campaign>(`/crm/campaigns/${campaignId}`)
      return data
    },
    enabled: !!campaignId,
  })
}

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCampaignPayload) => {
      const { data } = await apiClient.post<Campaign>('/crm/campaigns', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] }),
  })
}

export function useUpdateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCampaignPayload & { id: string }) => {
      const { data } = await apiClient.put<Campaign>(`/crm/campaigns/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] }),
  })
}

export function useDeleteCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/crm/campaigns/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] }),
  })
}

export function useCampaignAnalytics(campaignId: string) {
  return useQuery({
    queryKey: ['crm', 'campaigns', campaignId, 'analytics'],
    queryFn: async () => {
      const { data } = await apiClient.get<CampaignAnalytics>(`/crm/campaigns/${campaignId}/analytics`)
      return data
    },
    enabled: !!campaignId,
  })
}

export function useSendCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await apiClient.post<{ campaign_id: string; sent_count: number }>(`/crm/campaigns/${campaignId}/send`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] }),
  })
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

export function useQuotes(params: { status?: string; contact_id?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['crm', 'quotes', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedQuotes>('/crm/quotes', { params })
      return data
    },
  })
}

export function useQuote(quoteId: string) {
  return useQuery({
    queryKey: ['crm', 'quotes', quoteId],
    queryFn: async () => {
      const { data } = await apiClient.get<Quote>(`/crm/quotes/${quoteId}`)
      return data
    },
    enabled: !!quoteId,
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateQuotePayload) => {
      const { data } = await apiClient.post<Quote>('/crm/quotes', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'quotes'] }),
  })
}

export function useUpdateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateQuotePayload & { id: string }) => {
      const { data } = await apiClient.put<Quote>(`/crm/quotes/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'quotes'] }),
  })
}

export function useSendQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data } = await apiClient.post<Quote>(`/crm/quotes/${quoteId}/send`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'quotes'] }),
  })
}

// ─── Products ─────────────────────────────────────────────────────────────────

export function useCRMProducts(params: { category?: string; active_only?: boolean; search?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['crm', 'products', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedProducts>('/crm/products', { params })
      return data
    },
  })
}

export function useCRMProduct(productId: string) {
  return useQuery({
    queryKey: ['crm', 'products', productId],
    queryFn: async () => {
      const { data } = await apiClient.get<CRMProduct>(`/crm/products/${productId}`)
      return data
    },
    enabled: !!productId,
  })
}

export function useCreateCRMProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateProductPayload) => {
      const { data } = await apiClient.post<CRMProduct>('/crm/products', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'products'] }),
  })
}

export function useUpdateCRMProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateProductPayload & { id: string }) => {
      const { data } = await apiClient.put<CRMProduct>(`/crm/products/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'products'] }),
  })
}

export function useDeleteCRMProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/crm/products/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'products'] }),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function usePipelineReport() {
  return useQuery({
    queryKey: ['crm', 'reports', 'pipeline'],
    queryFn: async () => {
      const { data } = await apiClient.get<PipelineReport>('/crm/reports/pipeline')
      return data
    },
  })
}

export function useSalesForecast(params: { months_ahead?: number } = {}) {
  return useQuery({
    queryKey: ['crm', 'reports', 'sales-forecast', params],
    queryFn: async () => {
      const { data } = await apiClient.get<SalesForecast>('/crm/reports/sales-forecast', { params })
      return data
    },
  })
}

// ─── Contact Timeline ─────────────────────────────────────────────────────────

export function useContactTimeline(contactId: string) {
  return useQuery({
    queryKey: ['crm', 'contacts', contactId, 'timeline'],
    queryFn: async () => {
      const { data } = await apiClient.get<ContactTimeline>(`/crm/contacts/${contactId}/timeline`)
      return data
    },
    enabled: !!contactId,
  })
}

// ─── Contact Import / Export ──────────────────────────────────────────────────

export function useImportContacts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<ImportResult>('/crm/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'contacts'] }),
  })
}

export function useExportContacts() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get('/crm/contacts/export', {
        responseType: 'blob',
      })
      return data
    },
  })
}
