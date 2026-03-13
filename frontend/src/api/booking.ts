/**
 * Booking API client — appointment scheduling, availability, and booking management.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/booking`.
 *
 * Key exports:
 *   - useBookingPages()       — list the current user's booking page configs
 *   - useBookingPage()        — fetch a single booking page by ID or slug
 *   - useCreateBookingPage()  — create a new public booking page
 *   - useUpdateBookingPage()  — update availability, buffer times, or questions
 *   - useAvailableSlots()     — query open appointment slots for a booking page
 *   - useCreateBooking()      — book an appointment slot (public endpoint)
 *   - useBookings()           — list all bookings received by the current user
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvailabilitySlot {
  day: number
  start: string
  end: string
}

export interface CustomQuestion {
  label: string
  type: 'text' | 'textarea' | 'select' | 'checkbox'
  required: boolean
  options?: string[]
}

export interface BookingPage {
  id: string
  owner_id: string
  slug: string
  title: string
  description: string | null
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  min_notice_hours: number
  max_advance_days: number
  availability: AvailabilitySlot[]
  color: string
  welcome_message: string | null
  custom_questions: CustomQuestion[] | null
  auto_create_jitsi: boolean
  event_type: string
  is_active: boolean
  created_at: string
}

export interface BookingSlot {
  id: string
  booking_page_id: string
  event_id: string | null
  booker_name: string
  booker_email: string
  start_time: string
  end_time: string
  status: string
  answers: Record<string, unknown> | null
  created_at: string
}

export interface TimeSlot {
  start: string
  end: string
}

export interface CreateBookingPagePayload {
  slug: string
  title: string
  description?: string
  duration_minutes?: number
  buffer_before?: number
  buffer_after?: number
  min_notice_hours?: number
  max_advance_days?: number
  availability?: AvailabilitySlot[]
  color?: string
  welcome_message?: string
  custom_questions?: CustomQuestion[]
  auto_create_jitsi?: boolean
  event_type?: string
}

export interface BookSlotPayload {
  booker_name: string
  booker_email: string
  start_time: string
  answers?: Record<string, unknown>
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useBookingPages() {
  return useQuery({
    queryKey: ['booking-pages'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; pages: BookingPage[] }>('/booking/pages')
      return data
    },
  })
}

export function useCreateBookingPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateBookingPagePayload) => {
      const { data } = await apiClient.post<BookingPage>('/booking/pages', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking-pages'] }),
  })
}

export function useUpdateBookingPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateBookingPagePayload> & { id: string }) => {
      const { data } = await apiClient.put<BookingPage>(`/booking/pages/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking-pages'] }),
  })
}

export function useDeleteBookingPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/booking/pages/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking-pages'] }),
  })
}

// Public endpoints (no auth)
export function usePublicBookingPage(slug: string) {
  return useQuery({
    queryKey: ['public-booking', slug],
    queryFn: async () => {
      const { data } = await apiClient.get<BookingPage>(`/booking/public/${slug}`)
      return data
    },
    enabled: !!slug,
  })
}

export function useAvailableSlots(slug: string, date: string) {
  return useQuery({
    queryKey: ['booking-slots', slug, date],
    queryFn: async () => {
      const { data } = await apiClient.get<{ date: string; slots: TimeSlot[] }>(
        `/booking/public/${slug}/available-slots`,
        { params: { date } }
      )
      return data
    },
    enabled: !!slug && !!date,
  })
}

export function useBookSlot(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BookSlotPayload) => {
      const { data } = await apiClient.post<BookingSlot>(`/booking/public/${slug}/book`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-slots'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useBookingSlots(pageId: string) {
  return useQuery({
    queryKey: ['booking-page-slots', pageId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; slots: BookingSlot[] }>(
        `/booking/pages/${pageId}/slots`
      )
      return data
    },
    enabled: !!pageId,
  })
}
