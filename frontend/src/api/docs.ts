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
