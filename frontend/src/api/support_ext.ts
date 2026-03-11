import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SLAPolicy {
  id: string
  name: string
  priority: string
  response_time_hours: number
  resolution_time_hours: number
  escalation_enabled: boolean
  escalation_after_hours: number | null
  notify_on_breach: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CannedResponse {
  id: string
  title: string
  content: string
  category: string | null
  shortcut: string | null
  is_shared: boolean
  created_by: string
  created_by_name: string | null
  usage_count: number
  created_at: string
  updated_at: string
}

export interface CustomerSatisfaction {
  id: string
  ticket_id: string
  ticket_number: string | null
  customer_id: string | null
  customer_name: string | null
  rating: number
  feedback: string | null
  submitted_at: string
}

export interface SatisfactionReport {
  period: string
  avg_rating: number
  total_responses: number
  ratings_distribution: Record<string, number>
  nps_score: number
}

export interface ResponseTimesReport {
  period: string
  avg_first_response_hours: number
  avg_resolution_hours: number
  tickets_within_sla: number
  tickets_breached_sla: number
  sla_compliance_rate: number
}

export interface SupportKPIs {
  total_open_tickets: number
  avg_first_response_hours: number
  avg_resolution_hours: number
  sla_compliance_rate: number
  customer_satisfaction_avg: number
  tickets_today: number
  resolved_today: number
  unassigned_tickets: number
  overdue_tickets: number
  top_categories: { name: string; count: number }[]
  agent_performance: { name: string; resolved: number; avg_response_hours: number }[]
}

export interface TicketSLAStatus {
  ticket_id: string
  response_due: string | null
  resolution_due: string | null
  response_breached: boolean
  resolution_breached: boolean
  response_remaining_hours: number | null
  resolution_remaining_hours: number | null
  sla_policy_name: string | null
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateSLAPolicyPayload {
  name: string
  priority: string
  response_time_hours: number
  resolution_time_hours: number
  escalation_enabled?: boolean
  escalation_after_hours?: number
  notify_on_breach?: boolean
  is_active?: boolean
}

export interface UpdateSLAPolicyPayload extends Partial<CreateSLAPolicyPayload> {
  id: string
}

export interface CreateCannedResponsePayload {
  title: string
  content: string
  category?: string
  shortcut?: string
  is_shared?: boolean
}

export interface UpdateCannedResponsePayload extends Partial<CreateCannedResponsePayload> {
  id: string
}

export interface SubmitSatisfactionPayload {
  ticket_id: string
  rating: number
  feedback?: string
}

// ─── SLA Policies ─────────────────────────────────────────────────────────────

export function useSLAPolicies() {
  return useQuery({
    queryKey: ['support', 'sla-policies'],
    queryFn: async () => {
      const { data } = await apiClient.get<SLAPolicy[]>('/support/sla-policies')
      return data
    },
  })
}

export function useCreateSLAPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSLAPolicyPayload) => {
      const { data } = await apiClient.post<SLAPolicy>('/support/sla-policies', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sla-policies'] }),
  })
}

export function useUpdateSLAPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSLAPolicyPayload) => {
      const { data } = await apiClient.put<SLAPolicy>(`/support/sla-policies/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sla-policies'] }),
  })
}

export function useDeleteSLAPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/sla-policies/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sla-policies'] }),
  })
}

export function useTicketSLAStatus(ticketId: string) {
  return useQuery({
    queryKey: ['support', 'tickets', ticketId, 'sla-status'],
    queryFn: async () => {
      const { data } = await apiClient.get<TicketSLAStatus>(`/support/tickets/${ticketId}/sla-status`)
      return data
    },
    enabled: !!ticketId,
  })
}

// ─── Canned Responses ─────────────────────────────────────────────────────────

export function useCannedResponses(params: { category?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ['support', 'canned-responses', params],
    queryFn: async () => {
      const { data } = await apiClient.get<CannedResponse[]>('/support/canned-responses', { params })
      return data
    },
  })
}

export function useCreateCannedResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCannedResponsePayload) => {
      const { data } = await apiClient.post<CannedResponse>('/support/canned-responses', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'canned-responses'] }),
  })
}

export function useUpdateCannedResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCannedResponsePayload) => {
      const { data } = await apiClient.put<CannedResponse>(`/support/canned-responses/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'canned-responses'] }),
  })
}

export function useDeleteCannedResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/canned-responses/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'canned-responses'] }),
  })
}

// ─── Customer Satisfaction ────────────────────────────────────────────────────

export function useSubmitSatisfaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SubmitSatisfactionPayload) => {
      const { data } = await apiClient.post<CustomerSatisfaction>('/support/satisfaction', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'satisfaction'] }),
  })
}

export function useSatisfactionReport(params: { period?: 'daily' | 'weekly' | 'monthly'; start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['support', 'satisfaction', 'report', params],
    queryFn: async () => {
      const { data } = await apiClient.get<SatisfactionReport[]>('/support/satisfaction/report', { params })
      return data
    },
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useResponseTimesReport(params: { period?: 'daily' | 'weekly' | 'monthly'; start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['support', 'reports', 'response-times', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ResponseTimesReport[]>('/support/reports/response-times', { params })
      return data
    },
  })
}

export function useSupportKPIs() {
  return useQuery({
    queryKey: ['support', 'kpis'],
    queryFn: async () => {
      const { data } = await apiClient.get<SupportKPIs>('/support/kpis')
      return data
    },
  })
}

// ─── Ticket Routing Rules ────────────────────────────────────────────────────

export interface RoutingRule {
  id: string
  name: string
  description: string | null
  conditions: Record<string, unknown> | null
  assign_to: string | null
  priority_override: string | null
  category_override: string | null
  is_active: boolean
  priority_order: number
  created_at: string
  updated_at: string
}

export interface CreateRoutingRulePayload {
  name: string
  description?: string
  conditions?: Record<string, unknown>
  assign_to?: string
  priority_override?: string
  category_override?: string
  is_active?: boolean
  priority_order?: number
}

export interface UpdateRoutingRulePayload extends Partial<CreateRoutingRulePayload> {
  id: string
}

export function useRoutingRules() {
  return useQuery({
    queryKey: ['support', 'routing-rules'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; routing_rules: RoutingRule[] }>('/support/routing-rules')
      return data
    },
  })
}

export function useCreateRoutingRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateRoutingRulePayload) => {
      const { data } = await apiClient.post<RoutingRule>('/support/routing-rules', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'routing-rules'] }),
  })
}

export function useUpdateRoutingRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRoutingRulePayload) => {
      const { data } = await apiClient.put<RoutingRule>(`/support/routing-rules/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'routing-rules'] }),
  })
}

export function useDeleteRoutingRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/routing-rules/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'routing-rules'] }),
  })
}
