/**
 * Notes Extended API client — folders, tags, templates, and per-note sharing management.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/notes`.
 *
 * Key exports:
 *   - useNoteFolders() — hierarchical folder tree for note organisation
 *   - useNoteTags() — list and manage tags across the notes workspace
 *   - useShareNoteExt() / useUnshareNote() — granular note sharing permissions
 *   - useNoteTemplates() — predefined note templates by category
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type { Note } from './notes'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoteTag {
  id: string
  name: string
  color: string
  note_count: number
}

export interface NoteShare {
  id: string
  note_id: string
  user_id: string
  user_name: string
  permission: 'view' | 'edit'
  created_at: string
}

export interface NoteTemplate {
  id: string
  name: string
  description: string | null
  content: string
  category: string | null
  created_at: string
  updated_at: string
}

export interface NoteFolder {
  id: string
  name: string
  parent_id: string | null
  color: string | null
  note_count: number
  created_at: string
  updated_at: string
}

export interface CreateNoteFolderPayload {
  name: string
  parent_id?: string
  color?: string
}

export interface UpdateNoteFolderPayload {
  id: string
  name?: string
  color?: string
}

export interface ShareNotePayload {
  note_id: string
  user_id: string
  permission?: 'view' | 'edit'
}

export interface CreateNoteTemplatePayload {
  name: string
  description?: string
  content: string
  category?: string
}

// ─── Folders ────────────────────────────────────────────────────────────────

export function useNoteFolders() {
  return useQuery({
    queryKey: ['notes', 'folders'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; folders: NoteFolder[] }>(
        '/notes/folders'
      )
      return data.folders
    },
  })
}

export function useCreateNoteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateNoteFolderPayload) => {
      const { data } = await apiClient.post<NoteFolder>('/notes/folders', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'folders'] }),
  })
}

export function useUpdateNoteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateNoteFolderPayload) => {
      const { data } = await apiClient.put<NoteFolder>(`/notes/folders/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'folders'] }),
  })
}

export function useDeleteNoteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notes/folders/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'folders'] }),
  })
}

// ─── Sharing ────────────────────────────────────────────────────────────────

export function useShareNoteExt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ note_id, ...payload }: ShareNotePayload) => {
      const { data } = await apiClient.post<NoteShare>(`/notes/${note_id}/share`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useUnshareNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, userId }: { noteId: string; userId: string }) => {
      await apiClient.delete(`/notes/${noteId}/share/${userId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export function useNoteTags() {
  return useQuery({
    queryKey: ['notes', 'tags'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ tags: NoteTag[] }>('/notes/tags')
      return data.tags
    },
  })
}

export function useAddNoteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, tag }: { noteId: string; tag: string }) => {
      const { data } = await apiClient.post(`/notes/${noteId}/tags`, { tag })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['notes', 'tags'] })
    },
  })
}

export function useRemoveNoteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, tag }: { noteId: string; tag: string }) => {
      await apiClient.delete(`/notes/${noteId}/tags/${tag}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['notes', 'tags'] })
    },
  })
}

// ─── Duplicate ──────────────────────────────────────────────────────────────

export function useDuplicateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (noteId: string) => {
      const { data } = await apiClient.post<Note>(`/notes/${noteId}/duplicate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

// ─── Export ─────────────────────────────────────────────────────────────────

export function useExportNote() {
  return useMutation({
    mutationFn: async ({ noteId, format }: { noteId: string; format: 'md' | 'html' | 'pdf' }) => {
      const { data } = await apiClient.get(`/notes/${noteId}/export`, {
        params: { format },
        responseType: 'blob',
      })
      return data as Blob
    },
  })
}

// ─── Search ─────────────────────────────────────────────────────────────────

export function useNoteSearch(query: string) {
  return useQuery({
    queryKey: ['notes', 'search', query],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; notes: Note[] }>('/notes/search', {
        params: { query },
      })
      return data
    },
    enabled: !!query,
  })
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function useNoteTemplates() {
  return useQuery({
    queryKey: ['notes', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; templates: NoteTemplate[] }>(
        '/notes/templates'
      )
      return data.templates
    },
  })
}

export function useCreateNoteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateNoteTemplatePayload) => {
      const { data } = await apiClient.post<NoteTemplate>('/notes/templates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'templates'] }),
  })
}

// ─── AI Summarize ───────────────────────────────────────────────────────────

export function useAISummarize() {
  return useMutation({
    mutationFn: async (noteId: string) => {
      const { data } = await apiClient.post<{ summary: string }>(`/notes/${noteId}/ai-summarize`)
      return data
    },
  })
}
