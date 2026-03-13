/**
 * AI Extended API client — prompt templates, knowledge bases, and usage statistics.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/ai`.
 *
 * Key exports:
 *   - usePromptTemplates()       — list saved AI prompt templates (public + personal)
 *   - useCreatePromptTemplate()  — create a reusable named prompt with variable slots
 *   - useUpdatePromptTemplate()  — update template content or visibility
 *   - useDeletePromptTemplate()  — remove a prompt template
 *   - useKnowledgeBases()        — list RAG knowledge bases and their indexing status
 *   - useCreateKnowledgeBase()   — create a new knowledge base and trigger indexing
 *   - useAIUsageStats()          — token usage, model call counts, and cost estimates
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIPromptTemplate {
  id: string
  name: string
  description: string | null
  prompt: string
  category: string | null
  variables: string[]
  is_public: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface AIKnowledgeBase {
  id: string
  name: string
  description: string | null
  document_count: number
  total_chunks: number
  status: 'active' | 'indexing' | 'error'
  created_at: string
  updated_at: string
}

export interface AIUsageStats {
  total_tokens: number
  total_requests: number
  tokens_by_day: { date: string; tokens: number; requests: number }[]
  tokens_by_model: { model: string; tokens: number; requests: number }[]
  tokens_by_tool: { tool: string; tokens: number; requests: number }[]
  period_start: string
  period_end: string
}

export interface AIConversation {
  id: string
  session_id: string
  title: string | null
  message_count: number
  last_message: string | null
  created_at: string
  updated_at: string
}

export interface AIConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tokens_used: number | null
  model: string | null
  timestamp: string
}

export interface CreatePromptTemplatePayload {
  name: string
  description?: string
  prompt: string
  category?: string
  variables?: string[]
  is_public?: boolean
}

export interface UpdatePromptTemplatePayload {
  id: string
  name?: string
  description?: string
  prompt?: string
  category?: string
  variables?: string[]
  is_public?: boolean
}

export interface CreateKnowledgeBasePayload {
  name: string
  description?: string
}

// ─── Prompt Templates ───────────────────────────────────────────────────────

export function useAITemplates() {
  return useQuery({
    queryKey: ['ai', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; templates: AIPromptTemplate[] }>(
        '/ai/templates'
      )
      return data.templates
    },
  })
}

export function useCreateAITemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePromptTemplatePayload) => {
      const { data } = await apiClient.post<AIPromptTemplate>('/ai/templates', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'templates'] }),
  })
}

export function useUpdateAITemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePromptTemplatePayload) => {
      const { data } = await apiClient.put<AIPromptTemplate>(`/ai/templates/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'templates'] }),
  })
}

export function useDeleteAITemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/ai/templates/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'templates'] }),
  })
}

// ─── Knowledge Bases ────────────────────────────────────────────────────────

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ['ai', 'knowledge-bases'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; knowledge_bases: AIKnowledgeBase[] }>(
        '/ai/knowledge-bases'
      )
      return data.knowledge_bases
    },
  })
}

export function useCreateKnowledgeBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateKnowledgeBasePayload) => {
      const { data } = await apiClient.post<AIKnowledgeBase>('/ai/knowledge-bases', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'knowledge-bases'] }),
  })
}

export function useDeleteKnowledgeBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/ai/knowledge-bases/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'knowledge-bases'] }),
  })
}

export function useUploadToKB() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ kbId, file }: { kbId: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      const { data } = await apiClient.post(`/ai/knowledge-bases/${kbId}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'knowledge-bases'] }),
  })
}

// ─── Usage Stats ────────────────────────────────────────────────────────────

export function useAIUsage(params?: { period?: string }) {
  return useQuery({
    queryKey: ['ai', 'usage', params],
    queryFn: async () => {
      const { data } = await apiClient.get<AIUsageStats>('/ai/usage', { params })
      return data
    },
  })
}

// ─── Conversations ──────────────────────────────────────────────────────────

export function useAIConversations(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['ai', 'conversations', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        total: number
        conversations: AIConversation[]
      }>('/ai/conversations', { params })
      return data
    },
  })
}

export function useAIConversationMessages(conversationId: string) {
  return useQuery({
    queryKey: ['ai', 'conversations', conversationId, 'messages'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ messages: AIConversationMessage[] }>(
        `/ai/conversations/${conversationId}/messages`
      )
      return data.messages
    },
    enabled: !!conversationId,
  })
}
