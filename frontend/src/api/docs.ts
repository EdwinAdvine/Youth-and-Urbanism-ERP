import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Document {
  id: string
  name: string
  extension: string
  content_type: string
  size: number
  minio_key: string
  folder_path: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface CreateDocPayload {
  filename: string
  doc_type?: string
}

export interface EditorConfigResponse {
  file_id: string
  filename: string
  onlyoffice_url: string
  editor_config: Record<string, unknown>
}

interface DocumentsResponse {
  total: number
  documents: Document[]
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDocuments(docType?: string) {
  return useQuery({
    queryKey: ['docs', docType],
    queryFn: async () => {
      const params = docType ? { doc_type: docType } : {}
      const { data } = await apiClient.get<DocumentsResponse>('/docs/files', { params })
      return data
    },
  })
}

export function useCreateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateDocPayload) => {
      const { data } = await apiClient.post('/docs/create', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs'] })
    },
  })
}

export function useEditorConfig(fileId: string, mode: string = 'edit') {
  return useQuery({
    queryKey: ['docs', 'editor-config', fileId, mode],
    queryFn: async () => {
      const { data } = await apiClient.get<EditorConfigResponse>(`/docs/editor-config/${fileId}`, {
        params: { mode },
      })
      return data
    },
    enabled: !!fileId,
  })
}

// ─── Comment Types ───────────────────────────────────────────────────────────

export interface DocComment {
  id: string
  file_id: string
  author_id: string
  content: string
  anchor: string | null
  parent_id: string | null
  resolved: boolean
  created_at: string
  updated_at: string
  author_name: string
  replies: DocComment[]
}

export interface DocCommentCreate {
  content: string
  anchor?: string
  parent_id?: string
}

export interface DocCommentUpdate {
  content?: string
  resolved?: boolean
}

// ─── Version Types ───────────────────────────────────────────────────────────

export interface DocVersion {
  id: string
  file_id: string
  version_number: number
  minio_key: string
  size: number
  saved_by: string | null
  label: string | null
  changes_url: string | null
  created_at: string
}

// ─── Doc Link Types ──────────────────────────────────────────────────────────

export interface DocLink {
  id: string
  file_id: string
  entity_type: string
  entity_id: string
  created_at: string
}

export interface DocLinkCreate {
  file_id: string
  entity_type: string
  entity_id: string
}

// ─── Comment Hooks ───────────────────────────────────────────────────────────

export function useDocComments(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'comments', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<DocComment[]>(`/docs/file/${fileId}/comments`)
      return data
    },
    enabled: !!fileId,
  })
}

export function useCreateDocComment(fileId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DocCommentCreate) => {
      const { data } = await apiClient.post<DocComment>(`/docs/file/${fileId}/comments`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'comments', fileId] }),
  })
}

export function useUpdateDocComment(fileId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ commentId, ...payload }: DocCommentUpdate & { commentId: string }) => {
      const { data } = await apiClient.put<DocComment>(`/docs/comment/${commentId}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'comments', fileId] }),
  })
}

export function useDeleteDocComment(fileId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      await apiClient.delete(`/docs/comment/${commentId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'comments', fileId] }),
  })
}

// ─── Version Hooks ───────────────────────────────────────────────────────────

export function useDocVersions(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'versions', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<DocVersion[]>(`/docs/file/${fileId}/versions`)
      return data
    },
    enabled: !!fileId,
  })
}

export function useDownloadVersion() {
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { data } = await apiClient.get<{ url: string }>(`/docs/version/${versionId}/download`)
      return data.url
    },
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

// ─── Doc Link Hooks ──────────────────────────────────────────────────────────

export function useDocLinks(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'links', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<DocLink[]>(`/docs/file/${fileId}/links`)
      return data
    },
    enabled: !!fileId,
  })
}

export function useCreateDocLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DocLinkCreate) => {
      const { data } = await apiClient.post<DocLink>('/docs/link', payload)
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['docs', 'links', vars.file_id] })
    },
  })
}

export function useTaskDocs(taskId: string) {
  return useQuery({
    queryKey: ['docs', 'task-docs', taskId],
    queryFn: async () => {
      const { data } = await apiClient.get<DocLink[]>(`/docs/task/${taskId}/docs`)
      return data
    },
    enabled: !!taskId,
  })
}

export function useDeleteDocLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (linkId: string) => {
      await apiClient.delete(`/docs/link/${linkId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'links'] }),
  })
}

// ─── Conversion Hooks ────────────────────────────────────────────────────────

export interface ConvertPayload {
  output_format: string
}

export interface ConversionResult {
  file_id: string
  original_name: string
  target_format: string
  conversion: {
    end_convert: boolean
    file_url: string | null
    percent: number
    error: string | null
  }
}

export function useConvertDocument(fileId: string) {
  return useMutation({
    mutationFn: async (payload: ConvertPayload) => {
      const { data } = await apiClient.post<ConversionResult>(`/docs/${fileId}/convert`, payload)
      return data
    },
  })
}

// ─── Active Editors Hooks ────────────────────────────────────────────────────

export interface ActiveEditor {
  user_id: string
  user_name: string
  joined_at: string
}

export interface EditorsResponse {
  file_id: string
  editors: ActiveEditor[]
  count: number
}

export function useActiveEditors(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'editors', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<EditorsResponse>(`/docs/${fileId}/editors`)
      return data
    },
    enabled: !!fileId,
    refetchInterval: 15000, // Poll every 15 seconds for presence updates
  })
}

// ─── Cross-Module Hooks ──────────────────────────────────────────────────────

export interface AttachToEmailResponse {
  file_id: string
  filename: string
  content_type: string
  download_url: string
  size: number
}

export function useAttachToEmail() {
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.post<AttachToEmailResponse>(`/docs/${fileId}/attach-to-email`)
      return data
    },
  })
}

export interface LinkToNotePayload {
  note_id: string
}

export function useLinkToNote() {
  return useMutation({
    mutationFn: async ({ fileId, noteId }: { fileId: string; noteId: string }) => {
      const { data } = await apiClient.post(`/docs/${fileId}/link-to-note`, { note_id: noteId })
      return data
    },
  })
}

export function useGenerateInvoiceDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data } = await apiClient.post(`/docs/generate-invoice/${invoiceId}`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs'] })
    },
  })
}
