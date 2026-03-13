/**
 * App Admin API client — per-module App Admin dashboard APIs (stats, config, user access).
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/admin/apps/{appName}`.
 *
 * Key exports:
 *   - useAppStats()        — module-scoped stats (record counts, activity) for a given app
 *   - useAppConfig()       — read the configuration object for a specific app module
 *   - useUpdateAppConfig() — update configuration values for a specific app module
 *   - useAppUsers()        — list users with access to a specific app module
 *   - useGrantAppAccess()  — grant a user access to an app module
 *   - useRevokeAppAccess() — revoke a user's access to an app module
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AppStats {
  app_name: string
  stats: Record<string, number | string>
}

export interface AppConfig {
  app_name: string
  config: Record<string, unknown>
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useAppStats(appName: string) {
  return useQuery({
    queryKey: ['app-admin', appName, 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<AppStats>(`/admin/apps/${appName}/stats`)
      return data
    },
    enabled: !!appName,
  })
}

export function useAppConfig(appName: string) {
  return useQuery({
    queryKey: ['app-admin', appName, 'config'],
    queryFn: async () => {
      const { data } = await apiClient.get<AppConfig>(`/admin/apps/${appName}/config`)
      return data
    },
    enabled: !!appName,
  })
}

export function useUpdateAppConfig(appName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      const { data } = await apiClient.put<AppConfig>(`/admin/apps/${appName}/config`, {
        config,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-admin', appName, 'config'] })
    },
  })
}
