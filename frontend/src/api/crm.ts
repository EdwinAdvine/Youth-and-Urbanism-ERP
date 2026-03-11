import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContactType = 'person' | 'company'

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted'

export type OpportunityStage =
  | 'prospecting'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

export interface Contact {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  contact_type: ContactType
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ContactDetail extends Contact {
  leads: Lead[]
  opportunities: Opportunity[]
}

export interface Lead {
  id: string
  title: string
  contact_id: string
  contact_name?: string
  contact_email?: string
  status: LeadStatus
  source: string | null
  estimated_value: number | null
  assigned_to: string | null
  assigned_to_name?: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Opportunity {
  id: string
  title: string
  contact_id: string
  contact_name?: string
  lead_id: string | null
  stage: OpportunityStage
  value: number
  probability: number
  expected_close_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  title: string
  opportunity_id: string
  contact_id: string
  contact_name?: string
  value: number
  close_date: string
  status: string
  created_at: string
}

export interface PaginatedResponse<T> {
  total: number
  items: T[]
}

export interface PipelineStage {
  stage: OpportunityStage
  count: number
  total_value: number
  items: Opportunity[]
}

export interface PipelineResponse {
  stages: PipelineStage[]
}

export interface CRMStats {
  new_leads_this_month: number
  pipeline_value: number
  deals_closed_this_month: number
  deals_closed_value: number
  conversion_rate: number
  total_contacts: number
  total_leads: number
  total_opportunities: number
}

export interface CreateContactPayload {
  name: string
  email: string
  phone?: string | null
  company?: string | null
  contact_type: ContactType
  notes?: string | null
}

export interface UpdateContactPayload extends Partial<CreateContactPayload> {
  id: string
}

export interface CreateLeadPayload {
  title: string
  contact_id: string
  status?: LeadStatus
  source?: string | null
  estimated_value?: number | null
  assigned_to?: string | null
  notes?: string | null
}

export interface UpdateLeadPayload extends Partial<Omit<CreateLeadPayload, 'contact_id'>> {
  id: string
}

export interface CreateOpportunityPayload {
  title: string
  contact_id: string
  lead_id?: string | null
  stage?: OpportunityStage
  value: number
  probability?: number
  expected_close_date?: string | null
  notes?: string | null
}

export interface UpdateOpportunityPayload extends Partial<Omit<CreateOpportunityPayload, 'contact_id'>> {
  id: string
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export function useContacts(params: {
  page?: number
  limit?: number
  search?: string
  contact_type?: ContactType | ''
  is_active?: boolean
}) {
  return useQuery({
    queryKey: ['crm', 'contacts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/crm/contacts', {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          ...(params.search && { search: params.search }),
          ...(params.contact_type && { contact_type: params.contact_type }),
          ...(params.is_active !== undefined && { is_active: params.is_active }),
        },
      })
      return { total: data.total ?? 0, items: data.contacts ?? data.items ?? [] } as PaginatedResponse<Contact>
    },
  })
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['crm', 'contacts', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ContactDetail>(`/crm/contacts/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateContactPayload) => {
      const { data } = await apiClient.post<Contact>('/crm/contacts', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'contacts'] }),
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateContactPayload) => {
      const { data } = await apiClient.put<Contact>(`/crm/contacts/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'contacts'] }),
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/crm/contacts/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'contacts'] }),
  })
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export function useLeads(params: {
  page?: number
  limit?: number
  status?: LeadStatus | ''
  assigned_to?: string
}) {
  return useQuery({
    queryKey: ['crm', 'leads', params],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/crm/leads', {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 100,
          ...(params.status && { status: params.status }),
          ...(params.assigned_to && { assigned_to: params.assigned_to }),
        },
      })
      return { total: data.total ?? 0, items: data.leads ?? data.items ?? [] } as PaginatedResponse<Lead>
    },
  })
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['crm', 'leads', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Lead>(`/crm/leads/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateLeadPayload) => {
      const { data } = await apiClient.post<Lead>('/crm/leads', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] })
    },
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateLeadPayload) => {
      const { data } = await apiClient.put<Lead>(`/crm/leads/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] })
    },
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/crm/leads/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] })
    },
  })
}

export function useConvertLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Opportunity>(`/crm/leads/${id}/convert`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
      qc.invalidateQueries({ queryKey: ['crm', 'opportunities'] })
      qc.invalidateQueries({ queryKey: ['crm', 'pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] })
    },
  })
}

// ─── Opportunities ────────────────────────────────────────────────────────────

export function useOpportunities(params: {
  page?: number
  limit?: number
  stage?: OpportunityStage | ''
}) {
  return useQuery({
    queryKey: ['crm', 'opportunities', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Opportunity>>('/crm/opportunities', {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 100,
          ...(params.stage && { stage: params.stage }),
        },
      })
      return data
    },
  })
}

