/**
 * Settings API client — global system settings and per-user preferences.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/settings`.
 *
 * Key exports:
 *   - useSystemSettings()       — list all key/value system settings by category
 *   - useUpdateSystemSettings() — batch-update one or more system setting values
 *   - useUserPreferences()      — fetch the current user's UI/notification preferences
 *   - useUpdateUserPreferences() — save theme, language, timezone, and notification flags
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SCHEMA_PRESET } from '@/utils/queryDefaults'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SystemSetting {
  id: string
  key: string
  value: string | null
  category: string
}

export interface UserPreferences {
  theme: string
  language: string
  timezone: string
  notifications_enabled: boolean
  email_notifications: boolean
}

export interface UpdateSettingsPayload {
  items: { key: string; value: string; category: string }[]
}

// ─── System Settings ──────────────────────────────────────────────────────────

export function useSystemSettings() {
  return useQuery({
    queryKey: ['settings', 'system'],
    queryFn: async () => {
      const { data } = await apiClient.get<SystemSetting[]>('/settings')
      return data
    },
    ...SCHEMA_PRESET,
  })
}

export function useUpdateSystemSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateSettingsPayload) => {
      const { data } = await apiClient.put<SystemSetting[]>('/settings', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'system'] }),
  })
}

// ─── User Preferences ─────────────────────────────────────────────────────────

export function useUserPreferences() {
  return useQuery({
    queryKey: ['settings', 'preferences'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserPreferences>('/settings/preferences')
      return data
    },
    ...SCHEMA_PRESET,
  })
}

export function useUpdatePreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<UserPreferences>) => {
      const { data } = await apiClient.put<UserPreferences>('/settings/preferences', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'preferences'] }),
  })
}
