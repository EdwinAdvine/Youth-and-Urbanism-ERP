/**
 * API hooks for Y&U Notes — Notebooks, Sections, Page Tree, Versions, Comments, Entity Links.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

// ── Notebooks ──────────────────────────────────────────────────────────────

export function useNotebooks(includeArchived = false) {
  return useQuery({
    queryKey: ['notebooks', { includeArchived }],
    queryFn: async () => {
      const { data } = await api.get('/notebooks', { params: { include_archived: includeArchived } })
      return data
    },
  })
}

export function useNotebook(id: string) {
  return useQuery({
    queryKey: ['notebook', id],
    queryFn: async () => {
      const { data } = await api.get(`/notebooks/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useNotebookTree(notebookId: string) {
  return useQuery({
    queryKey: ['notebook-tree', notebookId],
    queryFn: async () => {
      const { data } = await api.get(`/notebooks/${notebookId}/tree`)
      return data
    },
    enabled: !!notebookId,
  })
}

export function useCreateNotebook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { title: string; description?: string; icon?: string; color?: string }) => {
      const { data } = await api.post('/notebooks', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
  })
}

export function useUpdateNotebook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; title?: string; description?: string; icon?: string; color?: string; is_archived?: boolean }) => {
      const { data } = await api.put(`/notebooks/${id}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['notebooks'] })
      qc.invalidateQueries({ queryKey: ['notebook', vars.id] })
    },
  })
}

export function useDeleteNotebook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, permanent = false }: { id: string; permanent?: boolean }) => {
      await api.delete(`/notebooks/${id}`, { params: { permanent } })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
  })
}

export function useReorderNotebooks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await api.put('/notebooks/reorder', { ids })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
  })
}

// ── Sections ───────────────────────────────────────────────────────────────

export function useCreateSection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ notebookId, ...payload }: { notebookId: string; title: string; color?: string }) => {
      const { data } = await api.post(`/notebooks/${notebookId}/sections`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['notebook-tree', vars.notebookId] })
      qc.invalidateQueries({ queryKey: ['notebook', vars.notebookId] })
    },
  })
}

export function useUpdateSection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ notebookId, sectionId, ...payload }: { notebookId: string; sectionId: string; title?: string; color?: string }) => {
      const { data } = await api.put(`/notebooks/${notebookId}/sections/${sectionId}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['notebook-tree', vars.notebookId] })
    },
  })
}

export function useDeleteSection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ notebookId, sectionId }: { notebookId: string; sectionId: string }) => {
      await api.delete(`/notebooks/${notebookId}/sections/${sectionId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['notebook-tree', vars.notebookId] })
      qc.invalidateQueries({ queryKey: ['notebook', vars.notebookId] })
    },
  })
}

// ── Page Navigation ────────────────────────────────────────────────────────

export function useNotebookPages(notebookId: string, sectionId?: string) {
  return useQuery({
    queryKey: ['notebook-pages', notebookId, sectionId],
    queryFn: async () => {
      const { data } = await api.get(`/notebooks/${notebookId}/pages`, {
        params: sectionId ? { section_id: sectionId } : undefined,
      })
      return data
    },
    enabled: !!notebookId,
  })
}

export function useRecentPages(limit = 20) {
  return useQuery({
    queryKey: ['recent-pages', limit],
    queryFn: async () => {
      const { data } = await api.get('/notebooks/pages/recent', { params: { limit } })
      return data
    },
  })
}

export function useFavoritePages() {
  return useQuery({
    queryKey: ['favorite-pages'],
    queryFn: async () => {
      const { data } = await api.get('/notebooks/pages/favorites')
      return data
    },
  })
}

export function useMovePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, ...payload }: { noteId: string; notebook_id?: string; section_id?: string; parent_page_id?: string | null; sort_order?: number }) => {
      const { data } = await api.put(`/notebooks/pages/${noteId}/move`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebook-tree'] })
      qc.invalidateQueries({ queryKey: ['notebook-pages'] })
    },
  })
}

export function usePageBreadcrumb(noteId: string) {
  return useQuery({
    queryKey: ['page-breadcrumb', noteId],
    queryFn: async () => {
      const { data } = await api.get(`/notebooks/pages/${noteId}/breadcrumb`)
      return data
    },
    enabled: !!noteId && noteId !== 'recent' && noteId !== 'favorites',
  })
}

// ── Entity Links ───────────────────────────────────────────────────────────

export function useEntityLinks(noteId: string) {
  return useQuery({
    queryKey: ['entity-links', noteId],
    queryFn: async () => {
      const { data } = await api.get(`/notebooks/pages/${noteId}/entity-links`)
      return data
    },
    enabled: !!noteId,
  })
}

export function useCreateEntityLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, ...payload }: { noteId: string; entity_type: string; entity_id: string; link_type?: string }) => {
      const { data } = await api.post(`/notebooks/pages/${noteId}/entity-links`, payload)
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['entity-links', vars.noteId] }),
  })
}

export function useDeleteEntityLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, linkId }: { noteId: string; linkId: string }) => {
      await api.delete(`/notebooks/pages/${noteId}/entity-links/${linkId}`)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['entity-links', vars.noteId] }),
  })
}

// ── Versions ───────────────────────────────────────────────────────────────

export function useNoteVersions(noteId: string) {
  return useQuery({
    queryKey: ['note-versions', noteId],
    queryFn: async () => {
      const { data } = await api.get(`/notebooks/pages/${noteId}/versions`)
      return data
    },
    enabled: !!noteId,
  })
}

export function useCreateVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, label }: { noteId: string; label?: string }) => {
      const { data } = await api.post(`/notebooks/pages/${noteId}/versions`, { label })
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['note-versions', vars.noteId] }),
  })
}

export function useRestoreVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, versionId }: { noteId: string; versionId: string }) => {
      const { data } = await api.post(`/notebooks/pages/${noteId}/versions/${versionId}/restore`)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['note-versions', vars.noteId] })
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// ── Comments ───────────────────────────────────────────────────────────────

export function useNoteComments(noteId: string) {
  return useQuery({
    queryKey: ['note-comments', noteId],
    queryFn: async () => {
      const { data } = await api.get(`/notebooks/pages/${noteId}/comments`)
      return data
    },
    enabled: !!noteId,
  })
}

export function useCreateComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, ...payload }: {
      noteId: string; content: string; parent_comment_id?: string;
      anchor_block_id?: string; anchor_text?: string
    }) => {
      const { data } = await api.post(`/notebooks/pages/${noteId}/comments`, payload)
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['note-comments', vars.noteId] }),
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, commentId }: { noteId: string; commentId: string }) => {
      await api.delete(`/notebooks/pages/${noteId}/comments/${commentId}`)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['note-comments', vars.noteId] }),
  })
}

export function useResolveComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, commentId }: { noteId: string; commentId: string }) => {
      const { data } = await api.post(`/notebooks/pages/${noteId}/comments/${commentId}/resolve`)
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['note-comments', vars.noteId] }),
  })
}

// ── Notes AI ───────────────────────────────────────────────────────────────

export interface ActionItem {
  type: string
  title: string
  assignee?: string
  due_date?: string
  priority: string
  erp_action?: string
}

export interface SuggestedLink {
  entity_type: string
  reference_text: string
  confidence: number
}

export interface AskResult {
  answer: string
  sources: Array<{ note_id: string; note_title: string; excerpt: string; score: number }>
}

export function useGenerateNoteContent() {
  return useMutation({
    mutationFn: async (payload: { prompt: string; include_erp_context?: boolean }): Promise<{ content: string }> => {
      const { data } = await api.post('/notes/ai/generate', { include_erp_context: true, ...payload })
      return data
    },
  })
}

export function useSummarizeContent() {
  return useMutation({
    mutationFn: async (payload: { content: string; style?: string }): Promise<{ content: string }> => {
      const { data } = await api.post('/notes/ai/summarize', { style: 'concise', ...payload })
      return data
    },
  })
}

export function useSummarizeNote() {
  return useMutation({
    mutationFn: async ({ noteId, style = 'concise' }: { noteId: string; style?: string }): Promise<{ content: string }> => {
      const { data } = await api.post(`/notes/ai/${noteId}/summarize`, null, { params: { style } })
      return data
    },
  })
}

export function useExtractActions() {
  return useMutation({
    mutationFn: async (payload: { content: string }): Promise<ActionItem[]> => {
      const { data } = await api.post('/notes/ai/extract-actions', payload)
      return data
    },
  })
}

export function useExtractNoteActions() {
  return useMutation({
    mutationFn: async (noteId: string): Promise<ActionItem[]> => {
      const { data } = await api.post(`/notes/ai/${noteId}/extract-actions`)
      return data
    },
  })
}

export function useTransformText() {
  return useMutation({
    mutationFn: async (payload: {
      text: string
      action: string
      tone?: string
      target_language?: string
    }): Promise<{ content: string }> => {
      const { data } = await api.post('/notes/ai/transform', payload)
      return data
    },
  })
}

export function useAskNotes() {
  return useMutation({
    mutationFn: async (payload: { question: string; notebook_id?: string }): Promise<AskResult> => {
      const { data } = await api.post('/notes/ai/ask', payload)
      return data
    },
  })
}

export function useSuggestLinks() {
  return useMutation({
    mutationFn: async (payload: { content: string }): Promise<SuggestedLink[]> => {
      const { data } = await api.post('/notes/ai/suggest-links', payload)
      return data
    },
  })
}

// ── ERP Widgets ────────────────────────────────────────────────────────────

export type ERPWidgetType = 'invoice' | 'project' | 'deal' | 'employee' | 'ticket'

export function useERPWidget(type: ERPWidgetType, entityId: string) {
  return useQuery({
    queryKey: ['erp-widget', type, entityId],
    queryFn: async () => {
      const { data } = await api.get(`/notes/widgets/${type}/${entityId}`)
      return data
    },
    enabled: !!entityId,
    staleTime: 60_000, // 1 min — widget data changes less frequently
  })
}
