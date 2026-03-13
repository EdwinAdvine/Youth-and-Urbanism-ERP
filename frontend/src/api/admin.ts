/**
 * Admin API client — system administration (users, roles, permissions, audit logs, AI config).
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/admin`.
 *
 * Key exports:
 *   - useAdminStats()      — platform-wide summary stats (users, activity)
 *   - useUsers()           — paginated user list with search/filter support
 *   - useCreateUser()      — provision a new user account
 *   - useUpdateUser()      — update user details or status
 *   - useRoles()           — list all RBAC roles
 *   - usePermissions()     — list all granular permissions
 *   - useAuditLogs()       — paginated audit trail of admin actions
 *   - useAIConfig()        — read/update global AI provider configuration
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type {
  User,
  AIConfig,
  AdminStats,
  AuditLog,
  GeneralAuditLog,
  Role,
  Permission,
  AppAccessEntry,
  AppAdmin,
  PaginatedResponse,
} from '../types'

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

export function useGeneralAuditLogs(
  page = 1,
  filters?: { user_id?: string; action?: string; resource_type?: string }
) {
  return useQuery({
    queryKey: ['admin', 'audit-logs-general', page, filters],
    queryFn: async () => {
      const skip = (page - 1) * 50
      const { data } = await apiClient.get<GeneralAuditLog[]>('/admin/audit-logs/general', {
        params: { skip, limit: 50, ...filters },
      })
      return data
    },
  })
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await apiClient.get<Role[]>('/roles')
      return data
    },
  })
}

export function useAllPermissions() {
  return useQuery({
    queryKey: ['roles', 'permissions'],
    queryFn: async () => {
      const { data } = await apiClient.get<Permission[]>('/roles/permissions')
      return data
    },
    staleTime: 5 * 60 * 1000, // permissions change rarely
  })
}

export function useRolePermissions(roleId: string | null) {
  return useQuery({
    queryKey: ['roles', roleId, 'permissions'],
    queryFn: async () => {
      const { data } = await apiClient.get<Permission[]>(`/roles/${roleId}/permissions`)
      return data
    },
    enabled: !!roleId,
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; app_scope?: string }) => {
      const { data } = await apiClient.post<Role>('/roles', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; description?: string }) => {
      const { data } = await apiClient.put<Role>(`/roles/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/roles/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useBulkAssignPermissions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      roleId,
      permission_ids,
      replace = false,
    }: {
      roleId: string
      permission_ids: string[]
      replace?: boolean
    }) => {
      const { data } = await apiClient.post<{ assigned: number; removed: number }>(
        `/roles/${roleId}/permissions/bulk`,
        { permission_ids, replace }
      )
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['roles', vars.roleId, 'permissions'] }),
  })
}

export function useAssignPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ roleId, permId }: { roleId: string; permId: string }) => {
      await apiClient.post(`/roles/${roleId}/permissions/${permId}`)
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['roles', vars.roleId, 'permissions'] }),
  })
}

export function useRemovePermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ roleId, permId }: { roleId: string; permId: string }) => {
      await apiClient.delete(`/roles/${roleId}/permissions/${permId}`)
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['roles', vars.roleId, 'permissions'] }),
  })
}

// ─── App Admins ───────────────────────────────────────────────────────────────

export function useAppAdmins() {
  return useQuery({
    queryKey: ['admin', 'app-admins'],
    queryFn: async () => {
      const { data } = await apiClient.get<AppAdmin[]>('/admin/app-admins')
      return data
    },
  })
}

export function useGrantAppAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { user_id: string; app_name: string }) => {
      const { data } = await apiClient.post<AppAdmin>('/admin/app-admins', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'app-admins'] }),
  })
}

export function useRevokeAppAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/app-admins/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'app-admins'] }),
  })
}

// ─── User App Access ──────────────────────────────────────────────────────────

export function useUserAppAccess(userId: string) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'app-access'],
    queryFn: async () => {
      const { data } = await apiClient.get<AppAccessEntry[]>(`/admin/users/${userId}/app-access`)
      return data
    },
    enabled: !!userId,
  })
}

export function useSetUserAppAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      app_grants,
    }: {
      userId: string
      app_grants: Record<string, boolean>
    }) => {
      const { data } = await apiClient.put<{ updated: number }>(
        `/admin/users/${userId}/app-access`,
        { app_grants }
      )
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users', vars.userId, 'app-access'] })
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
