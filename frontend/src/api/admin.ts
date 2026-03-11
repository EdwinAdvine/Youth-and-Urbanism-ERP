import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type { User, AIConfig, AdminStats, AuditLog, PaginatedResponse } from '../types'

// ─── Stats ────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminStats>('/admin/stats')
      return data
    },
  })
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  email: string
  full_name: string
  password: string
  role: User['role']
}

export interface UpdateUserPayload {
  full_name?: string
  role?: User['role']
  is_active?: boolean
}

export function useUsers(page = 1, search = '') {
  return useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<User>>('/admin/users', {
        params: { page, per_page: 20, search: search || undefined },
      })
      return data
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const { data } = await apiClient.post<User>('/admin/users', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateUserPayload & { id: string }) => {
      const { data } = await apiClient.patch<User>(`/admin/users/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/users/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

// ─── AI Config ────────────────────────────────────────────────────────────────

export function useAIConfig() {
  return useQuery({
    queryKey: ['admin', 'ai-config'],
    queryFn: async () => {
      const { data } = await apiClient.get<AIConfig>('/admin/ai-config')
      return data
    },
  })
}

export function useUpdateAIConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AIConfig) => {
      const { data } = await apiClient.put<AIConfig>('/admin/ai-config', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-config'] }),
  })
}

export function useTestAIConnection() {
  return useMutation({
    mutationFn: async (payload: AIConfig) => {
      const { data } = await apiClient.post<{ success: boolean; message: string }>(
        '/admin/ai-config/test',
        payload
      )
      return data
    },
  })
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export function useAuditLogs(page = 1, filters?: { user_id?: string; action?: string }) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', page, filters],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', {
        params: { page, per_page: 25, ...filters },
      })
      return data
    },
  })
}
