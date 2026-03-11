import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type { Meeting } from './meetings'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeetingRecording {
  id: string
  meeting_id: string
  file_name: string
  file_size: number
  duration_seconds: number
  minio_key: string
  download_url: string | null
  created_at: string
}

export interface MeetingChat {
  id: string
  meeting_id: string
  sender_id: string
  sender_name: string
  message: string
  timestamp: string
}

export interface MeetingTemplate {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  default_agenda: string | null
  default_attendees: string[]
  created_at: string
  updated_at: string
}

export interface MeetingNote {
  id: string
  meeting_id: string
  content: string
  author_id: string
  author_name: string
  created_at: string
  updated_at: string
}

export interface CreateMeetingTemplatePayload {
  name: string
  description?: string
  duration_minutes?: number
  default_agenda?: string
  default_attendees?: string[]
}

export interface MeetingInvitePayload {
  meeting_id: string
  attendee_emails: string[]
  message?: string
}

export interface MeetingRSVPPayload {
  meeting_id: string
  response: 'accepted' | 'declined' | 'tentative'
}

export interface AISummaryResponse {
  meeting_id: string
  summary: string
  action_items: string[]
  key_decisions: string[]
}

// ─── Recordings ─────────────────────────────────────────────────────────────

export function useMeetingRecording(meetingId: string) {
  return useQuery({
    queryKey: ['meetings', meetingId, 'recordings'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ recordings: MeetingRecording[] }>(
        `/meetings/${meetingId}/recordings`
      )
      return data.recordings
    },
    enabled: !!meetingId,
  })
}

// ─── Upcoming ───────────────────────────────────────────────────────────────

export function useUpcomingMeetings(limit: number = 5) {
  return useQuery({
    queryKey: ['meetings', 'upcoming', limit],
    queryFn: async () => {
      const { data } = await apiClient.get<{ meetings: Meeting[] }>('/meetings/upcoming', {
        params: { limit },
      })
      return data.meetings
    },
  })
}

// ─── Instant Meeting ────────────────────────────────────────────────────────

export function useInstantMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload?: { title?: string }) => {
      const { data } = await apiClient.post<Meeting & { jitsi_room_url: string; jitsi_jwt: string }>(
        '/meetings/instant',
        payload ?? {}
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

// ─── Recurring Meetings ────────────────────────────────────────────────────

export function useRecurringMeetings() {
  return useQuery({
    queryKey: ['meetings', 'recurring'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ meetings: Meeting[] }>('/meetings/recurring')
      return data.meetings
    },
  })
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function useMeetingTemplates() {
  return useQuery({
    queryKey: ['meetings', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; templates: MeetingTemplate[] }>(
        '/meetings/templates'
      )
      return data.templates
    },
  })
}

export function useCreateMeetingTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateMeetingTemplatePayload) => {
      const { data } = await apiClient.post<MeetingTemplate>('/meetings/templates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings', 'templates'] }),
  })
}

// ─── Chat Export ────────────────────────────────────────────────────────────

export function useMeetingChatExport() {
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { data } = await apiClient.get<{ chats: MeetingChat[] }>(
        `/meetings/${meetingId}/chat-export`
      )
      return data.chats
    },
  })
}

// ─── AI Summary ─────────────────────────────────────────────────────────────

export function useMeetingAISummary() {
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { data } = await apiClient.post<AISummaryResponse>(
        `/meetings/${meetingId}/ai-summary`
      )
      return data
    },
  })
}

// ─── Start / End ────────────────────────────────────────────────────────────

export function useStartMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { data } = await apiClient.post<{ room_url: string; jwt_token: string }>(
        `/meetings/${meetingId}/start`
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

export function useEndMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { data } = await apiClient.post(`/meetings/${meetingId}/end`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

// ─── Invite / RSVP ─────────────────────────────────────────────────────────

export function useMeetingInvite() {
  return useMutation({
    mutationFn: async ({ meeting_id, ...payload }: MeetingInvitePayload) => {
      const { data } = await apiClient.post(`/meetings/${meeting_id}/invite`, payload)
      return data
    },
  })
}

export function useMeetingRSVP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ meeting_id, response }: MeetingRSVPPayload) => {
      const { data } = await apiClient.post(`/meetings/${meeting_id}/rsvp`, { response })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}
