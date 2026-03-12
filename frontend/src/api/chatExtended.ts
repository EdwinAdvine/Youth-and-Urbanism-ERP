/**
 * Y&U Teams — Phase 2-3 API client (TanStack Query hooks).
 * Calling, webhooks, slash commands, channel templates, shared channels,
 * transcription, whiteboards, compliance, live events, decisions, analytics.
 */
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const api = axios.create({ baseURL: '/api/v1/chat' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Slash Commands ───────────────────────────────────────────────────────────

export function useSlashCommands() {
  return useQuery({
    queryKey: ['chat', 'slash-commands'],
    queryFn: () => api.get('/slash-commands').then((r) => r.data),
  })
}

export function useCreateSlashCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/slash-commands', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'slash-commands'] }),
  })
}

export function useExecuteSlashCommand() {
  return useMutation({
    mutationFn: (params: { command: string; args?: string; channel_id?: string }) =>
      api.post('/slash-commands/execute', null, { params }).then((r) => r.data),
  })
}

// ── Incoming Webhooks ────────────────────────────────────────────────────────

export function useIncomingWebhooks(channelId?: string) {
  return useQuery({
    queryKey: ['chat', 'webhooks', 'incoming', channelId],
    queryFn: () =>
      api.get('/webhooks/incoming', { params: { channel_id: channelId } }).then((r) => r.data),
  })
}

export function useCreateIncomingWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/webhooks/incoming', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'webhooks', 'incoming'] }),
  })
}

export function useDeleteIncomingWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/incoming/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'webhooks', 'incoming'] }),
  })
}

// ── Outgoing Webhooks ────────────────────────────────────────────────────────

export function useOutgoingWebhooks() {
  return useQuery({
    queryKey: ['chat', 'webhooks', 'outgoing'],
    queryFn: () => api.get('/webhooks/outgoing').then((r) => r.data),
  })
}

export function useCreateOutgoingWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/webhooks/outgoing', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'webhooks', 'outgoing'] }),
  })
}

// ── Call Sessions ────────────────────────────────────────────────────────────

export function useInitiateCall() {
  return useMutation({
    mutationFn: (data: { channel_id: string; call_type: 'audio' | 'video' }) =>
      api.post('/calls', data).then((r) => r.data),
  })
}

export function useUpdateCall() {
  return useMutation({
    mutationFn: ({ callId, action }: { callId: string; action: 'accept' | 'decline' | 'end' }) =>
      api.put(`/calls/${callId}`, { action }).then((r) => r.data),
  })
}

export function useActiveCalls() {
  return useQuery({
    queryKey: ['chat', 'calls', 'active'],
    queryFn: () => api.get('/calls/active').then((r) => r.data),
    refetchInterval: 10000,
  })
}

// ── Channel Templates ────────────────────────────────────────────────────────

export function useChannelTemplates() {
  return useQuery({
    queryKey: ['chat', 'channel-templates'],
    queryFn: () => api.get('/channel-templates').then((r) => r.data),
  })
}

export function useCreateChannelTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/channel-templates', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'channel-templates'] }),
  })
}

export function useApplyChannelTemplate() {
  return useMutation({
    mutationFn: ({ templateId, channelId }: { templateId: string; channelId: string }) =>
      api.post(`/channel-templates/${templateId}/apply`, null, { params: { channel_id: channelId } }).then((r) => r.data),
  })
}

// ── Shared Channels ──────────────────────────────────────────────────────────

export function useSharedChannels(teamId?: string) {
  return useQuery({
    queryKey: ['chat', 'shared-channels', teamId],
    queryFn: () =>
      api.get('/shared-channels', { params: { team_id: teamId } }).then((r) => r.data),
  })
}

export function useShareChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { channel_id: string; team_id: string }) =>
      api.post('/shared-channels', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'shared-channels'] }),
  })
}

// ── Meeting Transcription ────────────────────────────────────────────────────

export function useMeetingTranscript(meetingId: string) {
  return useQuery({
    queryKey: ['chat', 'transcript', meetingId],
    queryFn: () => api.get(`/meetings/${meetingId}/transcript`).then((r) => r.data),
    enabled: !!meetingId,
  })
}

export function useStartTranscription() {
  return useMutation({
    mutationFn: (meetingId: string) =>
      api.post(`/meetings/${meetingId}/transcribe`).then((r) => r.data),
  })
}

export function useMeetingAISummary(meetingId: string) {
  return useQuery({
    queryKey: ['chat', 'meeting-summary', meetingId],
    queryFn: () => api.get(`/meetings/${meetingId}/summary`).then((r) => r.data),
    enabled: !!meetingId,
  })
}

export function useGenerateMeetingSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (meetingId: string) =>
      api.post(`/meetings/${meetingId}/generate-summary`).then((r) => r.data),
    onSuccess: (_d, meetingId) =>
      qc.invalidateQueries({ queryKey: ['chat', 'meeting-summary', meetingId] }),
  })
}

// ── Whiteboards ──────────────────────────────────────────────────────────────

