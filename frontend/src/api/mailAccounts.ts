/**
 * Mail Accounts API client — multi-account management for @youthandurbanism.org emails.
 *
 * Provides TanStack Query hooks for account CRUD, connection testing,
 * sync triggers, and unified inbox queries.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface MailAccount {
  id: string
  email: string
  display_name: string
  provider: string
  sync_enabled: boolean
  is_default: boolean
  last_sync_at: string | null
  created_at: string
}

export interface AddAccountPayload {
  email: string
  password: string
  display_name: string
}

export interface UpdateAccountPayload {
  display_name?: string
  sync_enabled?: boolean
  is_default?: boolean
}

export interface UnifiedInboxMessage {
  id: string
  account_id: string | null
  folder: string
  from_addr: string
  from_name: string
  to_addrs: { name?: string; email: string }[]
  cc: { name?: string; email: string }[]
  subject: string
  body_text: string
  is_read: boolean
  is_starred: boolean
  is_pinned: boolean
  received_at: string | null
  attachments: any[]
  ai_category: string | null
  priority_score: number | null
}

export interface UnifiedInboxResponse {
  total: number
  limit: number
  offset: number
  messages: UnifiedInboxMessage[]
}

// ── API functions ────────────────────────────────────────────────────────────

export const fetchMailAccounts = async (): Promise<MailAccount[]> => {
  const { data } = await apiClient.get('/mail/accounts')
  return data
}

export const addMailAccount = async (payload: AddAccountPayload) => {
  const { data } = await apiClient.post('/mail/accounts', payload)
  return data
}

export const updateMailAccount = async (id: string, payload: UpdateAccountPayload) => {
  const { data } = await apiClient.patch(`/mail/accounts/${id}`, payload)
  return data
}

export const removeMailAccount = async (id: string, purgeMessages = true) => {
  const { data } = await apiClient.delete(`/mail/accounts/${id}`, {
    params: { purge_messages: purgeMessages },
  })
  return data
}

export const testMailAccount = async (id: string) => {
  const { data } = await apiClient.post(`/mail/accounts/${id}/test`)
  return data
}

export const syncMailAccount = async (id: string) => {
  const { data } = await apiClient.post(`/mail/accounts/${id}/sync`)
  return data
}

export const fetchUnifiedInbox = async (params: {
  folder?: string
  limit?: number
  offset?: number
  account_id?: string | null
}): Promise<UnifiedInboxResponse> => {
  const cleanParams: Record<string, any> = { ...params }
  if (!cleanParams.account_id) delete cleanParams.account_id
  const { data } = await apiClient.get('/mail/accounts/unified-inbox', { params: cleanParams })
  return data
}

// ── TanStack Query hooks ─────────────────────────────────────────────────────

export const useMailAccounts = () =>
  useQuery({
    queryKey: ['mail-accounts'],
    queryFn: fetchMailAccounts,
    staleTime: 30_000,
  })

export const useAddMailAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addMailAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mail-accounts'] })
      qc.invalidateQueries({ queryKey: ['unified-inbox'] })
    },
  })
}

export const useUpdateMailAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAccountPayload }) =>
      updateMailAccount(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mail-accounts'] })
    },
  })
}

export const useRemoveMailAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeMailAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mail-accounts'] })
      qc.invalidateQueries({ queryKey: ['unified-inbox'] })
    },
  })
}

export const useTestMailAccount = () =>
  useMutation({
    mutationFn: (id: string) => testMailAccount(id),
  })

export const useSyncMailAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => syncMailAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unified-inbox'] })
    },
  })
}

export const useUnifiedInbox = (params: {
  folder?: string
  limit?: number
  offset?: number
  account_id?: string | null
}) =>
  useQuery({
    queryKey: ['unified-inbox', params],
    queryFn: () => fetchUnifiedInbox(params),
    staleTime: 15_000,
    refetchInterval: 60_000, // Auto-refresh every minute
  })
