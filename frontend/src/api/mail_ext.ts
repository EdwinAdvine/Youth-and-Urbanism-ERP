/**
 * Mail Extended API client — threads, labels, contacts, snooze, and cross-module actions.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/mail`.
 *
 * Key exports:
 *   - useMailThreads() — list conversation threads with unread status
 *   - useMailLabels() / useCreateLabel() — label management
 *   - useMailSearch() — full-text search across messages
 *   - useSnoozeMessage() — defer a message to a later time
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MailThread {
  id: string
  subject: string
  message_count: number
  participants: { name: string; email: string }[]
  last_message_date: string
  has_unread: boolean
  snippet: string
  labels: string[]
  messages: MailThreadMessage[]
}

export interface MailThreadMessage {
  id: string
  from: { name?: string; email: string }
  to: { name?: string; email: string }[]
  date: string
  text_body: string
  html_body: string
  read: boolean
  has_attachments: boolean
}

export interface MailLabel {
  id: string
  name: string
  color: string
  message_count: number
  created_at: string
  updated_at: string
}

export interface MailContact {
  id: string
  name: string
  email: string
  frequency: number
  last_contacted: string | null
  avatar_url: string | null
}

export interface CreateLabelPayload {
  name: string
  color: string
}

export interface UpdateLabelPayload {
  id: string
  name?: string
  color?: string
}

export interface SaveDraftPayload {
  to?: string[]
  subject?: string
  body?: string
  html_body?: string
  cc?: string[]
  in_reply_to?: string
}

export interface MailSearchParams {
  query: string
  from?: string
  to?: string
  subject?: string
  date_from?: string
  date_to?: string
  has_attachment?: boolean
  folder?: string
  label?: string
  page?: number
  limit?: number
}

// ─── Threads ────────────────────────────────────────────────────────────────

export function useMailThreads(params?: { folder?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['mail', 'threads', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; threads: MailThread[] }>(
        '/mail/threads',
        { params }
      )
      return data
    },
    retry: 1,
  })
}

// ─── Drafts ─────────────────────────────────────────────────────────────────

export function useSaveDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SaveDraftPayload) => {
      const { data } = await apiClient.post('/mail/drafts', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

// ─── Search ─────────────────────────────────────────────────────────────────

export function useMailSearch(params: MailSearchParams) {
  return useQuery({
    queryKey: ['mail', 'search', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        total: number
        messages: MailThreadMessage[]
      }>('/mail/search', { params })
      return data
    },
    enabled: !!params.query,
    retry: 1,
  })
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export function useMailLabels() {
  return useQuery({
    queryKey: ['mail', 'labels'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; labels: MailLabel[] }>('/mail/labels')
      return data.labels
    },
  })
}

export function useCreateLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateLabelPayload) => {
      const { data } = await apiClient.post<MailLabel>('/mail/labels', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'labels'] }),
  })
}

export function useUpdateLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateLabelPayload) => {
      const { data } = await apiClient.put<MailLabel>(`/mail/labels/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'labels'] }),
  })
}

export function useDeleteLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/mail/labels/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'labels'] }),
  })
}

// ─── Snooze ─────────────────────────────────────────────────────────────────

export function useSnoozeMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, snooze_until }: { messageId: string; snooze_until: string }) => {
      const { data } = await apiClient.post(`/mail/message/${messageId}/snooze`, { snooze_until })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

// ─── Contacts ───────────────────────────────────────────────────────────────

export function useMailContacts(search?: string) {
  return useQuery({
    queryKey: ['mail', 'contacts', search],
    queryFn: async () => {
      const params = search ? { search } : {}
      const { data } = await apiClient.get<{ contacts: MailContact[] }>('/mail/contacts', {
        params,
      })
      return data.contacts
    },
  })
}