export function useWhiteboards(channelId?: string, meetingId?: string) {
  return useQuery({
    queryKey: ['chat', 'whiteboards', channelId, meetingId],
    queryFn: () =>
      api.get('/whiteboards', { params: { channel_id: channelId, meeting_id: meetingId } }).then((r) => r.data),
  })
}

export function useCreateWhiteboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; channel_id?: string; meeting_id?: string }) =>
      api.post('/whiteboards', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'whiteboards'] }),
  })
}

export function useUpdateWhiteboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; state_url?: string; thumbnail_url?: string; is_locked?: boolean }) =>
      api.put(`/whiteboards/${id}`, null, { params: data }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'whiteboards'] }),
  })
}

// ── Retention Policies ───────────────────────────────────────────────────────

export function useRetentionPolicies() {
  return useQuery({
    queryKey: ['chat', 'compliance', 'retention'],
    queryFn: () => api.get('/compliance/retention').then((r) => r.data),
  })
}

export function useCreateRetentionPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/compliance/retention', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'compliance', 'retention'] }),
  })
}

// ── DLP Rules ────────────────────────────────────────────────────────────────

export function useDLPRules() {
  return useQuery({
    queryKey: ['chat', 'compliance', 'dlp-rules'],
    queryFn: () => api.get('/compliance/dlp-rules').then((r) => r.data),
  })
}

export function useCreateDLPRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/compliance/dlp-rules', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'compliance', 'dlp-rules'] }),
  })
}

export function useToggleDLPRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.put(`/compliance/dlp-rules/${id}/toggle`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'compliance', 'dlp-rules'] }),
  })
}

export function useDLPViolations(params?: { rule_id?: string; user_id?: string; is_resolved?: boolean }) {
  return useQuery({
    queryKey: ['chat', 'compliance', 'dlp-violations', params],
    queryFn: () => api.get('/compliance/dlp-violations', { params }).then((r) => r.data),
  })
}

export function useResolveDLPViolation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.put(`/compliance/dlp-violations/${id}/resolve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'compliance', 'dlp-violations'] }),
  })
}

// ── Chat Audit Logs ──────────────────────────────────────────────────────────

export function useChatAuditLogs(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['chat', 'compliance', 'audit-logs', params],
    queryFn: () => api.get('/compliance/audit-logs', { params }).then((r) => r.data),
  })
}

// ── eDiscovery ───────────────────────────────────────────────────────────────

export function useEDiscoverySearch() {
  return useMutation({
    mutationFn: (data: any) => api.post('/compliance/ediscovery', data).then((r) => r.data),
  })
}

// ── Live Events ──────────────────────────────────────────────────────────────

export function useLiveEvents(status?: string) {
  return useQuery({
    queryKey: ['chat', 'live-events', status],
    queryFn: () => api.get('/live-events', { params: { status } }).then((r) => r.data),
  })
}

export function useCreateLiveEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/live-events', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'live-events'] }),
  })
}

export function useUpdateLiveEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/live-events/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'live-events'] }),
  })
}

export function useRegisterForLiveEvent() {
  return useMutation({
    mutationFn: (eventId: string) => api.post(`/live-events/${eventId}/register`).then((r) => r.data),
  })
}

export function useLiveEventQA(eventId: string) {
  return useQuery({
    queryKey: ['chat', 'live-events', eventId, 'qa'],
    queryFn: () => api.get(`/live-events/${eventId}/qa`).then((r) => r.data),
    enabled: !!eventId,
    refetchInterval: 5000,
  })
}

export function useAskQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, question }: { eventId: string; question: string }) =>
      api.post(`/live-events/${eventId}/qa`, { question }).then((r) => r.data),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['chat', 'live-events', vars.eventId, 'qa'] }),
  })
}

export function useAnswerQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ qaId, answer }: { qaId: string; answer: string }) =>
      api.put(`/live-events/qa/${qaId}/answer`, { answer }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'live-events'] }),
  })
}

export function useUpvoteQuestion() {
  return useMutation({
    mutationFn: (qaId: string) => api.post(`/live-events/qa/${qaId}/upvote`).then((r) => r.data),
  })
}

// ── Decision Memory ──────────────────────────────────────────────────────────

export function useDecisions(params?: { channel_id?: string; search?: string }) {
  return useQuery({
    queryKey: ['chat', 'decisions', params],
    queryFn: () => api.get('/decisions', { params }).then((r) => r.data),
  })
}

export function useCreateDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/decisions', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'decisions'] }),
  })
}

// ── Notification Preferences ─────────────────────────────────────────────────

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['chat', 'notification-preferences'],
    queryFn: () => api.get('/notification-preferences').then((r) => r.data),
  })
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.put('/notification-preferences', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'notification-preferences'] }),
  })
}

// ── Teams Analytics ──────────────────────────────────────────────────────────

export function useTeamsAnalytics(params?: { team_id?: string; from_date?: string; to_date?: string }) {
  return useQuery({
    queryKey: ['chat', 'analytics', params],
    queryFn: () => api.get('/analytics', { params }).then((r) => r.data),
  })
}

export function useLiveTeamsAnalytics() {
  return useQuery({
    queryKey: ['chat', 'analytics', 'live'],
    queryFn: () => api.get('/analytics/live').then((r) => r.data),
    refetchInterval: 30000,
  })
}
