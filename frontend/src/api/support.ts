/**
 * Support API client — core helpdesk: tickets, SLA policies, knowledge base.
 *
 * Exports TanStack Query hooks and Axios helper functions for the Support
 * module. All requests go through `client.ts` (Axios instance with auth
 * interceptors). Backend prefix: `/api/v1/support`.
 *
 * Key exports:
 *   - useTickets() — paginated ticket list with filters
 *   - useTicket() — single ticket with comments
 *   - useCreateTicket() / useUpdateTicket() — ticket CRUD
 *   - useTicketCategories() — category management
 *   - useSLAPolicies() — SLA policy list
 *   - useKBArticles() / useKBArticle() — knowledge base articles
 *   - useSupportStats() — dashboard KPI summary
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  REFERENCE_PRESET,
  LIST_PRESET,
  DETAIL_PRESET,
  DASHBOARD_PRESET,
} from '@/utils/queryDefaults'
import { optimisticListUpdate } from '@/utils/optimisticMutation'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TicketCategory {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Ticket {
  id: string
  ticket_number: string
  subject: string
  description: string | null
  status: string
  priority: string
  category_id: string | null
  category_name: string | null
  contact_id: string | null
  customer_email: string | null
  customer_name: string | null
  assigned_to: string | null
  assignee_name: string | null
  created_by: string
  creator_name: string | null
  resolved_at: string | null
  closed_at: string | null
  first_response_at: string | null
  sla_response_due: string | null
  sla_resolution_due: string | null
  sla_response_breached: boolean
  sla_resolution_breached: boolean
  tags: string[] | null
  channel: string
  sentiment_score: number | null
  sentiment_label: string | null
  custom_fields: Record<string, unknown> | null
  viewing_agents?: string[]
  created_at: string
  updated_at: string
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  author_name: string | null
  content: string
  is_internal: boolean
  attachments: unknown[] | null
  created_at: string
  updated_at: string
}

export interface TicketDetail extends Ticket {
  comments: TicketComment[]
}

export interface KBArticle {
  id: string
  title: string
  slug: string
  content: string | null
  category_id: string | null
  status: string
  author_id: string
  author_name: string | null
  tags: string[] | null
  view_count: number
  helpful_count: number
  created_at: string
  updated_at: string
}

export interface SLAPolicy {
  id: string
  name: string
  priority: string
  response_time_hours: number
  resolution_time_hours: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupportStats {
  total_tickets: number
  open_tickets: number
  in_progress_tickets: number
  resolved_tickets: number
  closed_tickets: number
  avg_response_hours: number | null
  sla_breached: number
  tickets_by_priority: Record<string, number>
  tickets_by_category: { name: string; count: number }[]
}

export interface PaginatedTickets {
  total: number
  tickets: Ticket[]
}

export interface PaginatedArticles {
  total: number
  articles: KBArticle[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateCategoryPayload {
  name: string
  slug: string
  description?: string
  color?: string
  is_active?: boolean
  sort_order?: number
}

export interface UpdateCategoryPayload extends Partial<CreateCategoryPayload> {
  id: string
}

export interface CreateTicketPayload {
  subject: string
  description?: string
  priority?: string
  category_id?: string
  contact_id?: string
  customer_email?: string
  customer_name?: string
  assigned_to?: string
  tags?: string[]
}

export interface UpdateTicketPayload extends Partial<Omit<CreateTicketPayload, 'assigned_to'>> {
  id: string
}

export interface CreateCommentPayload {
  content: string
  is_internal?: boolean
  attachments?: unknown[]
}

export interface CreateKBPayload {
  title: string
  slug: string
  content?: string
  category_id?: string
  status?: string
  tags?: string[]
}

export interface UpdateKBPayload extends Partial<CreateKBPayload> {
  id: string
}

export interface CreateSLAPayload {
  name: string
  priority: string
  response_time_hours: number
  resolution_time_hours: number
  is_active?: boolean
}

export interface UpdateSLAPayload extends Partial<CreateSLAPayload> {
  id: string
}

// ─── Categories ───────────────────────────────────────────────────────────────

export function useTicketCategories() {
  return useQuery({
    queryKey: ['support', 'categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<TicketCategory[]>('/support/categories')
      return data
    },
    ...REFERENCE_PRESET,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCategoryPayload) => {
      const { data } = await apiClient.post<TicketCategory>('/support/categories', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCategoryPayload) => {
      const { data } = await apiClient.put<TicketCategory>(`/support/categories/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/categories/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'categories'] }),
  })
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export function useTickets(params: {
  status?: string
  priority?: string
  category_id?: string
  assigned_to?: string
  search?: string
  page?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['support', 'tickets', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedTickets>('/support/tickets', { params })
      return data
    },
    ...LIST_PRESET,
  })
}

export function useTicketDetail(id: string) {
  return useQuery({
    queryKey: ['support', 'tickets', id],
    queryFn: async () => {
      const { data } = await apiClient.get<TicketDetail>(`/support/tickets/${id}`)
      return data
    },
    enabled: !!id,
    ...DETAIL_PRESET,
  })
}

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTicketPayload) => {
      const { data } = await apiClient.post<Ticket>('/support/tickets', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
      qc.invalidateQueries({ queryKey: ['support', 'dashboard'] })
    },
  })
}

export function useUpdateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTicketPayload) => {
      const { data } = await apiClient.put<Ticket>(`/support/tickets/${id}`, payload)
      return data
    },
    ...optimisticListUpdate(
      qc,
      ['support', 'tickets'],
      (list: Ticket[], updated: UpdateTicketPayload) =>
        list.map(t => t.id === updated.id ? { ...t, ...updated } : t),
    ),
  })
}

export function useAssignTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, assigned_to }: { id: string; assigned_to: string | null }) => {
      const { data } = await apiClient.post<Ticket>(`/support/tickets/${id}/assign`, { assigned_to })
      return data
    },
    ...optimisticListUpdate(
      qc,
      ['support', 'tickets'],
      (list: Ticket[], updated: { id: string; assigned_to: string | null }) =>
        list.map(t => t.id === updated.id ? { ...t, assigned_to: updated.assigned_to } : t),
    ),
  })
}

export function useResolveTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Ticket>(`/support/tickets/${id}/resolve`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
      qc.invalidateQueries({ queryKey: ['support', 'dashboard'] })
    },
  })
}

export function useCloseTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Ticket>(`/support/tickets/${id}/close`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
      qc.invalidateQueries({ queryKey: ['support', 'dashboard'] })
    },
  })
}

export function useReopenTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Ticket>(`/support/tickets/${id}/reopen`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
      qc.invalidateQueries({ queryKey: ['support', 'dashboard'] })
    },
  })
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export function useTicketComments(ticketId: string) {
  return useQuery({
    queryKey: ['support', 'tickets', ticketId, 'comments'],
    queryFn: async () => {
      const { data } = await apiClient.get<TicketComment[]>(`/support/tickets/${ticketId}/comments`)
      return data
    },
    enabled: !!ticketId,
    ...LIST_PRESET,
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, ...payload }: CreateCommentPayload & { ticketId: string }) => {
      const { data } = await apiClient.post<TicketComment>(
        `/support/tickets/${ticketId}/comments`,
        payload
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets', variables.ticketId] })
      qc.invalidateQueries({ queryKey: ['support', 'tickets', variables.ticketId, 'comments'] })
    },
  })
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export function useKBArticles(params: {
  search?: string
  category_id?: string
  page?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['support', 'kb', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedArticles>('/support/kb', { params })
      return data
    },
    ...LIST_PRESET,
  })
}

export function useKBArticle(slug: string) {
  return useQuery({
    queryKey: ['support', 'kb', slug],
    queryFn: async () => {
      const { data } = await apiClient.get<KBArticle>(`/support/kb/${slug}`)
      return data
    },
    enabled: !!slug,
    ...DETAIL_PRESET,
  })
}

export function useCreateKBArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateKBPayload) => {
      const { data } = await apiClient.post<KBArticle>('/support/kb', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'kb'] }),
  })
}

export function useUpdateKBArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateKBPayload) => {
      const { data } = await apiClient.put<KBArticle>(`/support/kb/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'kb'] }),
  })
}

export function useDeleteKBArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/kb/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'kb'] }),
  })
}

export function useMarkKBHelpful() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<KBArticle>(`/support/kb/${id}/helpful`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'kb'] }),
  })
}

// ─── SLA Policies ─────────────────────────────────────────────────────────────

export function useSLAPolicies() {
  return useQuery({
    queryKey: ['support', 'sla'],
    queryFn: async () => {
      const { data } = await apiClient.get<SLAPolicy[]>('/support/sla')
      return data
    },
    ...REFERENCE_PRESET,
  })
}

export function useCreateSLA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSLAPayload) => {
      const { data } = await apiClient.post<SLAPolicy>('/support/sla', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sla'] }),
  })
}

export function useUpdateSLA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSLAPayload) => {
      const { data } = await apiClient.put<SLAPolicy>(`/support/sla/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sla'] }),
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useSupportStats() {
  return useQuery({
    queryKey: ['support', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<SupportStats>('/support/dashboard/stats')
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

export function useDeleteSLA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/sla/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sla'] }),
  })
}

export function useUpdateComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, commentId, content }: { ticketId: string; commentId: string; content: string }) => {
      const { data } = await apiClient.put<TicketComment>(
        `/support/tickets/${ticketId}/comments/${commentId}`,
        { content }
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets', variables.ticketId] })
      qc.invalidateQueries({ queryKey: ['support', 'tickets', variables.ticketId, 'comments'] })
    },
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, commentId }: { ticketId: string; commentId: string }) => {
      await apiClient.delete(`/support/tickets/${ticketId}/comments/${commentId}`)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets', variables.ticketId] })
      qc.invalidateQueries({ queryKey: ['support', 'tickets', variables.ticketId, 'comments'] })
    },
  })
}
