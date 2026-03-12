import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types: Live Chat ────────────────────────────────────────────────────────

export interface LiveChatSession {
  id: string
  visitor_id: string | null
  contact_id: string | null
  agent_id: string | null
  channel: string
  status: 'queued' | 'active' | 'waiting' | 'closed'
  ticket_id: string | null
  metadata: Record<string, unknown> | null
  visitor_name: string | null
  visitor_email: string | null
  created_at: string
  updated_at: string
}

export interface LiveChatMessage {
  id: string
  session_id: string
  sender_type: 'visitor' | 'agent' | 'bot'
  content: string
  content_type: string
  attachments: unknown[] | null
  created_at: string
}

// ─── Types: Audit Log ────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  ticket_id: string | null
  user_id: string | null
  user_name: string | null
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  ip_address: string | null
  created_at: string
}

// ─── Types: Time Tracking ────────────────────────────────────────────────────

export interface TimeEntry {
  id: string
  ticket_id: string
  agent_id: string
  agent_name: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  is_billable: boolean
  billing_rate_hourly: number | null
  note: string | null
  created_at: string
}

// ─── Types: Saved Views ──────────────────────────────────────────────────────

export interface SavedView {
  id: string
  user_id: string
  name: string
  filters: Record<string, unknown>
  columns: string[]
  sort_by: string | null
  sort_order: string | null
  is_shared: boolean
  is_default: boolean
  created_at: string
}

// ─── Types: Ticket Templates ─────────────────────────────────────────────────

export interface TicketTemplate {
  id: string
  name: string
  default_subject: string | null
  default_priority: string | null
  default_category_id: string | null
  custom_fields: Record<string, unknown> | null
  form_id: string | null
  is_active: boolean
  created_at: string
}

// ─── Types: Agent Presence ───────────────────────────────────────────────────

export interface AgentPresence {
  user_id: string
  status: string
  viewing_ticket_id: string | null
  typing_ticket_id: string | null
  last_seen: string
}

// ─── Types: Inbound Email Rules ──────────────────────────────────────────────

export interface InboundEmailRule {
  id: string
  email_address: string
  category_id: string | null
  priority: string | null
  assign_to: string | null
  auto_reply_template_id: string | null
  is_active: boolean
  created_at: string
}

// ─── Payload Types ───────────────────────────────────────────────────────────

export interface SendChatMessagePayload {
  sessionId: string
  content: string
  content_type?: string
  attachments?: unknown[]
}

export interface TransferChatPayload {
  sessionId: string
  target_agent_id: string
}

export interface UpdateTimeEntryPayload {
  id: string
  is_billable?: boolean
  billing_rate_hourly?: number | null
  note?: string | null
}

export interface CreateViewPayload {
  name: string
  filters: Record<string, unknown>
  columns: string[]
  sort_by?: string
  sort_order?: string
  is_shared?: boolean
  is_default?: boolean
}

export interface UpdateViewPayload extends Partial<CreateViewPayload> {
  id: string
}

export interface CreateTemplatePayload {
  name: string
  default_subject?: string
  default_priority?: string
  default_category_id?: string
  custom_fields?: Record<string, unknown>
  form_id?: string
  is_active?: boolean
}

export interface UpdateTemplatePayload extends Partial<CreateTemplatePayload> {
  id: string
}

export interface CreateInboundRulePayload {
  email_address: string
  category_id?: string
  priority?: string
  assign_to?: string
  auto_reply_template_id?: string
  is_active?: boolean
}

export interface UpdateInboundRulePayload extends Partial<CreateInboundRulePayload> {
  id: string
}

export interface AuditLogFilters {
  user_id?: string
  action?: string
  from_date?: string
  to_date?: string
  page?: number
  limit?: number
}

export interface TimeReportFilters {
  agent_id?: string
  ticket_id?: string
  is_billable?: boolean
  from_date?: string
  to_date?: string
  page?: number
  limit?: number
}

