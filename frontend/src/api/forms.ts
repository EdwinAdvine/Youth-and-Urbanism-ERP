import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FormField {
  id: string
  form_id: string
  label: string
  field_type: 'text' | 'textarea' | 'number' | 'email' | 'select' | 'checkbox' | 'radio' | 'date' | 'file'
  options: string[] | null
  is_required: boolean
  order: number
  created_at: string
}

export interface Form {
  id: string
  title: string
  description: string
  is_published: boolean
  owner_id: string
  fields: FormField[]
  response_count: number
  created_at: string
  updated_at: string
}

export interface FormResponse {
  id: string
  form_id: string
  answers: Record<string, unknown>
  submitted_at: string
}

interface CreateFormPayload {
  title: string
  description?: string
}

interface UpdateFormPayload {
  title?: string
  description?: string
  is_published?: boolean
}

interface AddFieldPayload {
  form_id: string
  label: string
  field_type: FormField['field_type']
  options?: string[]
  is_required?: boolean
  order?: number
}

interface SubmitResponsePayload {
  form_id: string
  answers: Record<string, unknown>
}

// ─── API Functions ───────────────────────────────────────────────────────────

const formsApi = {
  list: () => apiClient.get<{ forms: Form[]; total: number }>('/forms/').then((r) => r.data.forms ?? []),
  get: (id: string) => apiClient.get<Form>(`/forms/${id}`).then((r) => r.data),
  create: (data: CreateFormPayload) => apiClient.post<Form>('/forms/', data).then((r) => r.data),
  update: (id: string, data: UpdateFormPayload) => apiClient.put<Form>(`/forms/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/forms/${id}`).then((r) => r.data),
  addField: (data: AddFieldPayload) =>
    apiClient.post<FormField>(`/forms/${data.form_id}/fields`, {
      fields: [{
        label: data.label,
        field_type: data.field_type,
        options: data.options,
        is_required: data.is_required ?? false,
        order: data.order ?? 0,
      }],
    }).then((r) => r.data),
  submitResponse: (data: SubmitResponsePayload) =>
    apiClient.post(`/forms/${data.form_id}/responses`, { answers: data.answers }).then((r) => r.data),
  getResponses: (id: string) =>
    apiClient.get<{ total: number; responses: FormResponse[] }>(`/forms/${id}/responses`).then((r) => r.data.responses ?? []),
  exportForm: (id: string) => apiClient.get(`/forms/${id}/export`).then((r) => r.data),
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

const keys = {
  all: ['forms'] as const,
  detail: (id: string) => ['forms', id] as const,
  responses: (id: string) => ['forms', id, 'responses'] as const,
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useForms() {
  return useQuery({ queryKey: keys.all, queryFn: formsApi.list })
}

export function useForm(id: string) {
  return useQuery({ queryKey: keys.detail(id), queryFn: () => formsApi.get(id), enabled: !!id })
}

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: formsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateFormPayload & { id: string }) => formsApi.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: keys.detail(vars.id) })
    },
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: formsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useAddField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: formsApi.addField,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.detail(vars.form_id) })
    },
  })
}

export function useSubmitResponse() {
  return useMutation({ mutationFn: formsApi.submitResponse })
}

export function useFormResponses(id: string) {
  return useQuery({
    queryKey: keys.responses(id),
    queryFn: () => formsApi.getResponses(id),
    enabled: !!id,
  })
}

export { formsApi }
