/**
 * Projects Guests API client — external guest access management for projects.
 *
 * Exports TanStack Query hooks and Axios helper functions for the Projects
 * module's guest invitation feature. All requests go through `client.ts`
 * (Axios instance with auth interceptors). Backend prefix: `/api/v1/projects`.
 *
 * Key exports:
 *   - useGuests() — list all active guest invites for a project
 *   - useInviteGuest() — send a tokenised guest invite with scoped permissions
 *   - useRevokeGuest() — revoke an existing guest invite by ID
 *   - useAcceptGuestInvite() — accept an invite using the email token (public)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuestInvite {
  id: string
  project_id: string
  email: string
  token: string
  permissions: Record<string, boolean> | null
  invited_by: string
  expires_at: string | null
  created_at: string
}

export interface GuestInviteCreate {
  email: string
  permissions?: Record<string, boolean>
  expires_at?: string | null
}

// ─── API calls ────────────────────────────────────────────────────────────────

const inviteGuest = (projectId: string, data: GuestInviteCreate) =>
  apiClient.post<GuestInvite>(`/projects/${projectId}/guests`, data).then(r => r.data)

const listGuests = (projectId: string) =>
  apiClient.get<GuestInvite[]>(`/projects/${projectId}/guests`).then(r => r.data)

const revokeGuest = (projectId: string, guestId: string) =>
  apiClient.delete(`/projects/${projectId}/guests/${guestId}`).then(r => r.data)

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useGuests(projectId: string) {
  return useQuery({
    queryKey: ['project-guests', projectId],
    queryFn: () => listGuests(projectId),
    enabled: !!projectId,
  })
}

export function useInviteGuest(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GuestInviteCreate) => inviteGuest(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-guests', projectId] }),
  })
}

export function useRevokeGuest(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (guestId: string) => revokeGuest(projectId, guestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-guests', projectId] }),
  })
}
