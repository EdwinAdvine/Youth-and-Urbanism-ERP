/**
 * Forms Extended API client — templates, collaborators, analytics, and conditional logic.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/forms`.
 *
 * Key exports:
 *   - useFormTemplates()        — list available form templates by category
 *   - useCreateFromTemplate()   — instantiate a new form from a template
 *   - useFormCollaborators()    — manage per-form collaborator access
 *   - useFormAnalytics()        — response rates and completion stats for a form
 *   - useFormConditionalLogic() — fetch/update conditional field-visibility rules
 *   - useFormWebhooks()         — configure outbound webhooks on form submission
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type { Form } from './forms'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  fields_config: Record<string, unknown>[]
  created_at: string
  updated_at: string
}

export interface FormCollaborator {
  id: string
  form_id: string
  user_id: string
  user_name: string
  permission: 'view' | 'edit' | 'admin'
  created_at: string
}

export interface FormAnalytics {
  form_id: string
  form_title: string
  total_responses: number
  response_rate: number
  avg_completion_time_seconds: number
  responses_by_day: { date: string; count: number }[]
  field_summaries: FieldSummary[]
}

export interface FieldSummary {
  field_id: string
  label: string
  field_type: string
  response_count: number
  values: Record<string, number>
  average?: number
  min?: number
  max?: number
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export function useFormAnalytics(formId: string) {
  return useQuery({
    queryKey: ['forms', formId, 'analytics'],
    queryFn: async () => {
      const { data } = await apiClient.get<FormAnalytics>(`/forms/${formId}/analytics`)
      return data
    },
    enabled: !!formId,
  })
}

// ─── Duplicate ──────────────────────────────────────────────────────────────

export function useDuplicateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formId: string) => {
      const { data } = await apiClient.post<Form>(`/forms/${formId}/duplicate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  })
}

// ─── Publish (uses toggle-publish endpoint which auto-creates version snapshot) ─

export function usePublishForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ formId, is_published }: { formId: string; is_published: boolean }) => {
      const { data } = await apiClient.post<Form>(`/forms/${formId}/toggle-publish`, { is_published })
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['forms'] })
      qc.invalidateQueries({ queryKey: ['forms', vars.formId, 'versions'] })
      qc.invalidateQueries({ queryKey: ['forms', vars.formId, 'audit-log'] })
    },
  })
}

// ─── Share ──────────────────────────────────────────────────────────────────

export function useShareForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      formId,
      user_id,
      permission,
    }: {
      formId: string
      user_id: string
      permission?: string
    }) => {
      const { data } = await apiClient.post<FormCollaborator>(`/forms/${formId}/share`, {
        user_id,
        permission,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  })
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function useFormTemplates() {
  return useQuery({
    queryKey: ['forms', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; templates: FormTemplate[] }>(
        '/forms/templates'
      )
      return data.templates
    },
  })
}

export function useCreateFromTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { template_id: string; title: string }) => {
      const { data } = await apiClient.post<Form>('/forms/from-template', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  })
}
