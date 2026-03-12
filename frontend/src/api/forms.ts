import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ───────────────────────────────────────────────────────────────────

export type FieldType =
  // Basic
  | 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'url'
  | 'date' | 'time' | 'datetime'
  // Choice
  | 'select' | 'checkbox' | 'radio' | 'dropdown'
  | 'cascading_select' | 'ranking'
  // Scale & Rating
  | 'rating' | 'likert' | 'nps' | 'slider'
  // Matrix
  | 'matrix'
  // Media & Files
  | 'file' | 'photo' | 'video' | 'audio' | 'signature'
  // Location & Scanning
  | 'gps' | 'barcode'
  // Layout
  | 'section_header' | 'description' | 'page_break'
  // Computed
  | 'calculated'
  // ERP-native
  | 'employee_picker' | 'product_picker' | 'customer_picker'
  | 'gl_account_picker' | 'warehouse_picker'

export interface FieldOption {
  id: string
  field_id: string
  label: string
  value: string
  order: number
  parent_option_id: string | null
  score: number | null
  is_correct: boolean
}

export interface FormField {
  id: string
  form_id: string
  label: string
  field_type: FieldType
  options: string[] | null
  is_required: boolean
  order: number
  page_number: number
  description: string | null
  placeholder: string | null
  metadata: Record<string, unknown> | null
  validation_rules: Record<string, unknown> | null
  field_options: FieldOption[]
  created_at: string
}

export interface Form {
  id: string
  title: string
  description: string
  is_published: boolean
  is_template: boolean
  owner_id: string
  fields: FormField[]
  settings: Record<string, unknown> | null
  response_count: number
  created_at: string
  updated_at: string
}

export interface FormResponse {
  id: string
  form_id: string
  respondent_id: string | null
  answers: Record<string, unknown>
  submitted_at: string
  is_sandbox: boolean
}

export interface FormVersion {
  id: string
  form_id: string
  version_number: number
  schema_snapshot: Record<string, unknown>
  published_at: string
  created_by: string | null
}

export interface FormWebhook {
  id: string
  form_id: string
  url: string
  events: string[]
  is_active: boolean
}

