/**
 * Forms API client — drag-and-drop form builder (forms, fields, responses).
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/forms`.
 *
 * Key exports:
 *   - useForms()           — list all forms for the current user
 *   - useForm()            — fetch a single form with its fields
 *   - useCreateForm()      — create a new form definition
 *   - useUpdateForm()      — update form metadata or field schema
 *   - useDeleteForm()      — permanently delete a form
 *   - useFormResponses()   — retrieve paginated submissions for a form
 *   - useSubmitForm()      — public endpoint to submit a form response
 */
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
  quizResults: (id: string) => ['forms', id, 'quiz-results'] as const,
  schedule: (id: string) => ['forms', id, 'schedule'] as const,
  approvalWorkflow: (id: string) => ['forms', id, 'approval-workflow'] as const,
  approvalQueue: (id: string) => ['forms', id, 'approval-queue'] as const,
  translations: (id: string) => ['forms', id, 'translations'] as const,
  consent: (id: string) => ['forms', id, 'consent'] as const,
  automations: (id: string) => ['forms', id, 'automations'] as const,
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

// ─── Phase 2: Offline Sync ───────────────────────────────────────────────────

export function useSaveDraft() {
  return useMutation({
    mutationFn: ({ formId, answers, deviceId, offlineCreatedAt }: { formId: string; answers: Record<string, unknown>; deviceId?: string; offlineCreatedAt?: string }) =>
      apiClient.post(`/forms/${formId}/responses/draft`, { answers, device_id: deviceId, offline_created_at: offlineCreatedAt }).then((r) => r.data),
  })
}

export function useBulkSyncDrafts() {
  return useMutation({
    mutationFn: ({ formId, drafts }: { formId: string; drafts: { answers: Record<string, unknown>; device_id?: string; offline_created_at?: string }[] }) =>
      apiClient.post(`/forms/${formId}/responses/bulk-sync`, { drafts }).then((r) => r.data),
  })
}

// ─── Phase 2: Quiz ───────────────────────────────────────────────────────────

export function useQuizResults(formId: string) {
  return useQuery({
    queryKey: keys.quizResults(formId),
    queryFn: () => apiClient.get(`/forms/${formId}/quiz-results`).then((r) => r.data),
    enabled: !!formId,
  })
}

export function useGradeQuizResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, responseId, overrideScore }: { formId: string; responseId: string; overrideScore?: number }) =>
      apiClient.post(`/forms/${formId}/quiz-results/grade`, { response_id: responseId, override_score: overrideScore }).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.quizResults(vars.formId) }),
  })
}

// ─── Phase 2: Schedule ───────────────────────────────────────────────────────

export function useFormSchedule(formId: string) {
  return useQuery({
    queryKey: keys.schedule(formId),
    queryFn: () => apiClient.get(`/forms/${formId}/schedule`).then((r) => r.data),
    enabled: !!formId,
  })
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; recurrence_rule?: string; recipients?: string[]; distribution_channel?: string; is_active?: boolean }) =>
      apiClient.post(`/forms/${formId}/schedule`, data).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.schedule(vars.formId) }),
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) => apiClient.delete(`/forms/${formId}/schedule`).then((r) => r.data),
    onSuccess: (_data, formId) => qc.invalidateQueries({ queryKey: keys.schedule(formId) }),
  })
}

// ─── Phase 2: AI Analysis ────────────────────────────────────────────────────

export function useAIAnalyzeResponses() {
  return useMutation({
    mutationFn: (formId: string) => apiClient.post(`/forms/${formId}/ai-analyze-responses`).then((r) => r.data),
  })
}

// ─── Phase 3: Approval Workflow ──────────────────────────────────────────────

export function useApprovalWorkflow(formId: string) {
  return useQuery({
    queryKey: keys.approvalWorkflow(formId),
    queryFn: () => apiClient.get(`/forms/${formId}/approval-workflow`).then((r) => r.data),
    enabled: !!formId,
  })
}

export function useCreateApprovalWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, steps }: { formId: string; steps: Record<string, unknown>[] }) =>
      apiClient.post(`/forms/${formId}/approval-workflow`, { steps }).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.approvalWorkflow(vars.formId) }),
  })
}

