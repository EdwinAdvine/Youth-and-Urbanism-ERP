/**
 * Drive API client — MinIO-backed file storage, folders, and sharing.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/drive`.
 *
 * Key exports:
 *   - useDriveFiles() — list files in a folder with optional type filter
 *   - useUploadFile() — upload a file to MinIO storage
 *   - useDriveFolders() — list folders by parent ID
 *   - useShareFile() — create a share link or user permission for a file
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { REFERENCE_PRESET, LIST_PRESET, DETAIL_PRESET } from '@/utils/queryDefaults'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string
  name: string
  content_type: string
  size: number
  minio_key: string
  folder_path: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface DriveFolder {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

export interface FileShare {
  id: string
  file_id: string | null
  folder_id: string | null
  shared_with_user_id: string | null
  shared_with_team_id: string | null
  shared_by_user_id: string | null
  permission: string
  share_link: string | null
  no_download: boolean
  is_file_drop: boolean
  expires_at: string | null
  max_downloads: number | null
  download_count: number
  requires_approval: boolean
  approved: boolean
  notify_on_access: boolean
  created_at: string
}

export interface TeamFolder {
  id: string
  name: string
  description: string | null
  department: string | null
  drive_folder_id: string | null
  owner_id: string
  is_company_wide: boolean
  created_at: string
}

export interface TeamMember {
  id: string
  team_folder_id: string
  user_id: string
  permission: string
  created_at: string
}

export interface ShareAuditEntry {
  id: string
  share_id: string | null
  action: string
  actor_id: string | null
  ip_address: string | null
  details: string | null
  timestamp: string
}

export interface CreateFolderPayload {
  name: string
  parent_id?: string
}

export interface ShareFilePayload {
  user_id?: string
  team_id?: string
  permission?: string
  create_link?: boolean
  link_password?: string
  no_download?: boolean
  is_file_drop?: boolean
  expires_at?: string
  max_downloads?: number
  notify_on_access?: boolean
  requires_approval?: boolean
}

export interface ShareUpdatePayload {
  permission?: string
  expires_at?: string
  no_download?: boolean
  max_downloads?: number
  link_password?: string
  notify_on_access?: boolean
}

export interface TeamFolderPayload {
  name: string
  description?: string
  department?: string
  is_company_wide?: boolean
}

export interface TeamMemberPayload {
  user_id: string
  permission?: string
}

interface FilesResponse {
  total: number
  files: DriveFile[]
}

interface FoldersResponse {
  total: number
  folders: DriveFolder[]
}

interface SharesResponse {
  total: number
  shares: FileShare[]
}

interface TeamFoldersResponse {
  total: number
  team_folders: TeamFolder[]
}

interface TeamMembersResponse {
  total: number
  members: TeamMember[]
}

interface AuditResponse {
  total: number
  logs: ShareAuditEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function getFileType(contentType: string, name: string): string {
  if (contentType.includes('pdf')) return 'pdf'
  if (contentType.includes('word') || name.endsWith('.docx') || name.endsWith('.doc')) return 'docx'
  if (contentType.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx'
  if (contentType.includes('presentation') || name.endsWith('.pptx') || name.endsWith('.ppt')) return 'pptx'
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  if (contentType.includes('zip') || contentType.includes('compressed')) return 'zip'
  return 'other'
}

// ─── Files ────────────────────────────────────────────────────────────────────

export function useDriveFiles(params?: { folder_id?: string; file_type?: string }) {
  return useQuery({
    queryKey: ['drive', 'files', params],
    queryFn: async () => {
      const { data } = await apiClient.get<FilesResponse>('/drive/files', { params })
      return data
    },
    ...LIST_PRESET,
  })
}

export function useDriveFile(id: string) {
  return useQuery({
    queryKey: ['drive', 'files', id],
    queryFn: async () => {
      const { data } = await apiClient.get<DriveFile>(`/drive/file/${id}`)
      return data
    },
    enabled: !!id,
    ...DETAIL_PRESET,
  })
}

export function useUploadFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      file,
      folder_id,
      is_public,
      onProgress,
    }: {
      file: File
      folder_id?: string
      is_public?: boolean
      onProgress?: (pct: number) => void
    }) => {
      const form = new FormData()
      form.append('file', file)
      if (folder_id) form.append('folder_id', folder_id)
      if (is_public) form.append('is_public', 'true')
      const { data } = await apiClient.post<DriveFile>('/drive/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.get<{ download_url: string }>(
        `/drive/file/${fileId}/download`
      )
      return data
    },
  })
}

export function useDeleteFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/drive/file/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export function useDriveFolders(parentId?: string) {
  return useQuery({
    queryKey: ['drive', 'folders', parentId],
    queryFn: async () => {
      const params = parentId ? { parent_id: parentId } : {}
      const { data } = await apiClient.get<FoldersResponse>('/drive/folders', { params })
      return data
    },
    ...LIST_PRESET,
  })
}

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateFolderPayload) => {
      const { data } = await apiClient.post<DriveFolder>('/drive/folders', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'folders'] }),
  })
}

// ─── Sharing ──────────────────────────────────────────────────────────────────

export function useShareFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, ...payload }: ShareFilePayload & { fileId: string }) => {
      const { data } = await apiClient.post<FileShare>(`/drive/file/${fileId}/share`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

export function useShareFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ folderId, ...payload }: ShareFilePayload & { folderId: string }) => {
      const { data } = await apiClient.post<FileShare>(`/drive/folder/${folderId}/share`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

export function useFileShares(fileId: string) {
  return useQuery({
    queryKey: ['drive', 'shares', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<SharesResponse>(`/drive/file/${fileId}/shares`)
      return data
    },
    enabled: !!fileId,
    ...LIST_PRESET,
  })
}

export function useUpdateShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ shareId, ...payload }: ShareUpdatePayload & { shareId: string }) => {
      const { data } = await apiClient.patch<FileShare>(`/drive/share/${shareId}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

export function useRevokeShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shareId: string) => {
      await apiClient.delete(`/drive/share/${shareId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

export function useSharedWithMe() {
  return useQuery({
    queryKey: ['drive', 'shared-with-me'],
    queryFn: async () => {
      const { data } = await apiClient.get<FilesResponse>('/drive/shared-with-me')
      return data
    },
    ...LIST_PRESET,
  })
}

export function useSharedFolders() {
  return useQuery({
    queryKey: ['drive', 'shared-folders'],
    queryFn: async () => {
      const { data } = await apiClient.get<FoldersResponse>('/drive/shared-folders')
      return data
    },
    ...LIST_PRESET,
  })
}

export function useSharedLink(link: string) {
  return useQuery({
    queryKey: ['drive', 'shared-link', link],
    queryFn: async () => {
      const { data } = await apiClient.get<DriveFile>(`/drive/share/${link}`)
      return data
    },
    enabled: !!link,
    ...DETAIL_PRESET,
  })
}

// ─── Team Folders ─────────────────────────────────────────────────────────────

export function useTeamFolders() {
  return useQuery({
    queryKey: ['drive', 'team-folders'],
    queryFn: async () => {
      const { data } = await apiClient.get<TeamFoldersResponse>('/drive/team-folders')
      return data
    },
    ...LIST_PRESET,
  })
}

export function useCreateTeamFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TeamFolderPayload) => {
      const { data } = await apiClient.post<TeamFolder>('/drive/team-folders', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'team-folders'] }),
  })
}

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ['drive', 'team-members', teamId],
    queryFn: async () => {
      const { data } = await apiClient.get<TeamMembersResponse>(`/drive/team-folders/${teamId}/members`)
      return data
    },
    enabled: !!teamId,
    ...LIST_PRESET,
  })
}

export function useAddTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ teamId, ...payload }: TeamMemberPayload & { teamId: string }) => {
      const { data } = await apiClient.post<TeamMember>(`/drive/team-folders/${teamId}/members`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'team-members'] }),
  })
}

export function useRemoveTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      await apiClient.delete(`/drive/team-folders/${teamId}/members/${userId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'team-members'] }),
  })
}

export function useDeleteTeamFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (teamId: string) => {
      await apiClient.delete(`/drive/team-folders/${teamId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'team-folders'] }),
  })
}

// ─── File Versions ───────────────────────────────────────────────────────────

export interface FileVersion {
  id: string
  file_id: string
  version_number: number
  size: number
  created_at: string
  created_by: string | null
  comment: string | null
}

interface FileVersionsResponse {
  total: number
  versions: FileVersion[]
}

export function useFileVersions(fileId: string) {
  return useQuery({
    queryKey: ['drive', 'versions', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<FileVersionsResponse>(`/drive/files/${fileId}/versions`)
      return data
    },
    enabled: !!fileId,
    ...LIST_PRESET,
  })
}

export function useRestoreFileVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, versionId }: { fileId: string; versionId: string }) => {
      const { data } = await apiClient.post(`/drive/files/${fileId}/versions/${versionId}/restore`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.post(`/drive/file/${fileId}/favorite`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

export function useFavoriteFiles() {
  return useQuery({
    queryKey: ['drive', 'favorites'],
    queryFn: async () => {
      const { data } = await apiClient.get<FilesResponse>('/drive/favorites')
      return data
    },
    ...LIST_PRESET,
  })
}

// ─── Bulk Actions ────────────────────────────────────────────────────────────

export function useBulkDeleteFiles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileIds: string[]) => {
      await apiClient.post('/drive/bulk/delete', { file_ids: fileIds })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

export function useBulkMoveFiles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileIds, folderId }: { fileIds: string[]; folderId: string }) => {
      await apiClient.post('/drive/bulk/move', { file_ids: fileIds, folder_id: folderId })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface SharingPolicies {
  allow_external_sharing: boolean
  allow_public_links: boolean
  default_link_expiry_days: number | null
  max_link_expiry_days: number | null
  allow_file_drop: boolean
  require_password_for_links: boolean
}

export function useSharingPolicies() {
  return useQuery({
    queryKey: ['drive', 'sharing-policies'],
    queryFn: async () => {
      const { data } = await apiClient.get<SharingPolicies>('/drive/sharing-policies')
      return data
    },
    ...REFERENCE_PRESET,
  })
}

export function useDownloadShareLink() {
  return useMutation({
    mutationFn: async ({ link, password }: { link: string; password?: string }) => {
      const { data } = await apiClient.post<{ download_url: string }>(
        `/drive/share/${link}/download`,
        password ? { password } : {}
      )
      return data
    },
  })
}

export function useFileDropUpload() {
  return useMutation({
    mutationFn: async ({ link, file }: { link: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      const { data } = await apiClient.post(`/drive/share/${link}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
  })
}

export function useShareAudit(shareId?: string) {
  return useQuery({
    queryKey: ['drive', 'share-audit', shareId],
    queryFn: async () => {
      const params = shareId ? { share_id: shareId } : {}
      const { data } = await apiClient.get<AuditResponse>('/drive/share-audit', { params })
      return data
    },
    ...LIST_PRESET,
  })
}

// ─── Cross-Module: Drive → Docs (ONLYOFFICE) ────────────────────────────────

export interface EditorConfig {
  editor_url: string
  config: Record<string, unknown>
  file_id: string
  file_name: string
}

export function useOpenInEditor() {
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.post<EditorConfig>(`/drive/files/${fileId}/open-in-editor`)
      return data
    },
  })
}

// ─── Cross-Module: Drive → Mail (attachment metadata) ────────────────────────

export interface AttachmentMeta {
  file_id: string
  name: string
  content_type: string
  size: number
  download_url: string
  minio_key: string
}

export function useFileAsAttachment() {
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.get<AttachmentMeta>(`/drive/files/${fileId}/as-attachment`)
      return data
    },
  })
}

// ─── Cross-Module: Drive → Projects (link file to task) ─────────────────────

export function useLinkFileToTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, taskId, projectId }: { fileId: string; taskId: string; projectId: string }) => {
      const { data } = await apiClient.post(`/drive/files/${fileId}/link-task`, {
        task_id: taskId,
        project_id: projectId,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive'] }),
  })
}