export interface AuditLogEntry {
  id: string
  form_id: string
  user_id: string | null
  action: string
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

interface CreateFormPayload {
  title: string
  description?: string
  settings?: Record<string, unknown>
  fields?: {
    label: string
    field_type: FieldType
    options?: string[]
    is_required?: boolean
    order?: number
    page_number?: number
    description?: string
    placeholder?: string
    metadata?: Record<string, unknown>
    validation_rules?: Record<string, unknown>
  }[]
}

interface UpdateFormPayload {
  title?: string
  description?: string
  is_published?: boolean
  settings?: Record<string, unknown>
}

interface BulkFieldsPayload {
  form_id: string
  fields: {
    label: string
    field_type: FieldType
    options?: string[]
    is_required?: boolean
    order?: number
    page_number?: number
    description?: string
    placeholder?: string
    metadata?: Record<string, unknown>
    validation_rules?: Record<string, unknown>
  }[]
}

interface SubmitResponsePayload {
  form_id: string
  answers: Record<string, unknown>
  is_sandbox?: boolean
}

// ─── API Functions ───────────────────────────────────────────────────────────

const formsApi = {
  list: () => apiClient.get<{ forms: Form[]; total: number }>('/forms/').then((r) => r.data.forms ?? []),
  get: (id: string) => apiClient.get<Form>(`/forms/${id}`).then((r) => r.data),
  create: (data: CreateFormPayload) => apiClient.post<Form>('/forms/', data).then((r) => r.data),
  update: (id: string, data: UpdateFormPayload) => apiClient.put<Form>(`/forms/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/forms/${id}`).then((r) => r.data),
  bulkUpdateFields: (data: BulkFieldsPayload) =>
    apiClient.post<Form>(`/forms/${data.form_id}/fields`, { fields: data.fields }).then((r) => r.data),
  submitResponse: (data: SubmitResponsePayload) =>
    apiClient.post(`/forms/${data.form_id}/responses`, {
      answers: data.answers,
      is_sandbox: data.is_sandbox ?? false,
    }).then((r) => r.data),
  getResponses: (id: string, includeSandbox = false) =>
    apiClient.get<{ total: number; responses: FormResponse[] }>(
      `/forms/${id}/responses?include_sandbox=${includeSandbox}`
    ).then((r) => r.data.responses ?? []),
  exportForm: (id: string, format = 'json') =>
    apiClient.get(`/forms/${id}/export?format=${format}`).then((r) => r.data),

  // Version History
  getVersions: (formId: string) =>
    apiClient.get<{ total: number; versions: FormVersion[] }>(`/forms/${formId}/versions`).then((r) => r.data.versions ?? []),
  createVersion: (formId: string) =>
    apiClient.post<FormVersion>(`/forms/${formId}/versions`).then((r) => r.data),
  restoreVersion: (formId: string, versionId: string) =>
    apiClient.post(`/forms/${formId}/restore/${versionId}`).then((r) => r.data),

  // Webhooks
  getWebhooks: (formId: string) =>
    apiClient.get<{ total: number; webhooks: FormWebhook[] }>(`/forms/${formId}/webhooks`).then((r) => r.data.webhooks ?? []),
  createWebhook: (formId: string, data: { url: string; secret?: string; events?: string[] }) =>
    apiClient.post<FormWebhook>(`/forms/${formId}/webhooks`, data).then((r) => r.data),
  deleteWebhook: (formId: string, webhookId: string) =>
    apiClient.delete(`/forms/${formId}/webhooks/${webhookId}`).then((r) => r.data),

  // Logic & Theme
  saveLogicRules: (formId: string, rules: Record<string, unknown>[]) =>
    apiClient.put(`/forms/${formId}/logic-rules`, { logic_rules: rules }).then((r) => r.data),
  saveTheme: (formId: string, theme: Record<string, unknown>) =>
    apiClient.put(`/forms/${formId}/theme`, { theme }).then((r) => r.data),

  // Audit Log
  getAuditLog: (formId: string) =>
    apiClient.get<{ total: number; audit_logs: AuditLogEntry[] }>(`/forms/${formId}/audit-log`).then((r) => r.data.audit_logs ?? []),

  // AI Generation
  aiGenerate: (data: { description: string; max_fields?: number; include_erp_fields?: boolean }) =>
    apiClient.post<{ id: string; title: string; field_count: number; ai_generated: boolean }>(
      '/forms/ai-generate', data
    ).then((r) => r.data),

  // ERP Integrations
  createInvoice: (formId: string, data: { response_id: string; invoice_type?: string; due_days?: number }) =>
    apiClient.post(`/forms/${formId}/create-invoice-from-response`, data).then((r) => r.data),
  createTicket: (formId: string, data: { response_id: string; priority?: string; category?: string }) =>
    apiClient.post(`/forms/${formId}/create-ticket-from-response`, data).then((r) => r.data),
  createEvent: (formId: string, data: { response_id: string; start_time: string; end_time: string; location?: string }) =>
    apiClient.post(`/forms/${formId}/create-event-from-response`, data).then((r) => r.data),
  createLeaveRequest: (formId: string, data: { response_id: string; employee_id: string; leave_type?: string; start_date: string; end_date: string }) =>
    apiClient.post(`/forms/${formId}/create-leave-request`, data).then((r) => r.data),
  createPO: (formId: string, data: { response_id: string; supplier_name: string }) =>
    apiClient.post(`/forms/${formId}/create-po-from-response`, data).then((r) => r.data),
  createTask: (formId: string, data: { response_id: string; project_id: string; title?: string; priority?: string; assignee_id?: string }) =>
    apiClient.post(`/forms/${formId}/create-task-from-response`, data).then((r) => r.data),
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

const keys = {
  all: ['forms'] as const,
  detail: (id: string) => ['forms', id] as const,
  responses: (id: string) => ['forms', id, 'responses'] as const,
  versions: (id: string) => ['forms', id, 'versions'] as const,
  webhooks: (id: string) => ['forms', id, 'webhooks'] as const,
  auditLog: (id: string) => ['forms', id, 'audit-log'] as const,
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
    mutationFn: ({ form_id, ...data }: { form_id: string; label: string; field_type: string; is_required?: boolean; order?: number; options?: string[] }) =>
      apiClient.post(`/forms/${form_id}/fields/add`, data).then((r) => r.data),
    onSuccess: (_data, vars) => { qc.invalidateQueries({ queryKey: ['form', vars.form_id] }) },
  })
}

