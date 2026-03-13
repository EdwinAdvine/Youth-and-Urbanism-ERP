import { useMutation, useQuery } from '@tanstack/react-query'
import apiClient from './client'

export interface DataExport {
  exported_at: string
  user: {
    id: string
    email: string
    full_name: string
    created_at: string | null
    last_login: string | null
  }
  audit_log: {
    action: string
    resource_type: string | null
    resource_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
  }[]
}

export interface RetentionPolicy {
  table: string
  retention_days: number
  description: string
}

export function useDataExport() {
  return useQuery({
    queryKey: ['compliance', 'data-export'],
    queryFn: async () => {
      const { data } = await apiClient.get<DataExport>('/users/me/data-export')
      return data
    },
    enabled: false,
  })
}

export function useRequestDataExport() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<DataExport>('/users/me/data-export')
      return data
    },
  })
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete<{ status: string; message: string }>('/users/me/account')
      return data
    },
  })
}

export function useRetentionPolicies() {
  return useQuery({
    queryKey: ['compliance', 'data-retention'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ policies: RetentionPolicy[] }>('/users/data-retention')
      return data.policies
    },
  })
}
