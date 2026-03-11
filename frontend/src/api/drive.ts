import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  })
}

export function useSharedFolders() {
  return useQuery({
    queryKey: ['drive', 'shared-folders'],
    queryFn: async () => {
      const { data } = await apiClient.get<FoldersResponse>('/drive/shared-folders')
      return data
    },
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

// ─── Audit ────────────────────────────────────────────────────────────────────

export function useShareAudit(shareId?: string) {
  return useQuery({
    queryKey: ['drive', 'share-audit', shareId],
    queryFn: async () => {
      const params = shareId ? { share_id: shareId } : {}
      const { data } = await apiClient.get<AuditResponse>('/drive/share-audit', { params })
      return data
    },
  })
}