// ─── Live Chat Sessions ──────────────────────────────────────────────────────

export function useActiveChatSessions() {
  return useQuery({
    queryKey: ['support', 'live-chat', 'sessions'],
    queryFn: async () => {
      const { data } = await apiClient.get<LiveChatSession[]>('/support/live-chat/sessions')
      return data
    },
  })
}

export function useChatMessages(sessionId: string) {
  return useQuery({
    queryKey: ['support', 'live-chat', sessionId, 'messages'],
    queryFn: async () => {
      const { data } = await apiClient.get<LiveChatMessage[]>(
        `/support/live-chat/sessions/${sessionId}/messages`
      )
      return data
    },
    enabled: !!sessionId,
  })
}

export function useSendChatMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, ...payload }: SendChatMessagePayload) => {
      const { data } = await apiClient.post<LiveChatMessage>(
        `/support/live-chat/sessions/${sessionId}/messages`,
        payload
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['support', 'live-chat', variables.sessionId, 'messages'] })
    },
  })
}

export function useAcceptChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post<LiveChatSession>(
        `/support/live-chat/sessions/${sessionId}/assign`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'live-chat', 'sessions'] })
    },
  })
}

export function useTransferChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, target_agent_id }: TransferChatPayload) => {
      const { data } = await apiClient.post<LiveChatSession>(
        `/support/live-chat/sessions/${sessionId}/transfer`,
        { target_agent_id }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'live-chat', 'sessions'] })
    },
  })
}

export function useCloseChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post<LiveChatSession>(
        `/support/live-chat/sessions/${sessionId}/close`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'live-chat', 'sessions'] })
    },
  })
}

export function useConvertChatToTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post<LiveChatSession>(
        `/support/live-chat/sessions/${sessionId}/convert-to-ticket`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'live-chat', 'sessions'] })
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
    },
  })
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export function useTicketAuditLog(ticketId: string) {
  return useQuery({
    queryKey: ['support', 'tickets', ticketId, 'audit-log'],
    queryFn: async () => {
      const { data } = await apiClient.get<AuditLogEntry[]>(
        `/support/tickets/${ticketId}/audit-log`
      )
      return data
    },
    enabled: !!ticketId,
  })
}

export function useGlobalAuditLog(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ['support', 'audit-log', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<AuditLogEntry[]>('/support/audit-log', {
        params: filters,
      })
      return data
    },
  })
}

// ─── Time Tracking ───────────────────────────────────────────────────────────

export function useTicketTimeEntries(ticketId: string) {
  return useQuery({
    queryKey: ['support', 'tickets', ticketId, 'time'],
    queryFn: async () => {
      const { data } = await apiClient.get<TimeEntry[]>(`/support/tickets/${ticketId}/time`)
      return data
    },
    enabled: !!ticketId,
  })
}

export function useStartTimer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { data } = await apiClient.post<TimeEntry>(`/support/tickets/${ticketId}/time/start`)
      return data
    },
    onSuccess: (_data, ticketId) => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets', ticketId, 'time'] })
    },
  })
}

export function useStopTimer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { data } = await apiClient.post<TimeEntry>(`/support/tickets/${ticketId}/time/stop`)
      return data
    },
    onSuccess: (_data, ticketId) => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets', ticketId, 'time'] })
    },
  })
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTimeEntryPayload) => {
      const { data } = await apiClient.put<TimeEntry>(`/support/time-entries/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
      qc.invalidateQueries({ queryKey: ['support', 'time'] })
    },
  })
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/time-entries/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
      qc.invalidateQueries({ queryKey: ['support', 'time'] })
    },
  })
}

export function useTimeReport(filters: TimeReportFilters = {}) {
  return useQuery({
    queryKey: ['support', 'time', 'report', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<TimeEntry[]>('/support/time/report', {
        params: filters,
      })
      return data
    },
  })
}

// ─── Saved Views ─────────────────────────────────────────────────────────────

export function useSavedViews() {
  return useQuery({
    queryKey: ['support', 'views'],
    queryFn: async () => {
      const { data } = await apiClient.get<SavedView[]>('/support/views')
      return data
    },
  })
}

export function useCreateView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateViewPayload) => {
      const { data } = await apiClient.post<SavedView>('/support/views', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'views'] }),
  })
}

export function useUpdateView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateViewPayload) => {
      const { data } = await apiClient.put<SavedView>(`/support/views/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'views'] }),
  })
}

