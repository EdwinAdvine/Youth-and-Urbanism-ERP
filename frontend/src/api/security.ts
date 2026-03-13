import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface APIKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[] | null
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface APIKeyCreated extends APIKey {
  raw_key: string
}

export interface SecurityOverview {
  active_sessions: number
  failed_logins_24h: number
  locked_accounts: number
  unresolved_security_events: number
  total_active_users: number
}

export interface SecurityEvent {
  id: string
  event_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  user_id: string | null
  ip_address: string | null
  details: Record<string, unknown> | null
  resolved: boolean
  created_at: string
}

// API Keys
export async function fetchAPIKeys(): Promise<APIKey[]> {
  const { data } = await apiClient.get<APIKey[]>('/auth/api-keys')
  return data
}

export async function createAPIKey(payload: { name: string; scopes?: string[] }): Promise<APIKeyCreated> {
  const { data } = await apiClient.post<APIKeyCreated>('/auth/api-keys', payload)
  return data
}

export async function revokeAPIKey(id: string): Promise<void> {
  await apiClient.delete(`/auth/api-keys/${id}`)
}

export function useAPIKeys() {
  return useQuery({ queryKey: ['api-keys'], queryFn: fetchAPIKeys })
}

export function useCreateAPIKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAPIKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useRevokeAPIKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: revokeAPIKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

// Security dashboard (Super Admin)
export async function fetchSecurityOverview(): Promise<SecurityOverview> {
  const { data } = await apiClient.get<SecurityOverview>('/admin/security/overview')
  return data
}

export async function fetchSecurityEvents(params?: { severity?: string; resolved?: boolean }): Promise<SecurityEvent[]> {
  const { data } = await apiClient.get<SecurityEvent[]>('/admin/security/events', { params })
  return data
}

export async function resolveSecurityEvent(eventId: string): Promise<void> {
  await apiClient.post(`/admin/security/events/${eventId}/resolve`)
}

export async function fetchBlockedIPs(): Promise<{ blocked_ips: string[] }> {
  const { data } = await apiClient.get('/admin/security/ip-blocklist')
  return data
}

export async function blockIP(ip: string, ttlHours = 24): Promise<void> {
  await apiClient.post('/admin/security/ip-blocklist', null, { params: { ip, ttl_hours: ttlHours } })
}

export async function unblockIP(ip: string): Promise<void> {
  await apiClient.delete(`/admin/security/ip-blocklist/${encodeURIComponent(ip)}`)
}

export async function emergencyLockdown(): Promise<{ sessions_revoked: number }> {
  const { data } = await apiClient.post('/admin/security/lockdown')
  return data
}

export function useSecurityOverview() {
  return useQuery({ queryKey: ['security-overview'], queryFn: fetchSecurityOverview, refetchInterval: 30_000 })
}

export function useSecurityEvents(params?: { severity?: string; resolved?: boolean }) {
  return useQuery({ queryKey: ['security-events', params], queryFn: () => fetchSecurityEvents(params) })
}

export function useResolveSecurityEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resolveSecurityEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['security-events'] }),
  })
}

export function useBlockedIPs() {
  return useQuery({ queryKey: ['blocked-ips'], queryFn: fetchBlockedIPs })
}

export function useBlockIP() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ ip, ttlHours }: { ip: string; ttlHours?: number }) => blockIP(ip, ttlHours), onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked-ips'] }) })
}

export function useUnblockIP() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: unblockIP, onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked-ips'] }) })
}

export function useEmergencyLockdown() {
  return useMutation({ mutationFn: emergencyLockdown })
}
