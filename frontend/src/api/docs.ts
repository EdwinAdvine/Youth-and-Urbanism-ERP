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
  task_id: string
  project_id: string
  linked_by: string
  created_at: string
}

export interface DocLinkCreate {
  file_id: string
  task_id: string
  project_id: string
}

// ─── Comment Hooks ───────────────────────────────────────────────────────────

export function useDocComments(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'comments', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; comments: DocComment[] }>(`/docs/file/${fileId}/comments`)
      return data.comments
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
      const { data } = await apiClient.get<{ total: number; versions: DocVersion[] }>(`/docs/file/${fileId}/versions`)
      return data.versions
    },
    enabled: !!fileId,
  })
}

export function useDownloadVersion() {
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { data } = await apiClient.get<{ download_url: string }>(`/docs/version/${versionId}/download`)
      return data.download_url
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
      const { data } = await apiClient.get<{ total: number; links: DocLink[] }>(`/docs/file/${fileId}/links`)
      return data.links
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
      qc.invalidateQueries({ queryKey: ['docs', 'task-docs', vars.task_id] })
    },
  })
}

export function useTaskDocs(taskId: string) {
  return useQuery({
    queryKey: ['docs', 'task-docs', taskId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; documents: DocLink[] }>(`/docs/task/${taskId}/docs`)
      return data.documents
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

// ─── AI Document Hooks ──────────────────────────────────────────────────────

export interface AIGeneratePayload {
  prompt: string
  doc_type?: string
}

export interface AISummarizePayload {
  max_length?: number
}

export interface AITranslatePayload {
  target_language: string
}

export interface AIImprovePayload {
  text: string
  tone?: string
}

export interface AIExpandPayload {
  text: string
}

export interface AISimplifyPayload {
  text: string
}

export function useAIGenerate(fileId: string) {
  return useMutation({
    mutationFn: async (payload: AIGeneratePayload) => {
      const { data } = await apiClient.post(`/docs/docs/${fileId}/ai-generate`, payload)
      return data as { file_id: string; generated_content: string; model: string }
    },
  })
}

export function useAISummarize(fileId: string) {
  return useMutation({
    mutationFn: async (payload: AISummarizePayload) => {
      const { data } = await apiClient.post(`/docs/docs/${fileId}/ai-summarize`, payload)
      return data as { file_id: string; filename: string; summary: string; model: string }
    },
  })
}

export function useAITranslate(fileId: string) {
  return useMutation({
    mutationFn: async (payload: AITranslatePayload) => {
      const { data } = await apiClient.post(`/docs/docs/${fileId}/ai-translate`, payload)
      return data as { file_id: string; filename: string; target_language: string; translated_content: string; model: string }
    },
  })
}

export function useAIImprove(fileId: string) {
  return useMutation({
    mutationFn: async (payload: AIImprovePayload) => {
      const { data } = await apiClient.post(`/docs/docs/${fileId}/ai-improve`, payload)
      return data as { file_id: string; improved_content: string; model: string }
    },
  })
}

export function useAIExpand(fileId: string) {
  return useMutation({
    mutationFn: async (payload: AIExpandPayload) => {
      const { data } = await apiClient.post(`/docs/docs/${fileId}/ai-expand`, payload)
      return data as { file_id: string; expanded_content: string; model: string }
    },
  })
}

export function useAISimplify(fileId: string) {
  return useMutation({
    mutationFn: async (payload: AISimplifyPayload) => {
      const { data } = await apiClient.post(`/docs/docs/${fileId}/ai-simplify`, payload)
      return data as { file_id: string; simplified_content: string; model: string }
    },
  })
}

// ─── Bookmark Hooks ─────────────────────────────────────────────────────────

export interface BookmarkItem {
  bookmark_id: string
  file_id: string
  name: string
  extension: string
  size: number
  content_type: string
  bookmarked_at: string
}

export function useBookmarks() {
  return useQuery({
    queryKey: ['docs', 'bookmarks'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; bookmarks: BookmarkItem[] }>('/docs/bookmarks')
      return data
    },
  })
}

export function useToggleBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data } = await apiClient.post<{ file_id: string; bookmarked: boolean }>(`/docs/docs/${fileId}/bookmark`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs', 'bookmarks'] })
    },
  })
}

