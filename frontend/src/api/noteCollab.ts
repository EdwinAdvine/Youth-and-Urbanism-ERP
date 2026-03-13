/**
 * Note Collaboration API client — inline comments, version history, and live presence.
 *
 * Exports TanStack Query hooks and Axios helper functions. Calls
 * `/api/v1/collab/*` directly via its own Axios instance (no shared client.ts).
 * Backend prefix: `/api/v1/collab`.
 *
 * Key exports:
 *   - useNoteComments() / useCreateComment() — threaded inline comments per note
 *   - useResolveComment() — mark a comment thread as resolved
 *   - useNoteVersions() / useRestoreVersion() — snapshot-based version history
 *   - useNotePresence() — real-time list of users currently viewing a note
 */
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface NoteComment {
  id: string
  note_id: string
  parent_comment_id: string | null
  author_id: string
  author_name: string
  content: string
  anchor_block_id: string | null
  anchor_text: string | null
  is_resolved: boolean
  created_at: string
  updated_at: string
}

export interface NoteVersion {
  id: string
  note_id: string
  version_number: number
  label: string | null
  word_count: number
  created_by_id: string | null
  created_by_name: string | null
  created_at: string
}

export interface PresenceUser {
  user_id: string
  conn_id: string
}

// --- Comments ---

export function useNoteComments(noteId: string) {
  return useQuery({
    queryKey: ['note-comments', noteId],
    queryFn: async () => {
      const { data } = await axios.get<NoteComment[]>(`/api/v1/collab/comments/${noteId}`)
      return data
    },
    enabled: !!noteId,
    staleTime: 10_000,
  })
}

export function useCreateComment(noteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { content: string; parent_comment_id?: string; anchor_block_id?: string; anchor_text?: string }) => {
      const { data } = await axios.post<NoteComment>(`/api/v1/collab/comments/${noteId}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note-comments', noteId] }),
  })
}

export function useResolveComment(noteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      await axios.patch(`/api/v1/collab/comments/${noteId}/${commentId}/resolve`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note-comments', noteId] }),
  })
}

export function useDeleteComment(noteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      await axios.delete(`/api/v1/collab/comments/${noteId}/${commentId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note-comments', noteId] }),
  })
}

// --- Versions ---

export function useNoteVersions(noteId: string) {
  return useQuery({
    queryKey: ['note-versions', noteId],
    queryFn: async () => {
      const { data } = await axios.get<NoteVersion[]>(`/api/v1/collab/versions/${noteId}`)
      return data
    },
    enabled: !!noteId,
    staleTime: 30_000,
  })
}

export function useCreateVersion(noteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (label?: string) => {
      const { data } = await axios.post<NoteVersion>(`/api/v1/collab/versions/${noteId}`, { label })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note-versions', noteId] }),
  })
}

export function useRestoreVersion(noteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (versionId: string) => {
      await axios.post(`/api/v1/collab/versions/${noteId}/${versionId}/restore`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['note-versions', noteId] })
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// --- Presence ---

export function useNotePresence(noteId: string) {
  return useQuery({
    queryKey: ['note-presence', noteId],
    queryFn: async () => {
      const { data } = await axios.get<{ note_id: string; active_users: PresenceUser[]; count: number }>(
        `/api/v1/collab/presence/${noteId}`
      )
      return data
    },
    enabled: !!noteId,
    refetchInterval: 15_000,
  })
}
