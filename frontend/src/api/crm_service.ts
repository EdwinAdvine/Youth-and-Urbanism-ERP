import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender_type: string
  sender_id: string | null
  content: string
  content_type: string
  attachments: Record<string, any>[] | null
  created_at: string
}

export interface Conversation {
  id: string
  channel: string
  subject: string | null
  contact_id: string | null
  ticket_id: string | null
  status: string
  assigned_to: string | null
  last_message_at: string | null
  metadata_json: Record<string, any> | null
  messages?: ConversationMessage[]
  created_at: string
  updated_at: string
}

export interface KBArticle {
  id: string
  title: string
  slug: string
  content_html: string
  content_text: string
  category: string
  tags: string[] | null
  status: string
  view_count: number
  helpful_count: number
  not_helpful_count: number
  author_id: string
  created_at: string
  updated_at: string
}

export interface SLAPolicy {
  id: string
  name: string
  description: string | null
  priority: string
  first_response_hours: number
  resolution_hours: number
  business_hours_only: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SLATracker {
  id: string
  ticket_id: string
  sla_policy_id: string
  first_response_due: string
  first_response_at: string | null
  resolution_due: string
  resolution_at: string | null
  is_first_response_breached: boolean
  is_resolution_breached: boolean
}

export interface ConversationCreatePayload {
  channel: string
  subject?: string | null
  contact_id?: string | null
  ticket_id?: string | null
  metadata_json?: Record<string, any> | null
}

export interface MessageCreatePayload {
  sender_type: string
  sender_id?: string | null
  content: string
  content_type?: string
  attachments?: Record<string, any>[] | null
}

export interface KBArticleCreatePayload {
  title: string
  slug?: string
  content_html: string
  content_text?: string
  category: string
  tags?: string[] | null
  status?: string
}

export interface SLAPolicyCreatePayload {
  name: string
  description?: string | null
  priority: string
  first_response_hours: number
  resolution_hours: number
  business_hours_only?: boolean
  is_active?: boolean
}

// ─── Conversations ────────────────────────────────────────────────────────────

export function useConversations(params?: { channel?: string; status?: string; contact_id?: string; page?: number }) {
  return useQuery({
    queryKey: ['crm', 'service', 'conversations', params],
    queryFn: () => apiClient.get('/crm/service/conversations', { params }).then(r => r.data),
  })
}

export function useCreateConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConversationCreatePayload) =>
      apiClient.post('/crm/service/conversations', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'service', 'conversations'] }),
  })
}

export function useConversation(conversationId: string) {
  return useQuery<Conversation>({
    queryKey: ['crm', 'service', 'conversation', conversationId],
    queryFn: () => apiClient.get(`/crm/service/conversations/${conversationId}`).then(r => r.data),
    enabled: !!conversationId,
  })
}

export function useAddMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MessageCreatePayload) =>
      apiClient.post(`/crm/service/conversations/${conversationId}/messages`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'service', 'conversation', conversationId] })
      qc.invalidateQueries({ queryKey: ['crm', 'service', 'conversations'] })
    },
  })
}

export function useAssignConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, assignTo }: { conversationId: string; assignTo: string }) =>
      apiClient.post(`/crm/service/conversations/${conversationId}/assign`, { assigned_to: assignTo }).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['crm', 'service', 'conversation', vars.conversationId] })
      qc.invalidateQueries({ queryKey: ['crm', 'service', 'conversations'] })
    },
  })
}

export function useResolveConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiClient.post(`/crm/service/conversations/${conversationId}/resolve`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'service', 'conversations'] }),
  })
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export function useKBArticles(params?: { category?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: ['crm', 'service', 'kb-articles', params],
    queryFn: () => apiClient.get('/crm/service/kb/articles', { params }).then(r => r.data),
  })
}

export function useCreateKBArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: KBArticleCreatePayload) =>
      apiClient.post('/crm/service/kb/articles', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'service', 'kb-articles'] }),
  })
}

export function useKBArticle(articleId: string) {
  return useQuery<KBArticle>({
    queryKey: ['crm', 'service', 'kb-article', articleId],
    queryFn: () => apiClient.get(`/crm/service/kb/articles/${articleId}`).then(r => r.data),
    enabled: !!articleId,
  })
}

export function useUpdateKBArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<KBArticleCreatePayload>) =>
      apiClient.put(`/crm/service/kb/articles/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'service', 'kb-articles'] }),
  })
}

export function useDeleteKBArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/service/kb/articles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'service', 'kb-articles'] }),
  })
}

export function useKBSearch(query: string) {
  return useQuery({
    queryKey: ['crm', 'service', 'kb-search', query],
    queryFn: () => apiClient.get('/crm/service/kb/search', { params: { q: query } }).then(r => r.data),
    enabled: !!query,
  })
}

// ─── SLA Policies ─────────────────────────────────────────────────────────────

export function useSLAPolicies(params?: { priority?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ['crm', 'service', 'sla-policies', params],
    queryFn: () => apiClient.get('/crm/service/sla/policies', { params }).then(r => r.data),
  })
}

export function useCreateSLAPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SLAPolicyCreatePayload) =>
      apiClient.post('/crm/service/sla/policies', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'service', 'sla-policies'] }),
  })
}

export function useUpdateSLAPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<SLAPolicyCreatePayload>) =>
      apiClient.put(`/crm/service/sla/policies/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'service', 'sla-policies'] }),
  })
}

export function useDeleteSLAPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/service/sla/policies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'service', 'sla-policies'] }),
  })
}

export function useTicketSLA(ticketId: string) {
  return useQuery<SLATracker>({
    queryKey: ['crm', 'service', 'sla-tracker', ticketId],
    queryFn: () => apiClient.get(`/crm/service/sla/tickets/${ticketId}`).then(r => r.data),
    enabled: !!ticketId,
  })
}
