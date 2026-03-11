import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type { DriveFile } from './drive'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileTag {
  id: string
  file_id: string
  name: string
  color: string
  created_at: string
}

export interface FileComment {
  id: string
  file_id: string
  author_id: string
  author_name: string
  content: string
  created_at: string
  updated_at: string
}

export interface TrashItem {
  id: string
  name: string
  content_type: string
  size: number
  folder_path: string
  deleted_at: string
  original_path: string
  type: 'file' | 'folder'
}

export interface FileVersion {
  id: string
  file_id: string
  version_number: number
  size: number
  minio_key: string
  created_by: string | null
  created_at: string
}

export interface StorageUsage {
  used_bytes: number
  total_bytes: number
  used_formatted: string
  total_formatted: string
  percentage: number
  by_type: { type: string; size: number; count: number }[]
}

export interface FileSearchParams {
  query: string
  file_type?: string
  date_from?: string
  date_to?: string
  min_size?: number
  max_size?: number
  folder_id?: string
}

// ─── Copy File ──────────────────────────────────────────────────────────────

export function useCopyFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, targetFolderId }: { fileId: string; targetFolderId?: string }) => {
      const { data } = await apiClient.post<DriveFile>(`/drive/file/${fileId}/copy`, {
        target_folder_id: targetFolderId,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

// ─── Bulk Operations ────────────────────────────────────────────────────────

export function useBulkDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileIds: string[]) => {
      await apiClient.post('/drive/bulk/delete', { file_ids: fileIds })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

export function useBulkMove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileIds, targetFolderId }: { fileIds: string[]; targetFolderId: string }) => {
      await apiClient.post('/drive/bulk/move', {
        file_ids: fileIds,
        target_folder_id: targetFolderId,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

// ─── File Versions ──────────────────────────────────────────────────────────

export function useFileVersions(fileId: string) {
  return useQuery({
    queryKey: ['drive', 'versions', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ versions: FileVersion[] }>(
        `/drive/file/${fileId}/versions`
      )
      return data.versions
    },
    enabled: !!fileId,
  })
}

// ─── Trash ──────────────────────────────────────────────────────────────────

export function useTrash() {
  return useQuery({
    queryKey: ['drive', 'trash'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; items: TrashItem[] }>('/drive/trash')
      return data
    },
  })
}

export function useRestoreFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileId: string) => {
      await apiClient.post(`/drive/trash/${fileId}/restore`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drive', 'trash'] })
      qc.invalidateQueries({ queryKey: ['drive', 'files'] })
    },
  })
}

export function useEmptyTrash() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete('/drive/trash')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'trash'] }),
  })
}

// ─── Storage Usage ──────────────────────────────────────────────────────────

export function useStorageUsage() {
  return useQuery({
    queryKey: ['drive', 'storage'],
    queryFn: async () => {
      const { data } = await apiClient.get<StorageUsage>('/drive/storage')
      return data
    },
  })
}

// ─── Search ─────────────────────────────────────────────────────────────────

export function useFileSearch(params: FileSearchParams) {
  return useQuery({
    queryKey: ['drive', 'search', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; files: DriveFile[] }>(
        '/drive/search',
        { params }
      )
      return data
    },
    enabled: !!params.query,
  })
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export function useFileTags(fileId: string) {
  return useQuery({
    queryKey: ['drive', 'tags', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ tags: FileTag[] }>(`/drive/file/${fileId}/tags`)
      return data.tags
    },
    enabled: !!fileId,
  })
}

export function useAddFileTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, name, color }: { fileId: string; name: string; color?: string }) => {
      const { data } = await apiClient.post<FileTag>(`/drive/file/${fileId}/tags`, { name, color })
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['drive', 'tags', vars.fileId] })
    },
  })
}

export function useRemoveFileTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, tagId }: { fileId: string; tagId: string }) => {
      await apiClient.delete(`/drive/file/${fileId}/tags/${tagId}`)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['drive', 'tags', vars.fileId] })
    },
  })
}

// ─── File Comments ──────────────────────────────────────────────────────────

export function useFileComments(fileId: string) {
  return useQuery({
    queryKey: ['drive', 'comments', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ comments: FileComment[] }>(
        `/drive/file/${fileId}/comments`
      )
      return data.comments
    },
    enabled: !!fileId,
  })
}

export function useCreateFileComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      const { data } = await apiClient.post<FileComment>(`/drive/file/${fileId}/comments`, {
        content,
      })
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['drive', 'comments', vars.fileId] })
    },
  })
}
