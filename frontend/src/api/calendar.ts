/**
 * Calendar API client — events, Jitsi video meetings, recurrence rules, and
 * cross-module ERP context linking.
 *
 * Exports TanStack Query hooks and Axios helper functions for the Calendar
 * module. All requests go through `client.ts` (Axios instance with auth
 * interceptors). Backend prefix: `/api/v1/calendar`.
 *
 * Key exports:
 *   - useCalendarEvents() — range-filtered event list (start/end date params)
 *   - useCalendarEvent() — single event detail including ERP context fields
 *   - useCreateEvent() / useUpdateEvent() / useDeleteEvent() — event mutations
 *   - useUpcomingEvents() — next N events for the authenticated user
 *   - useCreateJitsiMeeting() — create event with auto-generated Jitsi room
 *
 * Note: events carry an ERPContext object linking to CRM deals, Finance invoices,
 * Support tickets, and Projects. Recurrence is stored as an RRULE string.
 * Query keys are namespaced under ['calendar', 'events'].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LIST_PRESET } from '@/utils/queryDefaults'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventType = 'meeting' | 'task' | 'reminder' | 'holiday' | 'focus' | 'booking' | 'deadline'
export type SensitivityLevel = 'normal' | 'private' | 'confidential'
export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent'
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled'

export interface ReminderConfig {
  minutes_before: number
  channel: 'push' | 'email' | 'in_app'
}

export interface ERPContext {
  invoice_id?: string
  ticket_id?: string
  deal_id?: string
  project_id?: string
  task_id?: string
  contact_id?: string
  po_id?: string
  // Denormalised display fields (populated by backend)
  invoice_number?: string
  invoice_amount?: number
  ticket_subject?: string
  ticket_priority?: string
  deal_name?: string
  deal_stage?: string
  project_name?: string
  task_title?: string
  contact_name?: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  all_day: boolean
  event_type: EventType
  color: string | null
  location: string | null
  attendees: string[] | null
  jitsi_room: string | null
  recurrence_rule: string | null
  recurrence_end: string | null
  parent_event_id: string | null
  organizer_id: string
  // New fields
  sensitivity: SensitivityLevel
  priority: PriorityLevel
  buffer_before: number
  buffer_after: number
  timezone: string | null
  reminders: ReminderConfig[] | null
  erp_context: ERPContext | null
  category_id: string | null
  calendar_id: string | null
  status: EventStatus
  created_at: string
  updated_at: string
}

export interface CreateEventPayload {
  title: string
  description?: string
  start_time: string
  end_time: string
  all_day?: boolean
  event_type?: string
  color?: string
  location?: string
  attendees?: string[]
  jitsi_room?: string
  recurrence_rule?: string
  recurrence_end?: string
  sensitivity?: SensitivityLevel
  priority?: PriorityLevel
  buffer_before?: number
  buffer_after?: number
  timezone?: string
  reminders?: ReminderConfig[]
  erp_context?: ERPContext
  category_id?: string
  calendar_id?: string
  status?: EventStatus
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {
  id: string
}

interface EventsResponse {
  total: number
  events: CalendarEvent[]
}

interface SyncResponse {
  synced: number
  total_remote?: number
  message?: string
}

interface ExpandResponse {
  parent_event_id: string
  instances_created: number
  events: CalendarEvent[]
}

// ─── Events ──────────────────────────────────────────────────────────────────

export function useCalendarEvents(params?: { start?: string; end?: string; event_type?: string }) {
  return useQuery({
    queryKey: ['calendar', params],
    queryFn: async () => {
      const { data } = await apiClient.get<EventsResponse>('/calendar/events', { params })
      return data
    },
    ...LIST_PRESET,
  })
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateEventPayload) => {
      const { data } = await apiClient.post<CalendarEvent>('/calendar/events', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateEventPayload) => {
      const { data } = await apiClient.put<CalendarEvent>(`/calendar/events/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/calendar/events/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

// ─── CalDAV Sync ─────────────────────────────────────────────────────────────

export function useSyncCalDAV() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<SyncResponse>('/calendar/sync')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

// ─── Expand Recurring ────────────────────────────────────────────────────────

export function useExpandRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ eventId, count }: { eventId: string; count?: number }) => {
      const params = count ? { count } : {}
      const { data } = await apiClient.post<ExpandResponse>(
        `/calendar/events/${eventId}/expand`,
        null,
        { params },
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}
