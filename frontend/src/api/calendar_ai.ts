import { useMutation } from '@tanstack/react-query'
import apiClient from './client'

export interface ParsedEvent {
  title: string
  start_time: string
  end_time: string
  event_type: string
  attendees: string[]
  location?: string
  description?: string
}

export interface TimeSuggestion {
  start: string
  end: string
  score: number
  reason?: string
}

export function useParseNaturalLanguageEvent() {
  return useMutation({
    mutationFn: async (text: string) => {
      const { data } = await apiClient.post<ParsedEvent>('/calendar/ai/parse-event', { text })
      return data
    },
  })
}

export function useSuggestOptimalTimes() {
  return useMutation({
    mutationFn: async (payload: { attendee_ids: string[]; duration_minutes?: number; days_ahead?: number }) => {
      const { data } = await apiClient.post<{ suggestions: TimeSuggestion[] }>('/calendar/ai/suggest-times', payload)
      return data.suggestions
    },
  })
}

export function useSuggestReschedule() {
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data } = await apiClient.post<{ suggestions: TimeSuggestion[] }>(`/calendar/ai/reschedule/${eventId}`)
      return data.suggestions
    },
  })
}
