import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarAnalytics {
  period_days: number
  total_events: number
  by_type: Record<string, number>
  total_meeting_hours: number
  avg_meeting_minutes: number
  meetings_per_week: number
  busiest_day: string
  by_priority: Record<string, number>
  focus_time_ratio_pct: number
}

export interface CRMContext {
  type: string
  id: string
  name?: string
  email?: string
  company?: string
  stage?: string
  value?: number
}

export interface FinanceContext {
  type: string
  id: string
  number?: string
  total?: number
  status?: string
}

export interface SupportContext {
  type: string
  id: string
  subject?: string
  priority?: string
  status?: string
}

export interface MeetingPrepCard {
  event_id: string
  title: string
  start_time: string
  end_time: string
  attendees: string[]
  erp_context: Record<string, unknown> | null
  crm_context: CRMContext[]
  finance_context: FinanceContext[]
  support_context: SupportContext[]
  recent_related_meetings?: { id: string; title: string; date: string }[]
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCalendarAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ['calendar-analytics', days],
    queryFn: async () => {
      const { data } = await apiClient.get<CalendarAnalytics>('/calendar/analytics/summary', {
        params: { days },
      })
      return data
    },
  })
}

export function useMeetingPrepCard(eventId: string) {
  return useQuery({
    queryKey: ['meeting-prep', eventId],
    queryFn: async () => {
      const { data } = await apiClient.get<MeetingPrepCard>(`/calendar/events/${eventId}/prep`)
      return data
    },
    enabled: !!eventId,
  })
}
