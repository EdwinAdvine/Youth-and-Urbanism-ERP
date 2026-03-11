import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CRMComment {
  id: string
  entity_type: string
  entity_id: string
  parent_id: string | null
  content: string
  mentions: string[] | null
  author_id: string
  is_edited: boolean
  created_at: string
  updated_at: string
}

export interface RecordFollower {
  id: string
  entity_type: string
  entity_id: string
  user_id: string
  created_at: string
}

export interface AuditLogEntry {
  id: string
  entity_type: string
  entity_id: string
  action: string
  changes: Record<string, unknown> | null
  user_id: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ─── API Functions — Comments ─────────────────────────────────────────────────

const getComments = (params: { entity_type: string; entity_id: string }) =>
  apiClient.get('/crm/comments', { params }).then((r) => r.data)

const createComment = (data: Partial<CRMComment>) =>
  apiClient.post('/crm/comments', data).then((r) => r.data)

const updateComment = ({ id, ...data }: Partial<CRMComment> & { id: string }) =>
  apiClient.put(`/crm/comments/${id}`, data).then((r) => r.data)

const deleteComment = (id: string) =>
  apiClient.delete(`/crm/comments/${id}`).then((r) => r.data)

// ─── API Functions — Followers ────────────────────────────────────────────────

const getFollowers = (params: { entity_type: string; entity_id: string }) =>
  apiClient.get('/crm/followers', { params }).then((r) => r.data)

const followRecord = (data: { entity_type: string; entity_id: string }) =>
  apiClient.post('/crm/followers', data).then((r) => r.data)

const unfollowRecord = ({ entity_type, entity_id }: { entity_type: string; entity_id: string }) =>
  apiClient.delete('/crm/followers', { params: { entity_type, entity_id } }).then((r) => r.data)

const getMyFollowedRecords = (params?: Record<string, unknown>) =>
  apiClient.get('/crm/followers/me', { params }).then((r) => r.data)

// ─── API Functions — Audit Log ────────────────────────────────────────────────

const getAuditLog = (params?: Record<string, unknown>) =>
  apiClient.get('/crm/audit-log', { params }).then((r) => r.data)

const getEntityAuditLog = (params: { entity_type: string; entity_id: string }) =>
  apiClient.get('/crm/audit-log/entity', { params }).then((r) => r.data)

const getAuditStats = (params?: Record<string, unknown>) =>
  apiClient.get('/crm/audit-log/stats', { params }).then((r) => r.data)

const createAuditEntry = (data: Partial<AuditLogEntry>) =>
  apiClient.post('/crm/audit-log', data).then((r) => r.data)

// ─── Hooks — Comments ─────────────────────────────────────────────────────────

export const useComments = (params: { entity_type: string; entity_id: string }) =>
  useQuery({
    queryKey: ['crm-comments', params],
    queryFn: () => getComments(params),
    enabled: !!params.entity_type && !!params.entity_id,
  })

export const useCreateComment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createComment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-comments'] }),
  })
}

export const useUpdateComment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateComment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-comments'] }),
  })
}

export const useDeleteComment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-comments'] }),
  })
}

// ─── Hooks — Followers ────────────────────────────────────────────────────────

export const useFollowers = (params: { entity_type: string; entity_id: string }) =>
  useQuery({
    queryKey: ['crm-followers', params],
    queryFn: () => getFollowers(params),
    enabled: !!params.entity_type && !!params.entity_id,
  })

export const useFollowRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: followRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-followers'] })
      qc.invalidateQueries({ queryKey: ['crm-followed-records'] })
    },
  })
}

export const useUnfollowRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unfollowRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-followers'] })
      qc.invalidateQueries({ queryKey: ['crm-followed-records'] })
    },
  })
}

export const useMyFollowedRecords = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['crm-followed-records', params],
    queryFn: () => getMyFollowedRecords(params),
  })

// ─── Hooks — Audit Log ───────────────────────────────────────────────────────

export const useAuditLog = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['crm-audit-log', params],
    queryFn: () => getAuditLog(params),
  })

export const useEntityAuditLog = (params: { entity_type: string; entity_id: string }) =>
  useQuery({
    queryKey: ['crm-audit-log', 'entity', params],
    queryFn: () => getEntityAuditLog(params),
    enabled: !!params.entity_type && !!params.entity_id,
  })

export const useAuditStats = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['crm-audit-log', 'stats', params],
    queryFn: () => getAuditStats(params),
  })

export const useCreateAuditEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAuditEntry,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-audit-log'] }),
  })
}