// ─── ERP Template Generation Hooks ──────────────────────────────────────────

export interface ERPTemplate {
  id: string
  name: string
  module: string
  doc_type: string
  description: string
  required_fields: string
}

export interface ERPGeneratePayload {
  template_type: string
  params: Record<string, string>
}

export interface ERPGenerateResult {
  file_id: string
  filename: string
  template_type: string
  size: number
  content_type: string
}

export function useERPTemplates() {
  return useQuery({
    queryKey: ['docs', 'erp-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ templates: ERPTemplate[] }>('/docs/erp-templates')
      return data
    },
  })
}

export function useGenerateFromERP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ERPGeneratePayload) => {
      const { data } = await apiClient.post<ERPGenerateResult>('/docs/generate-from-erp', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs'] })
    },
  })
}

// ─── Spreadsheet Data Connection Hooks ──────────────────────────────────────

export interface DataConnection {
  id: string
  file_id: string
  source_module: string
  query_type: string
  query_params: Record<string, string>
  target_range: string
  refresh_interval_minutes: number
  last_refreshed: string | null
  cached_data: Record<string, unknown> | null
}

export interface ERPFormula {
  name: string
  description: string
}

export function useDataConnections(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'data-connections', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ connections: DataConnection[] }>(`/docs/spreadsheet/${fileId}/data-connections`)
      return data
    },
    enabled: !!fileId,
  })
}

export function useCreateDataConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file_id: string; source_module: string; query_type: string; query_params: Record<string, string>; target_range: string; refresh_interval_minutes?: number }) => {
      const { data } = await apiClient.post(`/docs/spreadsheet/${payload.file_id}/data-connection`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'data-connections'] }),
  })
}

export function useEvaluateFormula() {
  return useMutation({
    mutationFn: async (payload: { file_id: string; formulas: { formula: string; params?: Record<string, string>; cell?: string }[] }) => {
      const { data } = await apiClient.post(`/docs/spreadsheet/${payload.file_id}/evaluate`, { formulas: payload.formulas })
      return data as { results: Record<string, unknown>[] }
    },
  })
}