export function useBulkUpdateFields() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: formsApi.bulkUpdateFields,
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

// Version History
export function useFormVersions(formId: string) {
  return useQuery({
    queryKey: keys.versions(formId),
    queryFn: () => formsApi.getVersions(formId),
    enabled: !!formId,
  })
}

export function useCreateVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) => formsApi.createVersion(formId),
    onSuccess: (_data, formId) => qc.invalidateQueries({ queryKey: keys.versions(formId) }),
  })
}

export function useRestoreVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, versionId }: { formId: string; versionId: string }) =>
      formsApi.restoreVersion(formId, versionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.detail(vars.formId) })
      qc.invalidateQueries({ queryKey: keys.versions(vars.formId) })
    },
  })
}

// Webhooks
export function useFormWebhooks(formId: string) {
  return useQuery({
    queryKey: keys.webhooks(formId),
    queryFn: () => formsApi.getWebhooks(formId),
    enabled: !!formId,
  })
}

export function useCreateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; url: string; secret?: string; events?: string[] }) =>
      formsApi.createWebhook(formId, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.webhooks(vars.formId) }),
  })
}

export function useDeleteWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, webhookId }: { formId: string; webhookId: string }) =>
      formsApi.deleteWebhook(formId, webhookId),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.webhooks(vars.formId) }),
  })
}

// Logic & Theme
export function useSaveLogicRules() {
  return useMutation({
    mutationFn: ({ formId, rules }: { formId: string; rules: Record<string, unknown>[] }) =>
      formsApi.saveLogicRules(formId, rules),
  })
}

export function useSaveTheme() {
  return useMutation({
    mutationFn: ({ formId, theme }: { formId: string; theme: Record<string, unknown> }) =>
      formsApi.saveTheme(formId, theme),
  })
}

// Audit Log
export function useFormAuditLog(formId: string) {
  return useQuery({
    queryKey: keys.auditLog(formId),
    queryFn: () => formsApi.getAuditLog(formId),
    enabled: !!formId,
  })
}

// AI Generation
export function useAIGenerateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: formsApi.aiGenerate,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

// ERP Integration Hooks
export function useCreateInvoiceFromResponse() {
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; response_id: string; invoice_type?: string; due_days?: number }) =>
      formsApi.createInvoice(formId, data),
  })
}

export function useCreateTicketFromResponse() {
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; response_id: string; priority?: string; category?: string }) =>
      formsApi.createTicket(formId, data),
  })
}

export function useCreateEventFromResponse() {
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; response_id: string; start_time: string; end_time: string; location?: string }) =>
      formsApi.createEvent(formId, data),
  })
}

export function useCreateLeaveFromResponse() {
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; response_id: string; employee_id: string; leave_type?: string; start_date: string; end_date: string }) =>
      formsApi.createLeaveRequest(formId, data),
  })
}

export function useCreatePOFromResponse() {
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; response_id: string; supplier_name: string }) =>
      formsApi.createPO(formId, data),
  })
}

export function useCreateTaskFromResponse() {
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; response_id: string; project_id: string; title?: string; priority?: string; assignee_id?: string }) =>
      formsApi.createTask(formId, data),
  })
}

export { formsApi }