export function useOpportunity(id: string) {
  return useQuery({
    queryKey: ['crm', 'opportunities', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Opportunity>(`/crm/opportunities/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateOpportunityPayload) => {
      const { data } = await apiClient.post<Opportunity>('/crm/opportunities', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'opportunities'] })
      qc.invalidateQueries({ queryKey: ['crm', 'pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] })
    },
  })
}

export function useUpdateOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateOpportunityPayload) => {
      const { data } = await apiClient.put<Opportunity>(`/crm/opportunities/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'opportunities'] })
      qc.invalidateQueries({ queryKey: ['crm', 'pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] })
    },
  })
}

export function useCloseWon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Deal>(`/crm/opportunities/${id}/close-won`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'opportunities'] })
      qc.invalidateQueries({ queryKey: ['crm', 'pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] })
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] })
    },
  })
}

export function useCloseLost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/crm/opportunities/${id}/close-lost`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'opportunities'] })
      qc.invalidateQueries({ queryKey: ['crm', 'pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] })
    },
  })
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export function usePipeline() {
  return useQuery({
    queryKey: ['crm', 'pipeline'],
    queryFn: async () => {
      const { data } = await apiClient.get<PipelineResponse>('/crm/pipeline')
      return data
    },
  })
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export function useDeals(params: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['crm', 'deals', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Deal>>('/crm/deals', {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 20,
        },
      })
      return data
    },
  })
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export function useCRMStats() {
  return useQuery({
    queryKey: ['crm', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<CRMStats>('/crm/dashboard/stats')
      return data
    },
  })
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled'
export type CampaignType = 'email' | 'sms' | 'social' | 'event' | 'other'

export interface Campaign {
  id: string
  name: string
  description: string | null
  campaign_type: CampaignType
  status: CampaignStatus
  start_date: string | null
  end_date: string | null
  budget: number | null
  target_audience: string | null
  created_by: string | null
  created_by_name?: string
  contact_count: number
  created_at: string
  updated_at: string
}

export interface CampaignContact {
  id: string
  campaign_id: string
  contact_id: string
  contact_name?: string
  contact_email?: string
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'converted' | 'unsubscribed'
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
}

export interface CampaignAnalytics {
  total_contacts: number
  sent: number
  opened: number
  clicked: number
  converted: number
  unsubscribed: number
  open_rate: number
  click_rate: number
  conversion_rate: number
}

export interface CreateCampaignPayload {
  name: string
  description?: string
  campaign_type: CampaignType
  status?: CampaignStatus
  start_date?: string
  end_date?: string
  budget?: number
  target_audience?: string
  contact_ids?: string[]
}

export interface UpdateCampaignPayload extends Partial<Omit<CreateCampaignPayload, 'contact_ids'>> {
  id: string
}

export function useCampaigns(params: { status?: CampaignStatus; campaign_type?: CampaignType } = {}) {
  return useQuery({
    queryKey: ['crm', 'campaigns', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ campaigns: Campaign[] }>('/crm/campaigns', { params })
      return data.campaigns
    },
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
    mutationFn: async ({ id, ...payload }: UpdateCampaignPayload) => {
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

export function useLaunchCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Campaign>(`/crm/campaigns/${id}/launch`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] }),
  })
}

// ─── Quotes ──────────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'

export interface QuoteLineItem {
  id: string
  product_id: string | null
  product_name?: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  total: number
}

export interface Quote {
  id: string
  quote_number: string
  contact_id: string
  contact_name?: string
  opportunity_id: string | null
  status: QuoteStatus
  valid_until: string | null
  subtotal: number
  discount_total: number
  tax_total: number
  grand_total: number
  notes: string | null
  items: QuoteLineItem[]
  created_at: string
  updated_at: string
}

export interface CreateQuoteLinePayload {
  product_id?: string
  description: string
  quantity: number
  unit_price: number
  discount?: number
}

export interface CreateQuotePayload {
  contact_id: string
  opportunity_id?: string
  valid_until?: string
  notes?: string
  tax_rate?: number
  items: CreateQuoteLinePayload[]
}

export interface UpdateQuotePayload {
  id: string
  valid_until?: string
  notes?: string
  tax_rate?: number
  items?: CreateQuoteLinePayload[]
}

export function useQuotes(params: { status?: QuoteStatus; contact_id?: string } = {}) {
  return useQuery({
    queryKey: ['crm', 'quotes', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ quotes: Quote[] }>('/crm/quotes', { params })
      return data.quotes
    },
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
    mutationFn: async ({ id, ...payload }: UpdateQuotePayload) => {
      const { data } = await apiClient.put<Quote>(`/crm/quotes/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'quotes'] }),
  })
}

