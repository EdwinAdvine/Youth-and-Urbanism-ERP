/**
 * API hooks for Y&U Notes — Notion-style Databases.
 * Databases, Properties, Views, Rows, ERP import.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// ── Types ──────────────────────────────────────────────────────────────────

export type PropertyType =
  | 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox'
  | 'url' | 'email' | 'phone' | 'person' | 'file' | 'relation' | 'rollup'
  | 'formula' | 'status' | 'created_time' | 'last_edited_time'

export type ViewType = 'table' | 'kanban' | 'calendar' | 'gallery' | 'list' | 'timeline'

export interface DatabaseProperty {
  id: string
  database_id: string
  name: string
  property_type: PropertyType
  config?: Record<string, any>
  sort_order: number
  is_visible: boolean
  width: number
}

export interface DatabaseView {
  id: string
  database_id: string
  name: string
  view_type: ViewType
  config?: Record<string, any>
  is_default: boolean
  sort_order: number
}

export interface DatabaseRow {
  id: string
  database_id: string
  page_id?: string
  values: Record<string, any>
  sort_order: number
  created_at: string
  updated_at: string
}

export interface NoteDatabase {
  id: string
  title: string
  description?: string
  owner_id: string
  notebook_id?: string
  page_id?: string
  icon?: string
  is_shared: boolean
  is_archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
  properties?: DatabaseProperty[]
  views?: DatabaseView[]
}

// ── Databases ─────────────────────────────────────────────────────────────

export function useDatabases(notebookId?: string) {
  return useQuery({
    queryKey: ['note-databases', notebookId],
    queryFn: async () => {
      const { data } = await api.get('/note-databases', {
        params: notebookId ? { notebook_id: notebookId } : undefined,
      })
      return data as NoteDatabase[]
    },
  })
}

export function useDatabase(id: string) {
  return useQuery({
    queryKey: ['note-database', id],
    queryFn: async () => {
      const { data } = await api.get(`/note-databases/${id}`)
      return data as NoteDatabase
    },
    enabled: !!id,
  })
}

export function useCreateDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { title: string; notebook_id?: string; page_id?: string; icon?: string; description?: string }) => {
      const { data } = await api.post('/note-databases', payload)
      return data as NoteDatabase
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note-databases'] }),
  })
}

export function useUpdateDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; title?: string; description?: string; icon?: string; is_archived?: boolean }) => {
      const { data } = await api.put(`/note-databases/${id}`, payload)
      return data as NoteDatabase
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['note-databases'] })
      qc.invalidateQueries({ queryKey: ['note-database', v.id] })
    },
  })
}

export function useDeleteDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/note-databases/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note-databases'] }),
  })
}

// ── Properties ────────────────────────────────────────────────────────────

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, ...payload }: {
      dbId: string; name: string; property_type: PropertyType; config?: Record<string, any>
    }) => {
      const { data } = await api.post(`/note-databases/${dbId}/properties`, payload)
      return data as DatabaseProperty
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['note-database', v.dbId] }),
  })
}

export function useUpdateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, propId, ...payload }: {
      dbId: string; propId: string; name?: string; config?: Record<string, any>; is_visible?: boolean; width?: number
    }) => {
      const { data } = await api.put(`/note-databases/${dbId}/properties/${propId}`, payload)
      return data
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['note-database', v.dbId] }),
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, propId }: { dbId: string; propId: string }) => {
      await api.delete(`/note-databases/${dbId}/properties/${propId}`)
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['note-database', v.dbId] }),
  })
}

// ── Views ─────────────────────────────────────────────────────────────────

export function useCreateView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, ...payload }: { dbId: string; name: string; view_type: ViewType }) => {
      const { data } = await api.post(`/note-databases/${dbId}/views`, payload)
      return data as DatabaseView
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['note-database', v.dbId] }),
  })
}

export function useUpdateView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, viewId, ...payload }: {
      dbId: string; viewId: string; name?: string; config?: Record<string, any>; is_default?: boolean
    }) => {
      const { data } = await api.put(`/note-databases/${dbId}/views/${viewId}`, payload)
      return data
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['note-database', v.dbId] }),
  })
}

export function useDeleteView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, viewId }: { dbId: string; viewId: string }) => {
      await api.delete(`/note-databases/${dbId}/views/${viewId}`)
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['note-database', v.dbId] }),
  })
}

// ── Rows ─────────────────────────────────────────────────────────────────

export function useDatabaseRows(dbId: string, viewId?: string) {
  return useQuery({
    queryKey: ['db-rows', dbId, viewId],
    queryFn: async () => {
      const { data } = await api.get(`/note-databases/${dbId}/rows`, {
        params: viewId ? { view_id: viewId } : undefined,
      })
      return data as DatabaseRow[]
    },
    enabled: !!dbId,
  })
}

export function useCreateRow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, values = {} }: { dbId: string; values?: Record<string, any> }) => {
      const { data } = await api.post(`/note-databases/${dbId}/rows`, { values })
      return data as DatabaseRow
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['db-rows', v.dbId] }),
  })
}

export function useUpdateRow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, rowId, values }: { dbId: string; rowId: string; values: Record<string, any> }) => {
      const { data } = await api.put(`/note-databases/${dbId}/rows/${rowId}`, { values })
      return data as DatabaseRow
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['db-rows', v.dbId] }),
  })
}

export function useDeleteRow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, rowId }: { dbId: string; rowId: string }) => {
      await api.delete(`/note-databases/${dbId}/rows/${rowId}`)
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['db-rows', v.dbId] }),
  })
}

export function useImportFromERP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dbId, source, filters }: { dbId: string; source: string; filters?: Record<string, any> }) => {
      const { data } = await api.post(`/note-databases/${dbId}/import-erp`, { source, filters })
      return data as { imported: number }
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['db-rows', v.dbId] }),
  })
}

// ── Note conversion ────────────────────────────────────────────────────────

export function useConvertNote() {
  return useMutation({
    mutationFn: async ({ noteId, target, payload }: {
      noteId: string
      target: 'task' | 'ticket' | 'invoice' | 'event' | 'deal'
      payload: Record<string, any>
    }) => {
      const { data } = await api.post(`/notes/convert/${noteId}/${target}`, payload)
      return data
    },
  })
}

// ── Semantic search ────────────────────────────────────────────────────────

export interface SemanticSearchResult {
  note_id: string
  note_title: string
  excerpt: string
  score: number
  notebook_id?: string
}

export function useSemanticSearch() {
  return useMutation({
    mutationFn: async (payload: { q: string; limit?: number; notebook_id?: string }): Promise<SemanticSearchResult[]> => {
      const { data } = await api.get('/notes/search/semantic', { params: payload })
      return data
    },
  })
}
