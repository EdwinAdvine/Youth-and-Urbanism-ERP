import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type { UserPreferences } from './settings'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: string
  is_active: boolean
  created_at: string
  last_login: string | null
  preferences: UserPreferences | null
}

export interface ActivityItem {
  id: string
  activity_type: string
  message: string
  module: string
  created_at: string
}

export interface UpdateProfilePayload {
  full_name?: string
  avatar_url?: string
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserProfile>('/profile/me')
      return data
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const { data } = await apiClient.put<UserProfile>('/profile/me', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', 'me'] }),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: ChangePasswordPayload) => {
      const { data } = await apiClient.put('/profile/me/password', payload)
      return data
    },
  })
}

export function useProfileActivity() {
  return useQuery({
    queryKey: ['profile', 'activity'],
    queryFn: async () => {
      const { data } = await apiClient.get<ActivityItem[]>('/profile/me/activity')
      return data
    },
  })
}
