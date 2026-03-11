import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailCampaignConfig {
  id: string
  campaign_id: string
  template_id: string | null
  subject_line_a: string
  subject_line_b: string | null
  ab_test_ratio: number
  ab_winner_metric: string
  ab_winner_auto_send: boolean
  winner_determined_at: string | null
  send_at: string | null
  sent_count: number
  open_count: number
  click_count: number
  unsubscribe_count: number
  bounce_count: number
  created_at: string
  updated_at: string
}

export interface Segment {
  id: string
  name: string
  description: string | null
  segment_type: string
  rules: Record<string, any> | null
  contact_count: number
  ai_suggested: boolean
  owner_id: string
  created_at: string
  updated_at: string
}

export interface ContentCalendarItem {
  id: string
  title: string
  content_type: string
  scheduled_date: string
  status: string
  campaign_id: string | null
  assigned_to: string | null
  description: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface Unsubscribe {
  id: string
  contact_id: string
  campaign_id: string | null
  reason: string | null
  unsubscribed_at: string
  created_at: string
}

export interface ABTestCreatePayload {
  campaign_id: string
  template_id?: string | null
  subject_line_a: string
  subject_line_b?: string | null
  ab_test_ratio?: number
  ab_winner_metric?: string
  ab_winner_auto_send?: boolean
  send_at?: string | null
}

export interface SegmentCreatePayload {
  name: string
  description?: string | null
  segment_type: string
  rules?: Record<string, any> | null
  ai_suggested?: boolean
}

export interface CalendarItemCreatePayload {
  title: string
  content_type: string
  scheduled_date: string
  status?: string
  campaign_id?: string | null
  assigned_to?: string | null
  description?: string | null
}

export interface UnsubscribeCreatePayload {
  contact_id: string
  campaign_id?: string | null
  reason?: string | null
}

// ─── A/B Testing ──────────────────────────────────────────────────────────────

export function useCreateABTest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ABTestCreatePayload) =>
      apiClient.post('/crm/marketing/ab-tests', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'ab-tests'] }),
  })
}

export function useABTestResults(campaignId: string) {
  return useQuery<EmailCampaignConfig>({
    queryKey: ['crm', 'marketing', 'ab-tests', campaignId],
    queryFn: () => apiClient.get(`/crm/marketing/ab-tests/${campaignId}/results`).then(r => r.data),
    enabled: !!campaignId,
  })
}

// ─── Segments ─────────────────────────────────────────────────────────────────

export function useSegments(params?: { segment_type?: string; page?: number }) {
  return useQuery({
    queryKey: ['crm', 'marketing', 'segments', params],
    queryFn: () => apiClient.get('/crm/marketing/segments', { params }).then(r => r.data),
  })
}

export function useCreateSegment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SegmentCreatePayload) =>
      apiClient.post('/crm/marketing/segments', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'segments'] }),
  })
}

export function useUpdateSegment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<SegmentCreatePayload>) =>
      apiClient.put(`/crm/marketing/segments/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'segments'] }),
  })
}

export function useDeleteSegment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/marketing/segments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'segments'] }),
  })
}

export function useComputeSegment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/crm/marketing/segments/${id}/compute`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'segments'] }),
  })
}

export function useAddSegmentContacts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ segmentId, contactIds }: { segmentId: string; contactIds: string[] }) =>
      apiClient.post(`/crm/marketing/segments/${segmentId}/contacts`, { contact_ids: contactIds }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'segments'] }),
  })
}

// ─── Content Calendar ─────────────────────────────────────────────────────────

export function useContentCalendar(params?: { status?: string; content_type?: string; page?: number }) {
  return useQuery({
    queryKey: ['crm', 'marketing', 'calendar', params],
    queryFn: () => apiClient.get('/crm/marketing/content-calendar', { params }).then(r => r.data),
  })
}

export function useCreateCalendarItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CalendarItemCreatePayload) =>
      apiClient.post('/crm/marketing/content-calendar', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'calendar'] }),
  })
}

export function useUpdateCalendarItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CalendarItemCreatePayload>) =>
      apiClient.put(`/crm/marketing/content-calendar/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'calendar'] }),
  })
}

export function useDeleteCalendarItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/marketing/content-calendar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'calendar'] }),
  })
}

// ─── Unsubscribes ─────────────────────────────────────────────────────────────

export function useUnsubscribes(params?: { campaign_id?: string; page?: number }) {
  return useQuery({
    queryKey: ['crm', 'marketing', 'unsubscribes', params],
    queryFn: () => apiClient.get('/crm/marketing/unsubscribes', { params }).then(r => r.data),
  })
}

export function useCreateUnsubscribe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UnsubscribeCreatePayload) =>
      apiClient.post('/crm/marketing/unsubscribes', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'marketing', 'unsubscribes'] }),
  })
}