export function useSendQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Quote>(`/crm/quotes/${id}/send`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'quotes'] }),
  })
}

// ─── CRM Products ────────────────────────────────────────────────────────────

export interface CRMProduct {
  id: string
  name: string
  description: string | null
  sku: string | null
  price: number
  is_active: boolean
  category: string | null
  created_at: string
  updated_at: string
}

export interface CreateCRMProductPayload {
  name: string
  description?: string
  sku?: string
  price: number
  category?: string
}

export interface UpdateCRMProductPayload extends Partial<CreateCRMProductPayload> {
  id: string
  is_active?: boolean
}

export function useCRMProducts(params: { category?: string; is_active?: boolean } = {}) {
  return useQuery({
    queryKey: ['crm', 'products', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ products: CRMProduct[] }>('/crm/products', { params })
      return data.products
    },
  })
}

export function useCreateCRMProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCRMProductPayload) => {
      const { data } = await apiClient.post<CRMProduct>('/crm/products', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'products'] }),
  })
}

export function useUpdateCRMProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCRMProductPayload) => {
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

// ─── Pipeline Report & Sales Forecast ────────────────────────────────────────

export interface PipelineReport {
  total_pipeline_value: number
  win_rate: number
  avg_deal_size: number
  avg_days_to_close: number
  stage_breakdown: { stage: string; count: number; value: number; avg_probability: number }[]
  monthly_trend: { month: string; won: number; lost: number; value: number }[]
}

export interface SalesForecast {
  monthly_forecast: { month: string; expected_value: number; weighted_value: number; deal_count: number }[]
  quarterly_forecast: { quarter: string; expected_value: number; weighted_value: number }[]
  total_weighted: number
  total_expected: number
}

export function usePipelineReport(params: { date_from?: string; date_to?: string } = {}) {
  return useQuery({
    queryKey: ['crm', 'pipeline-report', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PipelineReport>('/crm/reports/pipeline', { params })
      return data
    },
  })
}

export function useSalesForecast(params: { months?: number } = {}) {
  return useQuery({
    queryKey: ['crm', 'sales-forecast', params],
    queryFn: async () => {
      const { data } = await apiClient.get<SalesForecast>('/crm/reports/sales-forecast', { params })
      return data
    },
  })
}

// ─── Contact Timeline ────────────────────────────────────────────────────────

export interface ContactTimelineEvent {
  id: string
  event_type: 'lead_created' | 'email_sent' | 'call' | 'meeting' | 'note' | 'deal_won' | 'deal_lost' | 'quote_sent' | 'status_change'
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  created_by_name?: string
  created_at: string
}

export function useContactTimeline(contactId: string) {
  return useQuery({
    queryKey: ['crm', 'contacts', contactId, 'timeline'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ events: ContactTimelineEvent[] }>(`/crm/contacts/${contactId}/timeline`)
      return data.events
    },
    enabled: !!contactId,
  })
}

// ─── Import / Export Contacts ────────────────────────────────────────────────

export function useImportContacts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post<{ imported: number; errors: string[] }>('/crm/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'contacts'] }),
  })
}

export function useExportContacts() {
  return useMutation({
    mutationFn: async (params: { format?: 'csv' | 'xlsx'; contact_type?: ContactType } = {}) => {
      const { data } = await apiClient.get('/crm/contacts/export', {
        params,
        responseType: 'blob',
      })
      return data
    },
  })
}

// ─── CRM Tickets ──────────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TicketChannel = 'email' | 'chat' | 'phone' | 'social' | 'web_form'

export interface CRMTicket {
  id: string
  contact_id: string | null
  subject: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  channel: TicketChannel
  tags: string[] | null
  assigned_to: string | null
  created_by: string
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateTicketPayload {
  contact_id?: string | null
  subject: string
  description?: string | null
  status?: TicketStatus
  priority?: TicketPriority
  channel?: TicketChannel
  tags?: string[] | null
  assigned_to?: string | null
}

export interface UpdateTicketPayload extends Partial<CreateTicketPayload> {
  id: string
}

export function useTickets(params: {
  page?: number
  limit?: number
  status?: TicketStatus | ''
  priority?: TicketPriority | ''
  assigned_to?: string
  search?: string
} = {}) {
  return useQuery({
    queryKey: ['crm', 'tickets', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; tickets: CRMTicket[] }>('/crm/tickets', {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          ...(params.status && { status: params.status }),
          ...(params.priority && { priority: params.priority }),
          ...(params.assigned_to && { assigned_to: params.assigned_to }),
          ...(params.search && { search: params.search }),
        },
      })
      return data
    },
  })
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['crm', 'tickets', id],
    queryFn: async () => {
      const { data } = await apiClient.get<CRMTicket>(`/crm/tickets/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTicketPayload) => {
      const { data } = await apiClient.post<CRMTicket>('/crm/tickets', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'tickets'] }),
  })
}

export function useUpdateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTicketPayload) => {
      const { data } = await apiClient.put<CRMTicket>(`/crm/tickets/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'tickets'] }),
  })
}

