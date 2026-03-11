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
