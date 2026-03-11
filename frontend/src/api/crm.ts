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
      const { data } = await apiClient.get<PaginatedResponse<Contact>>('/crm/contacts', {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          ...(params.search && { search: params.search }),
          ...(params.contact_type && { contact_type: params.contact_type }),
          ...(params.is_active !== undefined && { is_active: params.is_active }),
        },
      })
      return data
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
      const { data } = await apiClient.get<PaginatedResponse<Lead>>('/crm/leads', {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 100,
          ...(params.status && { status: params.status }),
          ...(params.assigned_to && { assigned_to: params.assigned_to }),
        },
      })
      return data
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