export function useApprovalQueue(formId: string) {
  return useQuery({
    queryKey: keys.approvalQueue(formId),
    queryFn: () => apiClient.get(`/forms/${formId}/approval-queue`).then((r) => r.data),
    enabled: !!formId,
  })
}

export function useApproveResponse() {
  return useMutation({
    mutationFn: ({ responseId, status, comments }: { responseId: string; status: 'approved' | 'rejected'; comments?: string }) =>
      apiClient.post(`/forms/responses/${responseId}/approve`, { status, comments }).then((r) => r.data),
  })
}

// ─── Phase 3: Translations ───────────────────────────────────────────────────

export function useFormTranslations(formId: string) {
  return useQuery({
    queryKey: keys.translations(formId),
    queryFn: () => apiClient.get(`/forms/${formId}/translations`).then((r) => r.data),
    enabled: !!formId,
  })
}

export function useCreateTranslation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, locale, translations }: { formId: string; locale: string; translations: Record<string, unknown> }) =>
      apiClient.post(`/forms/${formId}/translations`, { locale, translations }).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.translations(vars.formId) }),
  })
}

export function useAIGenerateTranslation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, locale }: { formId: string; locale: string }) =>
      apiClient.post(`/forms/${formId}/translations/ai-generate?locale=${locale}`).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.translations(vars.formId) }),
  })
}

// ─── Phase 3: Consent ────────────────────────────────────────────────────────

export function useFormConsent(formId: string) {
  return useQuery({
    queryKey: keys.consent(formId),
    queryFn: () => apiClient.get(`/forms/${formId}/consent`).then((r) => r.data),
    enabled: !!formId,
  })
}

export function useConfigureConsent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; consent_text?: string; is_required?: boolean; data_retention_days?: number; privacy_policy_url?: string }) =>
      apiClient.post(`/forms/${formId}/consent`, data).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.consent(vars.formId) }),
  })
}

export function useRecordConsent() {
  return useMutation({
    mutationFn: ({ formId, responseId }: { formId: string; responseId?: string }) =>
      apiClient.post(`/forms/${formId}/consent/record`, { response_id: responseId }).then((r) => r.data),
  })
}

// ─── Phase 3: Automations ────────────────────────────────────────────────────

export function useFormAutomations(formId: string) {
  return useQuery({
    queryKey: keys.automations(formId),
    queryFn: () => apiClient.get(`/forms/${formId}/automations`).then((r) => r.data),
    enabled: !!formId,
  })
}

export function useCreateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, ...data }: { formId: string; name: string; trigger: string; trigger_conditions?: Record<string, unknown>; actions?: Record<string, unknown>[]; is_active?: boolean }) =>
      apiClient.post(`/forms/${formId}/automations`, data).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.automations(vars.formId) }),
  })
}

export function useDeleteAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, autoId }: { formId: string; autoId: string }) =>
      apiClient.delete(`/forms/${formId}/automations/${autoId}`).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.automations(vars.formId) }),
  })
}

// AI Suggest Improvements
export function useAISuggestImprovements() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) => apiClient.post(`/forms/${formId}/ai-suggest-improvements`).then(r => r.data),
  })
}

// Media Upload
export function useUploadFormMedia() {
  return useMutation({
    mutationFn: ({ formId, file }: { formId: string; file: File }) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post(`/forms/${formId}/media-upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    },
  })
}

// Embed Config
export function useEmbedConfig(formId: string) {
  return useQuery({
    queryKey: ['forms', formId, 'embed-config'],
    queryFn: () => apiClient.get(`/forms/${formId}/embed-config`).then(r => r.data),
    enabled: !!formId,
  })
}

export function useSaveEmbedConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, config }: { formId: string; config: Record<string, unknown> }) =>
      apiClient.put(`/forms/${formId}/embed-config`, config).then(r => r.data),
    onSuccess: (_, { formId }) => qc.invalidateQueries({ queryKey: ['forms', formId, 'embed-config'] }),
  })
}

export { formsApi }
