import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface Session {
  id: string
  device_name: string | null
  device_fingerprint: string | null
  ip_address: string | null
  user_agent: string | null
  last_active_at: string
  created_at: string
  revoked_at: string | null
}

export async function fetchSessions(): Promise<Session[]> {
  const { data } = await apiClient.get<Session[]>('/auth/sessions')
  return data
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/auth/sessions/${sessionId}`)
}

export async function revokeAllSessions(): Promise<{ count: number }> {
  const { data } = await apiClient.delete('/auth/sessions')
  return data
}

export function useSessions() {
  return useQuery({ queryKey: ['sessions'], queryFn: fetchSessions })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: revokeSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useRevokeAllSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