export function useRefreshDataConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file_id: string; connection_id: string }) => {
      const { data } = await apiClient.post(`/docs/spreadsheet/${payload.file_id}/refresh-data/${payload.connection_id}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'data-connections'] }),
  })
}

export function useERPFormulas() {
  return useQuery({
    queryKey: ['docs', 'erp-formulas'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ formulas: ERPFormula[] }>('/docs/spreadsheet/formulas')
      return data
    },
  })
}

// ─── Chart Hooks ────────────────────────────────────────────────────────────

export interface ChartPreset {
  id: string
  name: string
  module: string
  chart_type: string
  description: string
}

export interface ChartData {
  chart_id: string
  chart_type: string
  title: string
  labels: string[]
  datasets: { label: string; data: number[] }[]
}

export function useChartPresets() {
  return useQuery({
    queryKey: ['docs', 'chart-presets'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ charts: ChartPreset[] }>('/docs/charts/presets')
      return data
    },
  })
}

export function useGenerateChart() {
  return useMutation({
    mutationFn: async (payload: { chart_id: string; params?: Record<string, string> }) => {
      const { data } = await apiClient.post<ChartData>('/docs/charts/generate', payload)
      return data
    },
  })
}

// ─── Document Analytics Hooks ───────────────────────────────────────────────

export interface DocAnalyticsOverview {
  total_documents: number
  total_storage_bytes: number
  total_storage_mb: number
  total_comments: number
  total_bookmarks: number
  active_documents_7d: number
  active_users_7d: number
}

export function useDocAnalyticsOverview() {
  return useQuery({
    queryKey: ['docs', 'analytics', 'overview'],
    queryFn: async () => {
      const { data } = await apiClient.get<DocAnalyticsOverview>('/docs/analytics/overview')
      return data
    },
  })
}

export function useDocAnalyticsUsage() {
  return useQuery({
    queryKey: ['docs', 'analytics', 'usage'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ usage: Record<string, unknown>[] }>('/docs/analytics/usage')
      return data
    },
  })
}

export function useDocAnalyticsTopDocs(limit = 10) {
  return useQuery({
    queryKey: ['docs', 'analytics', 'top', limit],
    queryFn: async () => {
      const { data } = await apiClient.get<{ documents: Record<string, unknown>[] }>('/docs/analytics/top-documents', { params: { limit } })
      return data
    },
  })
}

export function useDocAnalyticsStorage(days = 30) {
  return useQuery({
    queryKey: ['docs', 'analytics', 'storage', days],
    queryFn: async () => {
      const { data } = await apiClient.get<{ trend: Record<string, unknown>[] }>('/docs/analytics/storage-trend', { params: { days } })
      return data
    },
  })
}

export function useDocAnalyticsCollab() {
  return useQuery({
    queryKey: ['docs', 'analytics', 'collaboration'],
    queryFn: async () => {
      const { data } = await apiClient.get<Record<string, unknown>>('/docs/analytics/collaboration')
      return data
    },
  })
}

// ─── Document Security Hooks ────────────────────────────────────────────────

export interface DocumentSecuritySettings {
  file_id: string
  classification: string
  prevent_download: boolean
  prevent_print: boolean
  prevent_copy: boolean
  watermark_enabled: boolean
  watermark_text: string | null
  expires_at: string | null
}

export function useDocSecurity(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'security', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<DocumentSecuritySettings>(`/docs/docs/${fileId}/security`)
      return data
    },
    enabled: !!fileId,
  })
}

export function useUpdateDocSecurity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { fileId: string } & Partial<DocumentSecuritySettings>) => {
      const { fileId, ...body } = payload
      const { data } = await apiClient.put(`/docs/docs/${fileId}/security`, body)
      return data
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['docs', 'security', vars.fileId] }),
  })
}

export function useDocAuditLog(fileId: string) {
  return useQuery({
    queryKey: ['docs', 'audit', fileId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ logs: Record<string, unknown>[] }>(`/docs/docs/${fileId}/audit-log`)
      return data
    },
    enabled: !!fileId,
  })
}

// ─── Agentic Document Hooks ─────────────────────────────────────────────────

export interface AgentAction {
  id: string
  name: string
  description: string
}

export function useAgentActions() {
  return useQuery({
    queryKey: ['docs', 'agent-actions'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ actions: AgentAction[] }>('/docs/agent/actions')
      return data
    },
  })
}

export function useRunAgentAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { action: string; params: Record<string, string> }) => {
      const { data } = await apiClient.post<{ file_id: string; filename: string; content_type: string }>('/docs/agent/run', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }),
  })
}

// ─── Template Marketplace Hooks ─────────────────────────────────────────────

export interface TemplateCategory {
  id: string
  name: string
  description: string | null
  icon: string | null
  sort_order: number
}

export function useTemplateCategories() {
  return useQuery({
    queryKey: ['docs', 'template-categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ categories: TemplateCategory[] }>('/docs/templates/categories')
      return data
    },
  })
}

export function useToggleTemplateFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await apiClient.post<{ template_id: string; favorited: boolean }>(`/docs/templates/${templateId}/favorite`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'templates'] }),
  })
}

export function useTemplateFavorites() {
  return useQuery({
    queryKey: ['docs', 'template-favorites'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ favorites: string[] }>('/docs/templates/favorites')
      return data
    },
  })
}
