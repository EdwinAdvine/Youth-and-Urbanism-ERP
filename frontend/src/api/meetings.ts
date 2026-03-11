import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Meeting {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  location: string | null
  attendees: string[] | null
  color: string | null
  jitsi_room: string | null
  organizer_id: string
  created_at: string
  updated_at: string
}

export interface CreateMeetingPayload {
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  attendees?: string[]
  color?: string
}

export interface CreateMeetingResponse extends Meeting {
  jitsi_room_url: string
  jitsi_jwt: string
}

export interface JoinMeetingResponse {
  meeting_id: string
  room_name: string
  room_url: string
  jwt_token: string
}

interface MeetingsResponse {
  total: number
  meetings: Meeting[]
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useMeetings() {
  return useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data } = await apiClient.get<MeetingsResponse>('/meetings')
      return data
    },
  })
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: ['meetings', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Meeting>(`/meetings/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateMeetingPayload) => {
      const { data } = await apiClient.post<CreateMeetingResponse>('/meetings', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
    },
  })
}

export function useDeleteMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/meetings/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
    },
  })
}

export function useJoinMeeting() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.get<JoinMeetingResponse>(`/meetings/${id}/join`)
      return data
    },
  })
}

// ─── Virtual Backgrounds ─────────────────────────────────────────────────────

export interface VirtualBackground {
  id: string
  name: string
  type: 'blur' | 'color' | 'image'
  url: string
}

export function useVirtualBackgrounds() {
  return useQuery({
    queryKey: ['meetings', 'virtual-backgrounds'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ backgrounds: VirtualBackground[]; total: number }>(
        '/meetings/virtual-backgrounds',
      )
      return data.backgrounds
    },
  })
}

export function useUploadVirtualBackground() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<VirtualBackground>(
        '/meetings/virtual-backgrounds',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings', 'virtual-backgrounds'] })
    },
  })
}

// ─── SIP Dial-In ──────────────────────────────────────────────────────────────

export interface DialInDetails {
  meeting_id: string
  dial_in_number: string
  meeting_pin: string
  sip_uri: string
  jitsi_room: string | null
  instructions: string
}

export function useDialIn() {
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { data } = await apiClient.post<DialInDetails>(`/meetings/${meetingId}/dial-in`)
      return data
    },
  })
}

// ─── Lobby Settings (public) ─────────────────────────────────────────────────

export interface LobbySettings {
  logo_url: string
  welcome_message: string
  background_color: string
  require_approval: boolean
}

export function useLobbySettings() {
  return useQuery({
    queryKey: ['meetings', 'lobby', 'public'],
    queryFn: async () => {
      const { data } = await apiClient.get<LobbySettings>('/admin/meetings/lobby/public')
      return data
    },
  })
}

// ─── Jitsi Theme (public) ────────────────────────────────────────────────────

export interface JitsiThemePublic {
  primary_color: string
  logo_url: string
  watermark_url: string
  toolbar_buttons: string[]
}

export function useJitsiTheme() {
  return useQuery({
    queryKey: ['meetings', 'theme', 'public'],
    queryFn: async () => {
      const { data } = await apiClient.get<JitsiThemePublic>('/admin/meetings/theme/public')
      return data
    },
  })
}

// ─── Cross-Module Link Types ─────────────────────────────────────────────────

export interface MeetingLink {
  id: string
  meeting_id: string
  link_type: string
  entity_id: string
  entity_title: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface LinkedTask {
  link_id: string
  task_id: string
  title: string
  status: string | null
  priority: string | null
  project_id: string | null
  assignee_id: string | null
  linked_at: string | null
}

export interface LinkedContact {
  link_id: string
  contact_id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  linked_at: string | null
}

export interface LinkedDeal {
  link_id: string
  deal_id: string
  title: string
  value: string | null
  currency: string | null
  status: string | null
  linked_at: string | null
}

export interface LinkedNote {
  link_id: string
  note_id: string
  title: string
  content_preview: string
  created_at: string | null
  linked_at: string | null
}

// ─── Meetings → Projects: Task Links ─────────────────────────────────────────

export function useLinkedTasks(meetingId: string) {
  return useQuery({
    queryKey: ['meetings', meetingId, 'linked-tasks'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ meeting_id: string; tasks: LinkedTask[]; total: number }>(
        `/meetings/${meetingId}/linked-tasks`,
      )
      return data
    },
    enabled: !!meetingId,
  })
}

export function useLinkTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ meetingId, taskId }: { meetingId: string; taskId: string }) => {
      const { data } = await apiClient.post<MeetingLink>(`/meetings/${meetingId}/link-task`, {
        task_id: taskId,
      })
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['meetings', vars.meetingId, 'linked-tasks'] })
    },
  })
}

export function useUnlinkTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ meetingId, taskId }: { meetingId: string; taskId: string }) => {
      await apiClient.delete(`/meetings/${meetingId}/unlink-task/${taskId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['meetings', vars.meetingId, 'linked-tasks'] })
    },
  })
}

// ─── Meetings → Notes: Auto-Create Meeting Notes ─────────────────────────────

export function useMeetingNotes(meetingId: string) {
  return useQuery({
    queryKey: ['meetings', meetingId, 'meeting-notes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ meeting_id: string; notes: LinkedNote[]; total: number }>(
        `/meetings/${meetingId}/meeting-notes`,
      )
      return data
    },
    enabled: !!meetingId,
  })
}

export function useCreateMeetingNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ meetingId, extraContent }: { meetingId: string; extraContent?: string }) => {
      const { data } = await apiClient.post(`/meetings/${meetingId}/create-note`, {
        extra_content: extraContent || null,
      })
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['meetings', vars.meetingId, 'meeting-notes'] })
    },
  })
}

// ─── Meetings → CRM: Contact/Deal Links ─────────────────────────────────────

export function useLinkedCRM(meetingId: string) {
  return useQuery({
    queryKey: ['meetings', meetingId, 'linked-crm'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        meeting_id: string
        contacts: LinkedContact[]
        deals: LinkedDeal[]
        total: number
      }>(`/meetings/${meetingId}/linked-crm`)
      return data
    },
    enabled: !!meetingId,
  })
}

export function useLinkContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ meetingId, contactId }: { meetingId: string; contactId: string }) => {
      const { data } = await apiClient.post<MeetingLink>(`/meetings/${meetingId}/link-contact`, {
        contact_id: contactId,
      })
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['meetings', vars.meetingId, 'linked-crm'] })
    },
  })
}

export function useLinkDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ meetingId, dealId }: { meetingId: string; dealId: string }) => {
      const { data } = await apiClient.post<MeetingLink>(`/meetings/${meetingId}/link-deal`, {
        deal_id: dealId,
      })
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['meetings', vars.meetingId, 'linked-crm'] })
    },
  })
}

export function useUnlinkCRM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      meetingId,
      linkType,
      entityId,
    }: {
      meetingId: string
      linkType: 'contact' | 'deal'
      entityId: string
    }) => {
      await apiClient.delete(`/meetings/${meetingId}/unlink-crm/${linkType}/${entityId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['meetings', vars.meetingId, 'linked-crm'] })
    },
  })
}
