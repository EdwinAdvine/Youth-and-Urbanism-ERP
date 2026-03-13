/**
 * CRM v2 API client — enhanced contact management with 360-degree view,
 * contact notes, custom fields, pipeline boards, and sales activity tracking.
 *
 * Exports TanStack Query hooks and Axios helper functions for the enhanced CRM
 * v2 feature set. All requests go through `client.ts` (Axios instance with
 * auth interceptors). Backend prefix: `/api/v1/crm`.
 *
 * Key exports:
 *   - useContact360() — full contact profile: leads, deals, quotes, activities, campaigns
 *   - useContactNotes() / useCreateContactNote() / useUpdateContactNote() — pinnable notes per contact
 *   - useCustomFieldValues() / useUpsertCustomFieldValues() — per-entity custom field values
 *   - usePipelineBoard() — kanban board view with swimlane grouping
 *   - usePipelineForecast() — weighted revenue forecast by stage
 *   - useSalesActivities() / useCreateSalesActivity() — call/meeting/task activity log
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

// Contact 360
export interface Contact360 {
  contact: Record<string, any>
  leads: Record<string, any>[]
  opportunities: Record<string, any>[]
  deals: Record<string, any>[]
  quotes: Record<string, any>[]
  activities: Record<string, any>[]
  notes: ContactNote[]
  campaigns: { campaign_id: string; campaign_name: string | null; status: string; sent_at: string | null; opened_at: string | null }[]
  sequence_enrollments: Record<string, any>[]
}

// Notes
export interface ContactNote {
  id: string
  contact_id: string
  author_id: string
  note_type: string
  content: string
  metadata_json: Record<string, any> | null
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface NoteCreatePayload {
  note_type?: string
  content: string
  metadata_json?: Record<string, any> | null
  pinned?: boolean
}

// Custom Fields
export interface CustomFieldDefinition {
  id: string
  entity_type: string
  field_name: string
  field_label: string
  field_type: string
  options: Record<string, any> | null
  is_required: boolean
  default_value: string | null
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface CustomFieldCreatePayload {
  entity_type: string
  field_name: string
  field_label: string
  field_type: string
  options?: Record<string, any> | null
  is_required?: boolean
  default_value?: string | null
  sort_order?: number
}

// Scoring
export interface LeadScoringRule {
  id: string
  name: string
  category: string
  field_name: string
  operator: string
  value: string
  score_delta: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ScoringRuleCreatePayload {
  name: string
  category: string
  field_name: string
  operator: string
  value: string
  score_delta: number
  is_active?: boolean
}

export interface ScoreResult {
  lead_id: string
  score: number
  category: string
  factors: { rule: string; category: string; field: string; delta: number }[]
}

// Pipelines
export interface Pipeline {
  id: string
  name: string
  description: string | null
  stages: { name: string; probability: number; color: string; position: number }[] | null
  is_default: boolean
  is_active: boolean
  owner_id: string
  created_at: string
  updated_at: string
}

export interface PipelineCreatePayload {
  name: string
  description?: string | null
  stages?: { name: string; probability: number; color: string; position: number }[]
  is_default?: boolean
}

export interface PipelineBoard {
  pipeline: Pipeline
  stages: string[]
  board: Record<string, any[]>
  swimlanes: Record<string, Record<string, any[]>> | null
  total_opportunities: number
}

export interface PipelineForecast {
  pipeline_id: string
  probability_adjustment: number
  total_opportunities: number
  total_value: number
  weighted_forecast: number
  by_stage: Record<string, { count: number; total_value: number; weighted_value: number }>
}

// Activities
export interface SalesActivity {
  id: string
  activity_type: string
  subject: string
  description: string | null
  contact_id: string | null
  lead_id: string | null
  opportunity_id: string | null
  deal_id: string | null
  assigned_to: string | null
  completed_at: string | null
  due_date: string | null
  duration_minutes: number | null
  outcome: string | null
  metadata_json: Record<string, any> | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface ActivityCreatePayload {
  activity_type: string
  subject: string
  description?: string | null
  contact_id?: string | null
  lead_id?: string | null
  opportunity_id?: string | null
  deal_id?: string | null
  assigned_to?: string | null
  completed_at?: string | null
  due_date?: string | null
  duration_minutes?: number | null
  outcome?: string | null
  metadata_json?: Record<string, any> | null
}

// Sequences
export interface SalesSequence {
  id: string
  name: string
  description: string | null
  status: string
  trigger_type: string
  trigger_config: Record<string, any> | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface SequenceStep {
  id: string
  sequence_id: string
  step_order: number
  step_type: string
  delay_days: number
  delay_hours: number
  config: Record<string, any> | null
  created_at: string
}

export interface SequenceEnrollment {
  id: string
  sequence_id: string
  contact_id: string
  current_step_id: string | null
  status: string
  enrolled_at: string
  completed_at: string | null
  enrolled_by: string
  metadata_json: Record<string, any> | null
  created_at: string
}

export interface SequenceCreatePayload {
  name: string
  description?: string | null
  trigger_type?: string
  trigger_config?: Record<string, any> | null
  steps?: { step_order: number; step_type: string; delay_days?: number; delay_hours?: number; config?: Record<string, any> | null }[]
}

export interface SequenceDetail {
  sequence: SalesSequence
  steps: SequenceStep[]
  stats: { total_enrollments: number; active: number; completed: number }
}

// Templates
export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body_html: string
  body_text: string | null
  category: string
  variables: Record<string, any> | null
  is_active: boolean
  owner_id: string
  created_at: string
  updated_at: string
}

export interface TemplateCreatePayload {
  name: string
  subject: string
  body_html: string
  body_text?: string | null
  category?: string
  variables?: Record<string, any> | null
  is_active?: boolean
}

// Duplicates
export interface DuplicateCandidate {
  id: string
  contact_a_id: string
  contact_b_id: string
  confidence_score: number
  match_fields: Record<string, any> | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

// ─── Contact 360 ──────────────────────────────────────────────────────────────

export function useContact360(contactId: string) {
  return useQuery<Contact360>({
    queryKey: ['crm', 'contact360', contactId],
    queryFn: () => apiClient.get(`/crm/contacts/${contactId}/360`).then(r => r.data),
    enabled: !!contactId,
  })
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export function useContactNotes(contactId: string, page = 1) {
  return useQuery({
    queryKey: ['crm', 'notes', contactId, page],
    queryFn: () => apiClient.get(`/crm/contacts/${contactId}/notes`, { params: { page } }).then(r => r.data),
    enabled: !!contactId,
  })
}

export function useCreateNote(contactId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: NoteCreatePayload) => apiClient.post(`/crm/contacts/${contactId}/notes`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'notes', contactId] }),
  })
}

// ─── Custom Fields ────────────────────────────────────────────────────────────

export function useCustomFields(entityType?: string) {
  return useQuery({
    queryKey: ['crm', 'custom-fields', entityType],
    queryFn: () => apiClient.get('/crm/custom-fields', { params: { entity_type: entityType } }).then(r => r.data),
  })
}

export function useCreateCustomField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CustomFieldCreatePayload) => apiClient.post('/crm/custom-fields', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'custom-fields'] }),
  })
}

export function useUpdateCustomField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CustomFieldCreatePayload>) => apiClient.put(`/crm/custom-fields/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'custom-fields'] }),
  })
}

export function useDeleteCustomField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/custom-fields/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'custom-fields'] }),
  })
}

// ─── Scoring Rules ────────────────────────────────────────────────────────────

export function useScoringRules(category?: string, activeOnly = false) {
  return useQuery({
    queryKey: ['crm', 'scoring-rules', category, activeOnly],
    queryFn: () => apiClient.get('/crm/scoring/rules', { params: { category, active_only: activeOnly } }).then(r => r.data),
  })
}

export function useCreateScoringRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ScoringRuleCreatePayload) => apiClient.post('/crm/scoring/rules', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'scoring-rules'] }),
  })
}

export function useUpdateScoringRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<ScoringRuleCreatePayload>) => apiClient.put(`/crm/scoring/rules/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'scoring-rules'] }),
  })
}

export function useDeleteScoringRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/scoring/rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'scoring-rules'] }),
  })
}

export function useBatchRescore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/crm/scoring/run').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm'] }),
  })
}

export function useScoreLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (leadId: string) => apiClient.post(`/crm/leads/${leadId}/score`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm'] }),
  })
}

export function useScoringWeights() {
  return useQuery({
    queryKey: ['crm', 'scoring-weights'],
    queryFn: () => apiClient.get('/crm/scoring/weights').then(r => r.data),
  })
}

// ─── Pipelines ────────────────────────────────────────────────────────────────

export function usePipelines(activeOnly = true) {
  return useQuery({
    queryKey: ['crm', 'pipelines', activeOnly],
    queryFn: () => apiClient.get('/crm/pipelines', { params: { active_only: activeOnly } }).then(r => r.data),
  })
}

export function useCreatePipeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PipelineCreatePayload) => apiClient.post('/crm/pipelines', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'pipelines'] }),
  })
}

export function useUpdatePipeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<PipelineCreatePayload>) => apiClient.put(`/crm/pipelines/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'pipelines'] }),
  })
}

export function useDeletePipeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/pipelines/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'pipelines'] }),
  })
}

export function usePipelineBoard(pipelineId: string, swimlane?: string) {
  return useQuery<PipelineBoard>({
    queryKey: ['crm', 'pipeline-board', pipelineId, swimlane],
    queryFn: () => apiClient.get(`/crm/pipelines/${pipelineId}/board`, { params: { swimlane } }).then(r => r.data),
    enabled: !!pipelineId,
  })
}

export function usePipelineForecast(pipelineId: string, adjustment = 0) {
  return useQuery<PipelineForecast>({
    queryKey: ['crm', 'pipeline-forecast', pipelineId, adjustment],
    queryFn: () => apiClient.get(`/crm/pipelines/${pipelineId}/forecast`, { params: { probability_adjustment: adjustment } }).then(r => r.data),
    enabled: !!pipelineId,
  })
}

// ─── Activities ───────────────────────────────────────────────────────────────

export function useActivities(params?: { activity_type?: string; contact_id?: string; page?: number }) {
  return useQuery({
    queryKey: ['crm', 'activities', params],
    queryFn: () => apiClient.get('/crm/activities', { params }).then(r => r.data),
  })
}

export function useCreateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ActivityCreatePayload) => apiClient.post('/crm/activities', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'activities'] }),
  })
}

export function useUpdateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<ActivityCreatePayload>) => apiClient.put(`/crm/activities/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'activities'] }),
  })
}

export function useDeleteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/activities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'activities'] }),
  })
}

// ─── Sequences ────────────────────────────────────────────────────────────────

export function useSequences(statusFilter?: string, page = 1) {
  return useQuery({
    queryKey: ['crm', 'sequences', statusFilter, page],
    queryFn: () => apiClient.get('/crm/sequences', { params: { status: statusFilter, page } }).then(r => r.data),
  })
}

export function useSequenceDetail(sequenceId: string) {
  return useQuery<SequenceDetail>({
    queryKey: ['crm', 'sequence', sequenceId],
    queryFn: () => apiClient.get(`/crm/sequences/${sequenceId}`).then(r => r.data),
    enabled: !!sequenceId,
  })
}

export function useCreateSequence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SequenceCreatePayload) => apiClient.post('/crm/sequences', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'sequences'] }),
  })
}

export function useUpdateSequence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<SequenceCreatePayload>) => apiClient.put(`/crm/sequences/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'sequences'] }),
  })
}

export function useDeleteSequence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/sequences/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'sequences'] }),
  })
}

export function useActivateSequence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/crm/sequences/${id}/activate`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'sequences'] }),
  })
}

export function usePauseSequence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/crm/sequences/${id}/pause`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'sequences'] }),
  })
}

export function useEnrollContacts(sequenceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (contactIds: string[]) => apiClient.post(`/crm/sequences/${sequenceId}/enroll`, { contact_ids: contactIds }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'sequences'] }),
  })
}

export function useUnenrollContact(sequenceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (contactId: string) => apiClient.post(`/crm/sequences/${sequenceId}/unenroll/${contactId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'sequences'] }),
  })
}

export function useSequenceEnrollments(sequenceId: string, statusFilter?: string, page = 1) {
  return useQuery({
    queryKey: ['crm', 'enrollments', sequenceId, statusFilter, page],
    queryFn: () => apiClient.get(`/crm/sequences/${sequenceId}/enrollments`, { params: { status: statusFilter, page } }).then(r => r.data),
    enabled: !!sequenceId,
  })
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function useTemplates(category?: string, activeOnly = false, page = 1) {
  return useQuery({
    queryKey: ['crm', 'templates', category, activeOnly, page],
    queryFn: () => apiClient.get('/crm/templates', { params: { category, active_only: activeOnly, page } }).then(r => r.data),
  })
}

export function useTemplate(templateId: string) {
  return useQuery<EmailTemplate>({
    queryKey: ['crm', 'template', templateId],
    queryFn: () => apiClient.get(`/crm/templates/${templateId}`).then(r => r.data),
    enabled: !!templateId,
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TemplateCreatePayload) => apiClient.post('/crm/templates', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'templates'] }),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<TemplateCreatePayload>) => apiClient.put(`/crm/templates/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'templates'] }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crm/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'templates'] }),
  })
}

export function usePreviewTemplate() {
  return useMutation({
    mutationFn: ({ id, mergeData }: { id: string; mergeData: Record<string, string> }) =>
      apiClient.post(`/crm/templates/${id}/preview`, { merge_data: mergeData }).then(r => r.data),
  })
}

// ─── Duplicates ───────────────────────────────────────────────────────────────

export function useDetectDuplicates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/crm/contacts/detect-duplicates').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'duplicates'] }),
  })
}

export function useDuplicates(statusFilter = 'pending', page = 1) {
  return useQuery({
    queryKey: ['crm', 'duplicates', statusFilter, page],
    queryFn: () => apiClient.get('/crm/duplicates', { params: { status: statusFilter, page } }).then(r => r.data),
  })
}

export function useMergeDuplicate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ candidateId, keepContactId }: { candidateId: string; keepContactId: string }) =>
      apiClient.post(`/crm/duplicates/${candidateId}/merge`, { keep_contact_id: keepContactId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm'] }),
  })
}

export function useDismissDuplicate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (candidateId: string) => apiClient.post(`/crm/duplicates/${candidateId}/dismiss`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'duplicates'] }),
  })
}