export function useDeleteTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/crm/tickets/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'tickets'] }),
  })
}

export function useAssignTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, assigned_to }: { id: string; assigned_to: string }) => {
      const { data } = await apiClient.put<CRMTicket>(`/crm/tickets/${id}/assign`, { assigned_to })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'tickets'] }),
  })
}

// ─── CRM Cross-Module Links ──────────────────────────────────────────────────

// -- Schedule Follow-up (CRM → Calendar) --

export interface ScheduleFollowupPayload {
  title: string
  start_time: string
  end_time: string
  description?: string
  color?: string
}

export interface FollowupResult {
  id: string
  title: string
  start_time: string
  end_time: string
  event_type: string
  linked_module: string
  linked_id: string
}

export function useScheduleContactFollowup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ contactId, ...payload }: ScheduleFollowupPayload & { contactId: string }) => {
      const { data } = await apiClient.post<FollowupResult>(
        `/crm/contacts/${contactId}/schedule-followup`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useScheduleDealFollowup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dealId, ...payload }: ScheduleFollowupPayload & { dealId: string }) => {
      const { data } = await apiClient.post<FollowupResult>(
        `/crm/deals/${dealId}/schedule-followup`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

// -- Schedule Meeting (CRM → Meetings) --

export interface ScheduleMeetingPayload {
  title: string
  start_time: string
  end_time: string
  description?: string
  attendees?: string[]
}

export interface MeetingResult {
  id: string
  title: string
  start_time: string
  end_time: string
  jitsi_room: string
  jitsi_room_url: string
  jitsi_jwt: string
  linked_module: string
  linked_id: string
}

export function useScheduleContactMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ contactId, ...payload }: ScheduleMeetingPayload & { contactId: string }) => {
      const { data } = await apiClient.post<MeetingResult>(
        `/crm/contacts/${contactId}/schedule-meeting`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
      qc.invalidateQueries({ queryKey: ['meetings'] })
    },
  })
}

export function useScheduleDealMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dealId, ...payload }: ScheduleMeetingPayload & { dealId: string }) => {
      const { data } = await apiClient.post<MeetingResult>(
        `/crm/deals/${dealId}/schedule-meeting`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] })
      qc.invalidateQueries({ queryKey: ['meetings'] })
    },
  })
}

// -- Lead Capture Forms (CRM → Forms) --

export interface LeadCaptureFormPayload {
  form_name: string
  fields?: { label: string; field_type: string; is_required?: boolean; order?: number }[]
  pipeline_id?: string
  auto_assign_to?: string
}

export interface LeadCaptureFormResult {
  id: string
  title: string
  description: string | null
  is_published: boolean
  settings: Record<string, unknown>
  fields: { id: string; label: string; field_type: string; is_required: boolean; order: number }[]
  form_url: string
}

export function useCreateLeadCaptureForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: LeadCaptureFormPayload) => {
      const { data } = await apiClient.post<LeadCaptureFormResult>('/crm/lead-capture-forms', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'lead-capture-forms'] })
      qc.invalidateQueries({ queryKey: ['forms'] })
    },
  })
}

export function useLeadCaptureForms() {
  return useQuery({
    queryKey: ['crm', 'lead-capture-forms'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ forms: { id: string; title: string; is_published: boolean; created_at: string }[] }>('/crm/lead-capture-forms')
      return data.forms
    },
  })
}

// -- E-Commerce Customer Sync (CRM → E-Commerce) --

export interface EcommerceSyncResult {
  action: string
  customer_id: string
  contact_id: string
  email: string
  message: string
}

export function useSyncContactToEcommerce() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ contactId, store_id }: { contactId: string; store_id: string }) => {
      const { data } = await apiClient.post<EcommerceSyncResult>(
        `/crm/contacts/${contactId}/sync-ecommerce`,
        { store_id },
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'contacts'] }),
  })
}

export interface EcommerceImportResult {
  imported: number
  linked: number
  skipped: number
  total_processed: number
  store_id: string
}

export function useImportFromEcommerce() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { store_id: string; customer_ids?: string[] }) => {
      const { data } = await apiClient.post<EcommerceImportResult>(
        '/crm/contacts/import-from-ecommerce',
        payload,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'contacts'] }),
  })
}
