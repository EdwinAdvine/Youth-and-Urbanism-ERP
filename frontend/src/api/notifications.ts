/**
 * Notifications API client — in-app notification feed (bell icon, mark-read, unread count).
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/notifications`.
 *
 * Key exports:
 *   - useNotifications()       — paginated list of notifications with optional read filter
 *   - useUnreadCount()         — total count of unread notifications (drives bell badge)
 *   - useMarkNotificationRead() — mark a single notification as read
 *   - useMarkAllRead()          — mark all current user's notifications as read
 *   - useDeleteNotification()   — delete a single notification by ID
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { REALTIME_PRESET } from '@/utils/queryDefaults'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  title: string
  message: string
  type: string
  module: string | null
  is_read: boolean
  link_url: string | null
  created_at: string
}

export interface UnreadCountResponse {
  count: number
}

export interface NotificationsParams {
  is_read?: boolean
  skip?: number
  limit?: number
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useNotifications(params: NotificationsParams = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; items: Notification[] }>('/notifications', { params })
      return data.items
    },
    ...REALTIME_PRESET,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await apiClient.get<UnreadCountResponse>('/notifications/unread-count')
      return data
    },
    refetchInterval: 30_000,
    ...REALTIME_PRESET,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<Notification>(`/notifications/${id}/read`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.put('/notifications/read-all')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notifications/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}

export function useCreateTestNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<Notification>('/notifications/test')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}
