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
