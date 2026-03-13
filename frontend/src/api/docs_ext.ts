/**
 * Docs Extended API client — templates, version diffs, permissions, and full-text search.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/docs`.
 *
 * Key exports:
 *   - useDocVersionsExt() / useRestoreVersion() — extended version management
 *   - useDocPermissions() / useCreateDocPermission() — per-file access control
 *   - useDocCommentsExt() / useResolveComment() — comment resolution workflow
 *   - useDocTemplates() — library of document templates by category
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type { DocVersion, DocComment } from './docs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  doc_type: string
  minio_key: string
  rating: number
  rating_count: number
  created_at: string
  updated_at: string
}

export interface VersionDiff {
  file_id: string
  version_a: { id: string; version_number: number; label: string | null }
  version_b: { id: string; version_number: number; label: string | null }
  added_lines: number
  removed_lines: number
  total_changed_lines: number
  diff: string[]
}

export interface DocSearchResult {
  id: string
  name: string
  extension: string
  content_type: string
  folder_path: string
  updated_at: string
  score?: number
}

export interface RecentDoc {
  id: string
  name: string
  extension: string
  content_type: string
  last_accessed: string
  updated_at: string
  folder_path: string
}

export interface DocPermission {
  id: string
  file_id: string
  user_id: string
  user_name: string
  permission: 'view' | 'edit' | 'comment' | 'admin'
  created_at: string
}

export interface CreateDocPermissionPayload {
  file_id: string
  user_id: string
  permission: DocPermission['permission']
}

export interface AIGeneratePayload {
  prompt: string
  doc_type?: string
  language?: string
}

export interface AISummarizePayload {
  file_id: string
  max_length?: number
}

// ─── Version Hooks (Extended) ───────────────────────────────────────────────

export function useDocVersionsExt(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'versions', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<DocVersion[]>(`/docs/file/${fileId}/versions`)
      return data
    },
    enabled: !!fileId,
  })
}

export function useRestoreVersion(fileId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { data } = await apiClient.post(`/docs/file/${fileId}/versions/${versionId}/restore`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs', 'versions', fileId] })
      qc.invalidateQueries({ queryKey: ['docs', 'editor-config', fileId] })
    },
  })
}

// ─── Permissions ────────────────────────────────────────────────────────────

export function useDocPermissions(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'permissions', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ permissions: DocPermission[] }>(
        `/docs/file/${fileId}/permissions`
      )
      return data.permissions
    },
    enabled: !!fileId,
  })
}

export function useCreateDocPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file_id, ...payload }: CreateDocPermissionPayload) => {
      const { data } = await apiClient.post<DocPermission>(
        `/docs/file/${file_id}/permissions`,
        payload
      )
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['docs', 'permissions', vars.file_id] })
    },
  })
}

export function useDeleteDocPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, permissionId }: { fileId: string; permissionId: string }) => {
      await apiClient.delete(`/docs/file/${fileId}/permissions/${permissionId}`)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['docs', 'permissions', vars.fileId] })
    },
  })
}

// ─── Comments (Extended) ────────────────────────────────────────────────────

export function useDocCommentsExt(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'comments', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<DocComment[]>(`/docs/file/${fileId}/comments`)
      return data
    },
    enabled: !!fileId,
  })
}

export function useCreateCommentExt(fileId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { content: string; anchor?: string; parent_id?: string }) => {
      const { data } = await apiClient.post<DocComment>(`/docs/file/${fileId}/comments`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'comments', fileId] }),
  })
}

export function useResolveComment(fileId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data } = await apiClient.put<DocComment>(`/docs/comment/${commentId}`, {
        resolved: true,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'comments', fileId] }),
  })
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function useDocTemplates() {
  return useQuery({
    queryKey: ['docs', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; templates: DocumentTemplate[] }>(
        '/docs/templates'
      )
      return data.templates
    },
  })
}

export function useCreateFromTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { template_id: string; filename: string }) => {
      const { data } = await apiClient.post('/docs/from-template', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }),
  })
}

// ─── Export ─────────────────────────────────────────────────────────────────

export function useExportDoc() {
  return useMutation({
    mutationFn: async ({ fileId, format }: { fileId: string; format: string }) => {
      const { data } = await apiClient.get(`/docs/file/${fileId}/export`, {
        params: { format },
        responseType: 'blob',
      })
      return data as Blob
    },
  })
}

// ─── AI ─────────────────────────────────────────────────────────────────────

export function useAIGenerate() {
  return useMutation({
    mutationFn: async (payload: AIGeneratePayload) => {
      const { data } = await apiClient.post<{ content: string; file_id?: string }>(
        '/docs/ai/generate',
        payload
      )
      return data
    },
  })
}

export function useAISummarize() {
  return useMutation({
    mutationFn: async (payload: AISummarizePayload) => {
      const { data } = await apiClient.post<{ summary: string }>('/docs/ai/summarize', payload)
      return data
    },
  })
}

// ─── Recent Docs ────────────────────────────────────────────────────────────

export function useRecentDocs(limit: number = 10) {
  return useQuery({
    queryKey: ['docs', 'recent', limit],
    queryFn: async () => {
      const { data } = await apiClient.get<{ documents: RecentDoc[] }>('/docs/recent', {
        params: { limit },
      })
      return data.documents
    },
  })
}

// ─── Search ──────────────────────────────────────────────────────────────────

export function useDocSearch(q: string, limit: number = 20) {
  return useQuery({
    queryKey: ['docs', 'search', q, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<{ results: DocSearchResult[]; total: number }>(
        '/docs/search',
        { params: { q, limit } }
      )
      return data
    },
    enabled: q.trim().length > 0,
  })
}

// ─── Version Compare ─────────────────────────────────────────────────────────

export function useCompareVersions(docId: string) {
  return useMutation({
    mutationFn: async ({ versionId, otherVersionId }: { versionId: string; otherVersionId: string }) => {
      const { data } = await apiClient.post<VersionDiff>(
        `/docs/${docId}/versions/${versionId}/compare/${otherVersionId}`
      )
      return data
    },
  })
}

// ─── Template Rating ─────────────────────────────────────────────────────────

export function useRateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ templateId, rating }: { templateId: string; rating: number }) => {
      const { data } = await apiClient.post<{ rating: number; rating_count: number }>(
        `/docs/templates/${templateId}/rate`,
        { rating }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs', 'templates'] })
    },
  })
}
