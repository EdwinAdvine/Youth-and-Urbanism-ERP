import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Note {
  id: string
  title: string
  content: string | null
  tags: string[]
  is_pinned: boolean
  shared_with: string[]
  is_shared: boolean
  created_at: string
  updated_at: string
}

export interface CreateNotePayload {
  title?: string
  content?: string
  tags?: string[]
  is_pinned?: boolean
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
  })
}
