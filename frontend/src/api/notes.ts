/**
 * Notes API client — Tiptap-based rich-text notes with pinning, tags, and sharing.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/notes`.
 *
 * Key exports:
 *   - useNotes() — list notes with optional pinned/tag filters
 *   - useCreateNote() — create a note (supports notebook/section/parent-page placement)
 *   - useShareNote() — share a note with specific user IDs
 *   - useLinkedItems() — fetch cross-module items linked to a note
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LIST_PRESET, DETAIL_PRESET } from '@/utils/queryDefaults'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoteLinkedItem {
  type: string
  id: string
  title: string
  module?: string
}

export interface Note {
  id: string
  title: string
  content: string | null
  tags: string[]
  is_pinned: boolean
  shared_with: string[]
  is_shared: boolean
  linked_items?: NoteLinkedItem[] | null
  created_at: string
  updated_at: string
}

export interface CreateNotePayload {
  title?: string
  content?: string
  tags?: string[]
  is_pinned?: boolean
  notebook_id?: string
  section_id?: string
  parent_page_id?: string
  content_format?: string
}

export interface UpdateNotePayload extends Partial<CreateNotePayload> {
  id: string
}

export interface ShareNotePayload {
  note_id: string
  user_ids: string[]
}

interface NotesResponse {
  total: number
  notes: Note[]
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useNotes(params?: { pinned?: boolean; tag?: string }) {
  return useQuery({
    queryKey: ['notes', params],
    queryFn: async () => {
      const { data } = await apiClient.get<NotesResponse>('/notes', { params })
      return data
    },
    ...LIST_PRESET,
  })
}

export function useNote(id: string) {
  return useQuery({
    queryKey: ['notes', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Note>(`/notes/${id}`)
      return data
    },
    enabled: !!id,
    ...DETAIL_PRESET,
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateNotePayload) => {
      const { data } = await apiClient.post<Note>('/notes', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateNotePayload) => {
      const { data } = await apiClient.put<Note>(`/notes/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notes/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useShareNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ note_id, user_ids }: ShareNotePayload) => {
      const { data } = await apiClient.post<Note>(`/notes/${note_id}/share`, { user_ids })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useSharedNotes() {
  return useQuery({
    queryKey: ['notes', 'shared'],
    queryFn: async () => {
      const { data } = await apiClient.get<NotesResponse>('/notes/shared-with-me')
      return data
    },
    ...LIST_PRESET,
  })
}

// ─── Linked Items ────────────────────────────────────────────────────────────

export interface LinkedItem {
  id: string
  type: string
  title: string
  module: string
}

export function useLinkedItems(noteId: string) {
  return useQuery({
    queryKey: ['notes', noteId, 'linked-items'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: LinkedItem[] }>(`/notes/${noteId}/links`)
      return data.items ?? []
    },
    enabled: !!noteId,
    ...LIST_PRESET,
  })
}

export function useLinkItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, item_type, item_id }: { noteId: string; item_type: string; item_id: string }) => {
      const { data } = await apiClient.post(`/notes/${noteId}/links`, { item_type, item_id })
      return data
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['notes', vars.noteId, 'linked-items'] }),
  })
}

export function useUnlinkItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, linkId }: { noteId: string; linkId: string }) => {
      await apiClient.delete(`/notes/${noteId}/links/${linkId}`)
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['notes', vars.noteId, 'linked-items'] }),
  })
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function useExportNote() {
  return useMutation({
    mutationFn: async ({ noteId, format }: { noteId: string; format: 'pdf' | 'markdown' | 'text' }) => {
      const { data } = await apiClient.post(`/notes/${noteId}/export`, { format }, { responseType: 'blob' })
      return data as Blob
    },
  })
}

// ─── Cross-Module: Notes → Drive (attach file) ─────────────────────────────

export function useAttachFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, fileId, fileName }: { noteId: string; fileId: string; fileName?: string }) => {
      const { data } = await apiClient.post(`/notes/notes/${noteId}/attach-file`, {
        file_id: fileId,
        file_name: fileName,
      })
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['notes', vars.noteId, 'linked-items'] })
      qc.invalidateQueries({ queryKey: ['notes', vars.noteId] })
    },
  })
}

// ─── Cross-Module: Notes → Calendar (create event) ─────────────────────────

export function useCreateEventFromNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, startTime, endTime, eventType }: {
      noteId: string
      startTime: string
      endTime?: string
      eventType?: string
    }) => {
      const { data } = await apiClient.post(`/notes/notes/${noteId}/create-event`, {
        start_time: startTime,
        end_time: endTime,
        event_type: eventType ?? 'reminder',
      })
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['notes', vars.noteId, 'linked-items'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

// ─── Cross-Module: Notes → Mail (email note) ───────────────────────────────

export function useEmailNote() {
  return useMutation({
    mutationFn: async ({ noteId, to, subject }: { noteId: string; to: string[]; subject?: string }) => {
      const { data } = await apiClient.post(`/notes/notes/${noteId}/email`, {
        to,
        subject,
      })
      return data
    },
  })
}

// ─── Cross-Module: Notes → Projects (link to task) ─────────────────────────

export function useLinkNoteToTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, taskId, projectId }: { noteId: string; taskId: string; projectId: string }) => {
      const { data } = await apiClient.post(`/notes/notes/${noteId}/link-task`, {
        task_id: taskId,
        project_id: projectId,
      })
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['notes', vars.noteId, 'linked-items'] })
    },
  })
}
