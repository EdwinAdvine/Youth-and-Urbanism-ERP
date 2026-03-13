/**
 * Calendar Extended API client — iCal/CalDAV subscriptions, event categories,
 * multi-user availability checking, and RSVP responses.
 *
 * Exports TanStack Query hooks and Axios helper functions for extended Calendar
 * features. All requests go through `client.ts` (Axios instance with auth
 * interceptors). Backend prefix: `/api/v1/calendar`.
 *
 * Key exports:
 *   - useCalendarSubscriptions() / useCreateSubscription() — subscribe to external iCal feeds
 *   - useSyncSubscription() — manually trigger re-sync of an iCal subscription
 *   - useCalendarCategories() / useCreateCategory() — colour-coded event categories
 *   - useUserAvailability() — query free/busy slots for one or more users
 *   - useRSVP() — submit accepted/declined/tentative response to an event invite
 *
 * Note: subscriptions are polled on a configurable interval (sync_interval_minutes).
 * Availability slots reflect confirmed + tentative events within the queried window.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarSubscription {
  id: string
  name: string
  url: string
  color: string | null
  is_active: boolean
  last_synced: string | null
  sync_interval_minutes: number
  created_at: string
  updated_at: string
}

export interface CalendarCategory {
  id: string
  name: string
  color: string
  icon: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Availability {
  user_id: string
  user_name: string
  slots: AvailabilitySlot[]
}

export interface AvailabilitySlot {
  start: string
  end: string
  status: 'free' | 'busy' | 'tentative'
}

export interface RSVPPayload {
  event_id: string
  response: 'accepted' | 'declined' | 'tentative'
}

export interface CreateSubscriptionPayload {
  name: string
  url: string
  color?: string
  sync_interval_minutes?: number
}

export interface CreateCategoryPayload {
  name: string
  color: string
  icon?: string
}

export interface UpdateCategoryPayload {
  id: string
  name?: string
  color?: string
  icon?: string
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export function useCalendarSubscriptions() {
  return useQuery({
    queryKey: ['calendar', 'subscriptions'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; subscriptions: CalendarSubscription[] }>(
        '/calendar/subscriptions'
      )
      return data.subscriptions
    },
  })
}

export function useCreateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSubscriptionPayload) => {
      const { data } = await apiClient.post<CalendarSubscription>('/calendar/subscriptions', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'subscriptions'] }),
  })
}

export function useDeleteSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/calendar/subscriptions/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'subscriptions'] }),
  })
}

// ─── Categories ─────────────────────────────────────────────────────────────

export function useCalendarCategories() {
  return useQuery({
    queryKey: ['calendar', 'categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; categories: CalendarCategory[] }>(
        '/calendar/categories'
      )
      return data.categories
    },
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCategoryPayload) => {
      const { data } = await apiClient.post<CalendarCategory>('/calendar/categories', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCategoryPayload) => {
      const { data } = await apiClient.put<CalendarCategory>(`/calendar/categories/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/calendar/categories/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'categories'] }),
  })
}

// ─── Availability / Free-Busy ───────────────────────────────────────────────

export function useAvailability(params: { user_ids: string[]; start: string; end: string }) {
  return useQuery({
    queryKey: ['calendar', 'availability', params],
    queryFn: async () => {
      const { data } = await apiClient.post<{ availability: Availability[] }>(
        '/calendar/availability',
        params
      )
      return data.availability
    },
    enabled: params.user_ids.length > 0,
  })
}

// ─── RSVP ───────────────────────────────────────────────────────────────────

export function useRSVP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ event_id, response }: RSVPPayload) => {
      const { data } = await apiClient.post(`/calendar/events/${event_id}/rsvp`, { response })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

// ─── Duplicate Event ────────────────────────────────────────────────────────

export function useDuplicateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data } = await apiClient.post(`/calendar/events/${eventId}/duplicate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

// ─── Export Events ──────────────────────────────────────────────────────────

export function useExportEvents() {
  return useMutation({
    mutationFn: async (params?: { start?: string; end?: string; format?: string }) => {
      const { data } = await apiClient.get('/calendar/export', {
        params,
        responseType: 'blob',
      })
      return data as Blob
    },
  })
}
