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

// ─── Semantic Search ──────────────────────────────────────────────────────

export interface SemanticSearchResult {
  id: string
  name: string
  content_type: string
  size: number
  folder_path: string
  sensitivity_level: string | null
  relevance_score: number
  match_type: 'content' | 'semantic' | 'filename'
  snippet?: string
  created_at: string | null
  updated_at: string | null
}

export interface SemanticSearchParams {
  query: string
  content_type?: string
  folder_id?: string
  tag?: string
  date_from?: string
  date_to?: string
  sensitivity?: string
  page?: number
  limit?: number
}

export function useSemanticSearch() {
  return useMutation({
    mutationFn: async (params: SemanticSearchParams) => {
      const { data } = await apiClient.post<{ total: number; query: string; results: SemanticSearchResult[] }>(
        '/drive/files/semantic-search',
        params
      )
      return data
    },
  })
}

// ─── AI File Metadata ─────────────────────────────────────────────────────

export interface FileAIMetadata {
  file_id: string
  status: 'processed' | 'processing' | 'not_processed'
  summary?: string
  entities?: {
    people?: string[]
    organizations?: string[]
    dates?: string[]
    amounts?: string[]
    locations?: string[]
  }
  suggested_tags?: string[]
  sensitivity_level?: string
  language?: string
  word_count?: number
  module_suggestions?: { module: string; action: string }[]
  processed_at?: string
  processing_error?: string
}

export function useFileAIMetadata(fileId: string) {
  return useQuery({
    queryKey: ['drive', 'ai-metadata', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<FileAIMetadata>(`/drive/files/${fileId}/ai-metadata`)
      return data
    },
    enabled: !!fileId,
  })
}

export function useReprocessAI() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.post(`/drive/files/${fileId}/reprocess-ai`)
      return data
    },
    onSuccess: (_data, fileId) => {
      qc.invalidateQueries({ queryKey: ['drive', 'ai-metadata', fileId] })
    },
  })
}

export function useApplyAITags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.post<{ applied_tags: string[] }>(
        `/drive/files/${fileId}/apply-ai-tags`
      )
      return data
    },
    onSuccess: (_data, fileId) => {
      qc.invalidateQueries({ queryKey: ['drive', 'tags', fileId] })
      qc.invalidateQueries({ queryKey: ['drive', 'ai-metadata', fileId] })
    },
  })
}

// ─── Smart Folders ────────────────────────────────────────────────────────

export interface SmartFolder {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
  filter_json: Record<string, unknown>
  sort_field: string
  sort_direction: string
  is_pinned: boolean
  created_at: string
}

export function useSmartFolders() {
  return useQuery({
    queryKey: ['drive', 'smart-folders'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; smart_folders: SmartFolder[] }>(
        '/drive/smart-folders'
      )
      return data.smart_folders
    },
  })
}

export function useCreateSmartFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<SmartFolder, 'id' | 'created_at'>) => {
      const { data } = await apiClient.post('/drive/smart-folders', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'smart-folders'] }),
  })
}

export function useUpdateSmartFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<SmartFolder>) => {
      const { data } = await apiClient.put(`/drive/smart-folders/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'smart-folders'] }),
  })
}

export function useDeleteSmartFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/drive/smart-folders/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'smart-folders'] }),
  })
}

export function useSmartFolderFiles(folderId: string, page = 1) {
  return useQuery({
    queryKey: ['drive', 'smart-folder-files', folderId, page],
    queryFn: async () => {
      const { data } = await apiClient.get<{ smart_folder: string; total: number; files: DriveFile[] }>(
        `/drive/smart-folders/${folderId}/files`,
        { params: { page } }
      )
      return data
    },
    enabled: !!folderId,
  })
}

// ─── Saved Views ──────────────────────────────────────────────────────────

export interface SavedView {
  id: string
  name: string
  folder_id?: string
  filters_json?: Record<string, unknown>
  sort_json?: Record<string, unknown>
  columns_json?: string[]
  view_type: string
  is_default: boolean
}

export function useSavedViews(folderId?: string) {
  return useQuery({
    queryKey: ['drive', 'saved-views', folderId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ views: SavedView[] }>('/drive/saved-views', {
        params: folderId ? { folder_id: folderId } : {},
      })
      return data.views
    },
  })
}

export function useCreateSavedView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<SavedView, 'id'>) => {
      const { data } = await apiClient.post('/drive/saved-views', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'saved-views'] }),
  })
}

// ─── File Metadata (key-value) ────────────────────────────────────────────

export interface FileMetadataItem {
  id: string
  key: string
  value: string | null
  value_type: string
}

export function useFileCustomMetadata(fileId: string) {
  return useQuery({
    queryKey: ['drive', 'metadata', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ metadata: FileMetadataItem[] }>(
        `/drive/files/${fileId}/metadata`
      )
      return data.metadata
    },
    enabled: !!fileId,
  })
}

export function useSetFileMetadata() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, key, value }: { fileId: string; key: string; value: string }) => {
      const { data } = await apiClient.post(`/drive/files/${fileId}/metadata`, { key, value })
      return data
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['drive', 'metadata', vars.fileId] }),
  })
}

// ─── File Locking ─────────────────────────────────────────────────────────

export function useLockFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.post(`/drive/files/${fileId}/lock`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

export function useUnlockFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.post(`/drive/files/${fileId}/unlock`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

// ─── Activity Log ─────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string
  file_id?: string
  folder_id?: string
  action: string
  metadata?: Record<string, unknown>
  timestamp: string
}

export function useActivityLog(fileId?: string, action?: string) {
  return useQuery({
    queryKey: ['drive', 'activity-log', fileId, action],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; logs: ActivityLogEntry[] }>(
        '/drive/activity-log',
        { params: { file_id: fileId, action } }
      )
      return data
    },
  })
}

// ─── Sensitivity Labels ───────────────────────────────────────────────────

export interface SensitivityLabel {
  id: string
  name: string
  display_name: string
  description?: string
  color: string
  severity: number
  block_external_sharing: boolean
  block_public_links: boolean
}

export function useSensitivityLabels() {
  return useQuery({
    queryKey: ['drive', 'sensitivity-labels'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ labels: SensitivityLabel[] }>('/drive/sensitivity-labels')
      return data.labels
    },
  })
}

export function useSetFileSensitivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, level }: { fileId: string; level: string }) => {
      const { data } = await apiClient.put(`/drive/files/${fileId}/sensitivity`, null, {
        params: { level },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

// ─── Drive Analytics ──────────────────────────────────────────────────────

export interface DriveAnalyticsOverview {
  total_bytes: number
  total_files: number
  ai_processed_files: number
  by_sensitivity: Record<string, number>
  activity_last_7_days: number
}

export function useDriveAnalytics() {
  return useQuery({
    queryKey: ['drive', 'analytics'],
    queryFn: async () => {
      const { data } = await apiClient.get<DriveAnalyticsOverview>('/drive/analytics/overview')
      return data
    },
  })
}

// ─── Utility ──────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function getFileTypeCategory(contentType: string): string {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  if (contentType.includes('pdf')) return 'pdf'
  if (contentType.includes('word') || contentType.includes('document')) return 'docx'
  if (contentType.includes('sheet') || contentType.includes('excel')) return 'xlsx'
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return 'pptx'
  if (contentType.includes('zip') || contentType.includes('compressed')) return 'zip'
  return 'other'
}