export function useDeleteView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/views/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'views'] }),
  })
}

export function useViewTickets(viewId: string, page = 1) {
  return useQuery({
    queryKey: ['support', 'views', viewId, 'tickets', page],
    queryFn: async () => {
      const { data } = await apiClient.get(`/support/views/${viewId}/tickets`, {
        params: { page },
      })
      return data
    },
    enabled: !!viewId,
  })
}

// ─── Ticket Templates ────────────────────────────────────────────────────────

export function useTicketTemplates() {
  return useQuery({
    queryKey: ['support', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<TicketTemplate[]>('/support/templates')
      return data
    },
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTemplatePayload) => {
      const { data } = await apiClient.post<TicketTemplate>('/support/templates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'templates'] }),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTemplatePayload) => {
      const { data } = await apiClient.put<TicketTemplate>(`/support/templates/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'templates'] }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/templates/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'templates'] }),
  })
}

export function useApplyTemplate() {
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await apiClient.post<TicketTemplate>(
        `/support/templates/${templateId}/apply`
      )
      return data
    },
  })
}

// ─── Agent Presence ──────────────────────────────────────────────────────────

export function useOnlineAgents() {
  return useQuery({
    queryKey: ['support', 'presence', 'agents'],
    queryFn: async () => {
      const { data } = await apiClient.get<AgentPresence[]>('/support/presence/agents')
      return data
    },
    refetchInterval: 15000,
  })
}

export function useTicketViewers(ticketId: string) {
  return useQuery({
    queryKey: ['support', 'presence', 'ticket', ticketId],
    queryFn: async () => {
      const { data } = await apiClient.get<AgentPresence[]>(
        `/support/presence/ticket/${ticketId}`
      )
      return data
    },
    enabled: !!ticketId,
    refetchInterval: 10000,
  })
}

export function useHeartbeat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      status?: string
      viewing_ticket_id?: string | null
      typing_ticket_id?: string | null
    }) => {
      const { data } = await apiClient.post<AgentPresence>('/support/presence/heartbeat', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'presence'] })
    },
  })
}

export function useTypingIndicators(ticketId: string) {
  return useQuery({
    queryKey: ['support', 'presence', 'typing', ticketId],
    queryFn: async () => {
      const { data } = await apiClient.get<AgentPresence[]>(
        `/support/presence/typing/${ticketId}`
      )
      return data
    },
    enabled: !!ticketId,
    refetchInterval: 3000,
  })
}

// ─── Inbound Email Rules ─────────────────────────────────────────────────────

export function useInboundEmailRules() {
  return useQuery({
    queryKey: ['support', 'inbound-email', 'rules'],
    queryFn: async () => {
      const { data } = await apiClient.get<InboundEmailRule[]>('/support/inbound-email/rules')
      return data
    },
  })
}

export function useCreateInboundRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateInboundRulePayload) => {
      const { data } = await apiClient.post<InboundEmailRule>(
        '/support/inbound-email/rules',
        payload
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'inbound-email', 'rules'] }),
  })
}

export function useUpdateInboundRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateInboundRulePayload) => {
      const { data } = await apiClient.put<InboundEmailRule>(
        `/support/inbound-email/rules/${id}`,
        payload
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'inbound-email', 'rules'] }),
  })
}

export function useDeleteInboundRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/support/inbound-email/rules/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'inbound-email', 'rules'] }),
  })
}
