/**
 * Mail API client — typed wrappers for the Mail API proxy endpoints.
 *
 * Provides both standalone async functions (fetchFolders, sendMessage, etc.)
 * and TanStack Query hooks (useMailFolders, useSendMail, etc.).
 *
 * Endpoint shapes match `/api/v1/mail/*` in `backend/app/api/v1/mail.py`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { REFERENCE_PRESET, LIST_PRESET, DETAIL_PRESET, DASHBOARD_PRESET } from '@/utils/queryDefaults'
import apiClient from './client'

// ── TypeScript interfaces (matching backend response shapes) ──────────────────

export interface MailFolder {
  id: string
  name: string
  role: string | null
  total_emails: number
  unread_emails: number
}

export interface MailFoldersResponse {
  service_available: boolean
  folders: MailFolder[]
}

export interface MailAddress {
  name?: string
  email: string
}

export interface MailMessageSummary {
  id: string
  subject: string
  from: MailAddress
  date: string
  read: boolean
}

export interface MailMessagesResponse {
  service_available: boolean
  total: number
  messages: MailMessageSummary[]
}

export interface MailAttachment {
  blobId: string
  type: string
  name: string | null
  size: number
}

export interface MailMessageFull {
  id: string
  subject: string
  from: MailAddress[]
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  date: string
  text_body: string
  html_body: string
  attachments: MailAttachment[]
  read: boolean
}

export interface MailMessageResponse {
  service_available: boolean
  message: MailMessageFull | null
}

export interface SendMessagePayload {
  to: string[]
  subject: string
  body: string
  cc?: string[]
  html_body?: string
  in_reply_to?: string
  references?: string
  signature_id?: string
  request_read_receipt?: boolean
  attachments?: Array<{
    storage_key: string
    filename: string
    size: number
    content_type: string
  }>
  account_id?: string  // Send from a specific mail account
}

// ── Rules & Signatures & Read Receipts ──────────────────────────────────────

export interface MailRule {
  id: string
  name: string
  is_active: boolean
  priority: number
  conditions: Record<string, unknown>
  actions: Array<Record<string, unknown>>
  match_mode: string
  stop_processing: boolean
  created_at: string | null
}

export interface MailRuleCreate {
  name: string
  conditions: Record<string, unknown>
  actions: Array<Record<string, unknown>>
  match_mode?: string
  priority?: number
  is_active?: boolean
  stop_processing?: boolean
}

export interface MailSignature {
  id: string
  name: string
  content_text: string
  content_html: string
  is_default: boolean
  created_at: string | null
}

export interface MailSignatureCreate {
  name: string
  content_text?: string
  content_html?: string
  is_default?: boolean
}

export interface ReadReceipt {
  id: string
  message_id: string
  recipient_email: string
  requested_at: string | null
  read_at: string | null
}

export interface AISuggestResponse {
  suggestions: string[]
  error?: string
}

export interface SendMessageResponse {
  service_available: boolean
  success: boolean
  message_id: string | null
}

export interface ReplyPayload {
  message_id: string
  body: string
  html_body?: string
  reply_all?: boolean
}

export interface ForwardPayload {
  message_id: string
  to: string[]
  body?: string
}

export interface MarkReadResponse {
  service_available: boolean
  success: boolean
  message_id?: string
}

export interface DeleteMessageResponse {
  service_available: boolean
  success: boolean
  message_id?: string
}

// ── Standalone API functions ──────────────────────────────────────────────────

/** List all mail folders (Inbox, Sent, Drafts, Trash, etc.) */
export async function fetchFolders(): Promise<MailFoldersResponse> {
  const { data } = await apiClient.get<MailFoldersResponse>('/mail/folders')
  return data
}

/** List messages in a given folder with pagination. */
export async function fetchMessages(
  folder: string = 'inbox',
  page: number = 1,
  limit: number = 50,
  account_id?: string | null,
): Promise<MailMessagesResponse> {
  const params: Record<string, any> = { folder, page, limit }
  if (account_id) params.account_id = account_id
  const { data } = await apiClient.get<MailMessagesResponse>('/mail/messages', { params })
  return data
}

/** Fetch the full content of a single message by ID. */
export async function fetchMessage(id: string): Promise<MailMessageResponse> {
  const { data } = await apiClient.get<MailMessageResponse>(`/mail/message/${id}`)
  return data
}

/** Send a new email message. */
export async function sendMessage(payload: SendMessagePayload): Promise<SendMessageResponse> {
  const { data } = await apiClient.post<SendMessageResponse>('/mail/send', payload)
  return data
}

/** Reply to an existing email message. */
export async function replyToMessage(payload: ReplyPayload): Promise<SendMessageResponse> {
  const { data } = await apiClient.post<SendMessageResponse>('/mail/reply', payload)
  return data
}

/** Forward an email message to new recipients. */
export async function forwardMessage(payload: ForwardPayload): Promise<SendMessageResponse> {
  const { data } = await apiClient.post<SendMessageResponse>('/mail/forward', payload)
  return data
}

/** Mark a message as read. */
export async function markAsRead(id: string): Promise<MarkReadResponse> {
  const { data } = await apiClient.put<MarkReadResponse>(`/mail/message/${id}/read`)
  return data
}

/** Delete (trash) a message. */
export async function deleteMessage(id: string): Promise<DeleteMessageResponse> {
  const { data } = await apiClient.delete<DeleteMessageResponse>(`/mail/message/${id}`)
  return data
}

// ── TanStack Query hooks ─────────────────────────────────────────────────────

export function useMailFolders() {
  return useQuery({
    queryKey: ['mail', 'folders'],
    queryFn: fetchFolders,
    select: (res) => res.folders,
    retry: 1,
    ...LIST_PRESET,
  })
}

export function useMailMessages(params?: { folder?: string; page?: number; limit?: number; account_id?: string | null }) {
  return useQuery({
    queryKey: ['mail', 'messages', params],
    queryFn: () =>
      fetchMessages(params?.folder ?? 'inbox', params?.page ?? 1, params?.limit ?? 50, params?.account_id),
    retry: 1,
    ...LIST_PRESET,
  })
}

export function useMailMessage(id: string) {
  return useQuery({
    queryKey: ['mail', 'message', id],
    queryFn: () => fetchMessage(id),
    select: (res) => res.message,
    enabled: !!id,
    retry: 1,
    ...DETAIL_PRESET,
  })
}

export function useSendMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'messages'] }),
  })
}

export function useDeleteMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

export function useReplyMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: replyToMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

export function useForwardMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: forwardMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

// ── Rules hooks ─────────────────────────────────────────────────────────────

export function useMailRules() {
  return useQuery({
    queryKey: ['mail', 'rules'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; rules: MailRule[] }>('/mail/rules')
      return data
    },
    ...LIST_PRESET,
  })
}

export function useCreateMailRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: MailRuleCreate) => {
      const { data } = await apiClient.post<MailRule>('/mail/rules', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'rules'] }),
  })
}

export function useUpdateMailRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<MailRuleCreate> & { id: string }) => {
      const { data } = await apiClient.put<MailRule>(`/mail/rules/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'rules'] }),
  })
}

export function useDeleteMailRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/mail/rules/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'rules'] }),
  })
}

// ── Signatures hooks ────────────────────────────────────────────────────────

export function useMailSignatures() {
  return useQuery({
    queryKey: ['mail', 'signatures'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; signatures: MailSignature[] }>('/mail/signatures')
      return data
    },
    ...LIST_PRESET,
  })
}

export function useCreateMailSignature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: MailSignatureCreate) => {
      const { data } = await apiClient.post<MailSignature>('/mail/signatures', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'signatures'] }),
  })
}

export function useUpdateMailSignature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<MailSignatureCreate> & { id: string }) => {
      const { data } = await apiClient.put<MailSignature>(`/mail/signatures/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'signatures'] }),
  })
}

export function useDeleteMailSignature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/mail/signatures/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'signatures'] }),
  })
}

// ── Read Receipts hooks ─────────────────────────────────────────────────────

export function useReadReceipts() {
  return useQuery({
    queryKey: ['mail', 'read-receipts'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; receipts: ReadReceipt[] }>('/mail/read-receipts')
      return data
    },
    ...LIST_PRESET,
  })
}

// ── Attachment hooks ─────────────────────────────────────────────────────────

/** Download an attachment blob from a mail message. */
export function useDownloadAttachment() {
  return useMutation({
    mutationFn: async ({ messageId, attachmentId }: { messageId: string; attachmentId: string }) => {
      const { data } = await apiClient.get(`/mail/message/${messageId}/attachment/${attachmentId}`, {
        responseType: 'blob',
      })
      return data as Blob
    },
  })
}

/** Save a mail attachment directly to Drive. */
export function useSaveAttachmentToDrive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      messageId,
      attachmentId,
      folderPath,
    }: {
      messageId: string
      attachmentId: string
      folderPath?: string
    }) => {
      const params = folderPath ? { folder_path: folderPath } : {}
      const { data } = await apiClient.post(
        `/mail/message/${messageId}/attachment/${attachmentId}/save-to-drive`,
        null,
        { params },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drive'] })
    },
  })
}

// ── Cross-module interfaces ─────────────────────────────────────────────────

export interface SaveToDriveResponse {
  saved: boolean
  file_count: number
  files: Array<{ file_id: string; filename: string; size: number; content_type: string }>
  folder_path: string
}

export interface LinkCRMPayload {
  contact_id?: string
  deal_id?: string
  note?: string
}

export interface LinkCRMResponse {
  linked: boolean
  activity_id: string
  message_id: string
  contact_id?: string
  deal_id?: string
  entity_name: string
  entity_type: string
}

export interface CRMLink {
  activity_id: string
  message: string
  contact_id?: string
  deal_id?: string
  note?: string
  created_at: string | null
}

export interface CRMLinksResponse {
  message_id: string
  total: number
  links: CRMLink[]
}

export interface ConvertToTaskPayload {
  project_id: string
  assignee_id?: string
  priority?: string
}

export interface ConvertToTaskResponse {
  created: boolean
  task_id: string
  project_id: string
  project_name: string
  title: string
  priority: string
  status: string
}

export interface SaveAsNotePayload {
  tags?: string[]
  is_pinned?: boolean
}

export interface SaveAsNoteResponse {
  created: boolean
  note_id: string
  title: string
  tags: string[]
  is_pinned: boolean
}

// ── Mail → Drive: Save all attachments ──────────────────────────────────────

export function useSaveAllAttachmentsToDrive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      messageId,
      folderId,
    }: {
      messageId: string
      folderId?: string
    }) => {
      const { data } = await apiClient.post<SaveToDriveResponse>(
        `/mail/messages/${messageId}/save-to-drive`,
        folderId ? { folder_id: folderId } : {},
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drive'] })
    },
  })
}

// ── Mail → CRM: Link to contact/deal ───────────────────────────────────────

export function useLinkMailToCRM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      messageId,
      ...payload
    }: LinkCRMPayload & { messageId: string }) => {
      const { data } = await apiClient.post<LinkCRMResponse>(
        `/mail/messages/${messageId}/link-crm`,
        payload,
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['mail', 'crm-links', variables.messageId] })
    },
  })
}

export function useMailCRMLinks(messageId: string) {
  return useQuery({
    queryKey: ['mail', 'crm-links', messageId],
    queryFn: async () => {
      const { data } = await apiClient.get<CRMLinksResponse>(
        `/mail/messages/${messageId}/crm-links`,
      )
      return data
    },
    enabled: !!messageId,
    ...LIST_PRESET,
  })
}

// ── Mail → Projects: Convert to task ────────────────────────────────────────

export function useConvertMailToTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      messageId,
      ...payload
    }: ConvertToTaskPayload & { messageId: string }) => {
      const { data } = await apiClient.post<ConvertToTaskResponse>(
        `/mail/messages/${messageId}/convert-to-task`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// ── Mail → Notes: Save as note ──────────────────────────────────────────────

export function useSaveMailAsNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      messageId,
      ...payload
    }: SaveAsNotePayload & { messageId: string }) => {
      const { data } = await apiClient.post<SaveAsNoteResponse>(
        `/mail/messages/${messageId}/save-as-note`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// ── Attachment upload hook ───────────────────────────────────────────────────

export interface UploadAttachmentResponse {
  storage_key: string
  filename: string
  size: number
  content_type: string
}

/** Upload a file attachment to MinIO for use in compose. */
export function useUploadMailAttachment() {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadAttachmentResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<UploadAttachmentResponse>(
        '/mail/attachments/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return data
    },
  })
}

// ── Snooze hook ─────────────────────────────────────────────────────────────

export function useSnoozeMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, snooze_until }: { messageId: string; snooze_until: string }) => {
      const { data } = await apiClient.post(`/mail/messages/${messageId}/snooze`, { snooze_until })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

// ── Contacts hook ───────────────────────────────────────────────────────────

export interface MailContact {
  email: string
  name?: string
}

export function useMailContacts(search?: string) {
  return useQuery({
    queryKey: ['mail', 'contacts', search],
    queryFn: async () => {
      const { data } = await apiClient.get<{ contacts: MailContact[] }>('/mail/contacts', {
        params: search ? { q: search } : {},
      })
      return data.contacts ?? []
    },
    enabled: search === undefined || search.length >= 1,
    ...LIST_PRESET,
  })
}

// ── Move message hook ───────────────────────────────────────────────────────

export function useMoveMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, folder }: { messageId: string; folder: string }) => {
      const { data } = await apiClient.put(`/mail/message/${messageId}/move`, { folder })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

// ── AI Suggestions hook ─────────────────────────────────────────────────────

export function useAISuggestReply() {
  return useMutation({
    mutationFn: async (payload: { message_id: string; context?: string }) => {
      const { data } = await apiClient.post<AISuggestResponse>('/mail/ai-suggest-reply', payload)
      return data
    },
  })
}

// ── Era Mail Advanced API hooks ───────────────────────────────────────────────

// Interfaces
export interface TriageSummary {
  category: string
  count: number
}

export interface SmartFolder {
  id: string
  name: string
  query: string
  icon?: string
  is_ai_suggested: boolean
  message_count: number
}

export interface MailCategory {
  id: string
  name: string
  color: string
  keyboard_shortcut?: string
}

export interface MailQuickStep {
  id: string
  name: string
  icon?: string
  keyboard_shortcut?: string
  actions: Array<Record<string, unknown>>
}

export interface MailTemplate {
  id: string
  name: string
  subject_template: string
  body_html_template: string
  variables: string[]
  category?: string
  is_shared: boolean
}

export interface ContactProfile {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  title?: string
  company?: string
  crm_contact_id?: string
  email_count: number
  last_email_at?: string
  avg_response_time_minutes?: number
  sentiment_trend?: string
}

export interface MailAnalyticsOverview {
  sent_count: number
  received_count: number
  avg_response_time_minutes: number
  unread_count: number
  period_days: number
}

export interface TopContact {
  email: string
  name: string
  count: number
}

export interface HourlyHeatmap {
  hour: number
  count: number
}

export interface ActionItem {
  action: string
  due_date?: string
  assignee_hint?: string
}

// ── AI Triage ──────────────────────────────────────────────────────────────

export function useTriageInbox() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/mail/triage')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

export function useTriageMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await apiClient.post(`/mail/triage/${messageId}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

export function useTriageSummary() {
  return useQuery({
    queryKey: ['mail', 'triage-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ categories: TriageSummary[] }>('/mail/triage/summary')
      return data.categories ?? []
    },
    ...DASHBOARD_PRESET,
  })
}

export function useExtractActions() {
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await apiClient.post<{ actions: ActionItem[] }>(`/mail/extract-actions/${messageId}`)
      return data.actions ?? []
    },
  })
}

// ── Focused Inbox ──────────────────────────────────────────────────────────

export function useFocusedInbox(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['mail', 'focused', params],
    queryFn: async () => {
      const { data } = await apiClient.get<MailMessagesResponse>('/mail/focused', {
        params: { page: params?.page ?? 1, limit: params?.limit ?? 50 },
      })
      return data
    },
    ...LIST_PRESET,
  })
}

export function useOtherInbox(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['mail', 'other', params],
    queryFn: async () => {
      const { data } = await apiClient.get<MailMessagesResponse>('/mail/other', {
        params: { page: params?.page ?? 1, limit: params?.limit ?? 50 },
      })
      return data
    },
    ...LIST_PRESET,
  })
}

// ── Smart Folders ─────────────────────────────────────────────────────────

export function useSmartFolders() {
  return useQuery({
    queryKey: ['mail', 'smart-folders'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ folders: SmartFolder[] }>('/mail/smart-folders')
      return data.folders ?? []
    },
    ...LIST_PRESET,
  })
}

export function useCreateSmartFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; query: string; icon?: string }) => {
      const { data } = await apiClient.post<SmartFolder>('/mail/smart-folders', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'smart-folders'] }),
  })
}

export function useDeleteSmartFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/mail/smart-folders/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'smart-folders'] }),
  })
}

// ── Search ──────────────────────────────────────────────────────────────────

export function useMailSearch(params: {
  q?: string
  from_addr?: string
  has_attachment?: boolean
  is_unread?: boolean
  label?: string
  before?: string
  after?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['mail', 'search', params],
    queryFn: async () => {
      const { data } = await apiClient.get<MailMessagesResponse>('/mail/search', { params })
      return data
    },
    enabled: !!(params.q || params.from_addr || params.has_attachment || params.is_unread),
    ...LIST_PRESET,
  })
}

// ── Pin / Flag / Categorize ────────────────────────────────────────────────

export function usePinMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      const { data } = await apiClient.put(`/mail/message/${messageId}/pin`, null, {
        params: { pinned },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

export function useFlagMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      messageId: string
      flag_status: string
      due_date?: string
      reminder_at?: string
    }) => {
      const { messageId, ...body } = payload
      const { data } = await apiClient.put(`/mail/message/${messageId}/flag`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

export function useCategorizeMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, category_ids }: { messageId: string; category_ids: string[] }) => {
      const { data } = await apiClient.put(`/mail/message/${messageId}/categorize`, { category_ids })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

// ── Categories ──────────────────────────────────────────────────────────────

export function useMailCategories() {
  return useQuery({
    queryKey: ['mail', 'categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ categories: MailCategory[] }>('/mail/categories')
      return data.categories ?? []
    },
    ...REFERENCE_PRESET,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; color: string; keyboard_shortcut?: string }) => {
      const { data } = await apiClient.post<MailCategory>('/mail/categories', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'categories'] }),
  })
}

// ── Quick Steps ──────────────────────────────────────────────────────────────

export function useQuickSteps() {
  return useQuery({
    queryKey: ['mail', 'quick-steps'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ quick_steps: MailQuickStep[] }>('/mail/quick-steps')
      return data.quick_steps ?? []
    },
    ...LIST_PRESET,
  })
}

export function useExecuteQuickStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ stepId, messageId }: { stepId: string; messageId: string }) => {
      const { data } = await apiClient.post(`/mail/quick-steps/${stepId}/execute/${messageId}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

// ── Templates ────────────────────────────────────────────────────────────────

export function useMailTemplates() {
  return useQuery({
    queryKey: ['mail', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ templates: MailTemplate[] }>('/mail/templates')
      return data.templates ?? []
    },
    ...LIST_PRESET,
  })
}

export function useRenderTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, variables }: { templateId: string; variables: Record<string, string> }) => {
      const { data } = await apiClient.post<{ rendered_subject: string; rendered_body: string }>(
        `/mail/templates/${templateId}/render`,
        { variables },
      )
      return data
    },
  })
}

// ── AI Thread Summarization & Draft ──────────────────────────────────────────

export function useSummarizeThread() {
  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { data } = await apiClient.post<{ summary: string }>('/mail/summarize-thread', { message_ids: messageIds })
      return data.summary ?? ''
    },
  })
}

export function useAIDraft() {
  return useMutation({
    mutationFn: async (payload: { message_id: string; tone?: string; instructions?: string }) => {
      const { data } = await apiClient.post<{ draft_html: string; draft_text: string; context_used: string[] }>(
        '/mail/ai-draft',
        payload,
      )
      return data
    },
  })
}

// ── Cross-Module Routing ─────────────────────────────────────────────────────

export function useCreateTicketFromMail() {
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await apiClient.post(`/mail/create-ticket/${messageId}`)
      return data
    },
  })
}

export function useCreateInvoiceFromMail() {
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await apiClient.post(`/mail/create-invoice/${messageId}`)
      return data
    },
  })
}

export function useCreateCRMLeadFromMail() {
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await apiClient.post(`/mail/create-crm-lead/${messageId}`)
      return data
    },
  })
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export function useMailAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ['mail', 'analytics', 'overview', days],
    queryFn: async () => {
      const { data } = await apiClient.get<MailAnalyticsOverview>('/mail/analytics/overview', {
        params: { days },
      })
      return data
    },
    ...DASHBOARD_PRESET,
  })
}

export function useTopContacts() {
  return useQuery({
    queryKey: ['mail', 'analytics', 'top-contacts'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ contacts: TopContact[] }>('/mail/analytics/top-contacts')
      return data.contacts ?? []
    },
    ...DASHBOARD_PRESET,
  })
}

export function useHourlyHeatmap() {
  return useQuery({
    queryKey: ['mail', 'analytics', 'hourly-heatmap'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ hours: HourlyHeatmap[] }>('/mail/analytics/hourly-heatmap')
      return data.hours ?? []
    },
    ...DASHBOARD_PRESET,
  })
}

// ── Contact Profiles ───────────────────────────────────────────────────────────

export function useContactProfiles(page: number = 1, limit: number = 50) {
  return useQuery({
    queryKey: ['mail', 'contact-profiles', page],
    queryFn: async () => {
      const { data } = await apiClient.get<{ profiles: ContactProfile[]; total: number }>(
        '/mail/contacts/profiles',
        { params: { page, limit } },
      )
      return data
    },
    ...LIST_PRESET,
  })
}

export function useContactProfile(email: string) {
  return useQuery({
    queryKey: ['mail', 'contact-profile', email],
    queryFn: async () => {
      const { data } = await apiClient.get<{ profile: ContactProfile; crm_data: Record<string, unknown> }>(
        `/mail/contacts/profile/${encodeURIComponent(email)}`,
      )
      return data
    },
    enabled: !!email,
    ...DETAIL_PRESET,
  })
}

// ── Rule Testing ──────────────────────────────────────────────────────────────

export function useTestRule() {
  return useMutation({
    mutationFn: async ({ ruleId, messageId }: { ruleId: string; messageId: string }) => {
      const { data } = await apiClient.post<{ would_match: boolean; actions_preview: Array<Record<string, unknown>> }>(
        `/mail/rules/${ruleId}/test/${messageId}`,
      )
      return data
    },
  })
}

export function useRunRuleNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ruleId, folder }: { ruleId: string; folder?: string }) => {
      const { data } = await apiClient.post(`/mail/rules/${ruleId}/run-now`, null, {
        params: folder ? { folder } : {},
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

// ── Calendar Extraction ────────────────────────────────────────────────────────

export function useExtractCalendar() {
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await apiClient.post<{
        has_event: boolean
        title?: string
        start_time?: string
        end_time?: string
        participants?: string[]
        location?: string
      }>(`/mail/extract-calendar/${messageId}`)
      return data
    },
  })
}


// ══════════════════════════════════════════════════════════════════════════════
// Phase 2 — Context-Aware AI Copilot, Contact Intelligence, Offline, Automation
// ══════════════════════════════════════════════════════════════════════════════

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ContextAwareDraft {
  draft_html: string
  draft_text: string
  context_used: string[]
  tone: string
}

export interface EnhancedThreadSummary {
  message_count: number
  summary: string
  key_decisions: string[]
  action_items: Array<{ action: string; assignee_hint?: string; due_date?: string }>
  unresolved_questions: string[]
  sentiment_overview: string
}

export interface ToneCheckResult {
  tone: string
  confidence: number
  suggestions: string[]
  emoji_summary: string
}

export interface SmartComposeSuggestion {
  suggestion: string
}

export interface FinancialRibbon {
  sender_email: string
  is_known: boolean
  crm: {
    contact_name?: string
    deal_stage?: string
    deal_value?: number
    lifetime_revenue?: number
  }
  finance: {
    open_po_count?: number
    open_po_value?: number
    overdue_invoice_count?: number
    overdue_invoice_value?: number
    last_payment_date?: string
    total_spent?: number
  }
  support: {
    open_ticket_count?: number
  }
}

export interface MeetingPrepBriefing {
  briefing_text: string
  attendees: Array<{
    email: string
    name?: string
    recent_emails: number
    crm_status?: string
    open_tasks?: number
    open_tickets?: number
  }>
}

export interface ContactRelationship {
  email: string
  frequency_trend: Array<{ month: string; count: number }>
  sentiment_trend: Array<{ month: string; sentiment: string }>
  thread_count: number
}

export interface DuplicateContact {
  profile_email: string
  crm_email: string
  confidence: number
  suggested_action: string
}

export interface MailAnnotation {
  id: string
  user_id: string
  content: string
  is_internal: boolean
  created_at?: string
}

// ── Context-Aware AI Copilot ────────────────────────────────────────────────

export function useContextAwareDraft() {
  return useMutation({
    mutationFn: async (payload: {
      message_id: string
      tone?: string
      instructions?: string
      include_era_context?: boolean
    }) => {
      const { data } = await apiClient.post<ContextAwareDraft>('/mail/ai-draft-context', payload)
      return data
    },
  })
}

export function useEnhancedThreadSummary() {
  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { data } = await apiClient.post<EnhancedThreadSummary>(
        '/mail/summarize-thread-enhanced',
        { message_ids: messageIds },
      )
      return data
    },
  })
}

export function useToneCheck() {
  return useMutation({
    mutationFn: async (text: string) => {
      const { data } = await apiClient.post<ToneCheckResult>('/mail/tone-check', { text })
      return data
    },
  })
}

export function useSmartCompose() {
  return useMutation({
    mutationFn: async (payload: { partial_text: string; context_message_id?: string }) => {
      const { data } = await apiClient.post<SmartComposeSuggestion>('/mail/smart-compose', payload)
      return data
    },
  })
}

// ── Financial Context Ribbon ────────────────────────────────────────────────

export function useFinancialRibbon(senderEmail: string) {
  return useQuery({
    queryKey: ['mail', 'financial-ribbon', senderEmail],
    queryFn: async () => {
      const { data } = await apiClient.get<FinancialRibbon>(
        `/mail/financial-ribbon/${encodeURIComponent(senderEmail)}`,
      )
      return data
    },
    enabled: !!senderEmail,
    staleTime: 5 * 60 * 1000, // 5 min cache
  })
}

// ── Meeting Prep ────────────────────────────────────────────────────────────

export function useMeetingPrep() {
  return useMutation({
    mutationFn: async (attendeeEmails: string[]) => {
      const { data } = await apiClient.post<MeetingPrepBriefing>('/mail/meeting-prep', {
        attendee_emails: attendeeEmails,
      })
      return data
    },
  })
}

// ── Contact Intelligence ────────────────────────────────────────────────────

export function useSyncContactProfiles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/mail/contacts/sync')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'contact-profiles'] }),
  })
}

export function useContactRelationship(email: string) {
  return useQuery({
    queryKey: ['mail', 'contact-relationship', email],
    queryFn: async () => {
      const { data } = await apiClient.get<ContactRelationship>(
        `/mail/contacts/relationship/${encodeURIComponent(email)}`,
      )
      return data
    },
    enabled: !!email,
    ...DETAIL_PRESET,
  })
}

export function useDetectDuplicateContacts() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ duplicates: DuplicateContact[] }>('/mail/contacts/detect-duplicates')
      return data.duplicates ?? []
    },
  })
}

// ── Scheduled Send ──────────────────────────────────────────────────────────

export function useScheduleSend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { message_id: string; scheduled_at: string }) => {
      const { data } = await apiClient.post('/mail/schedule-send', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

export function useCancelScheduledSend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await apiClient.delete(`/mail/schedule-send/${messageId}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  })
}

// ── ERP Template Rendering ──────────────────────────────────────────────────

export function useRenderTemplateERP() {
  return useMutation({
    mutationFn: async (payload: {
      templateId: string
      contact_email?: string
      deal_id?: string
      invoice_id?: string
    }) => {
      const { templateId, ...body } = payload
      const { data } = await apiClient.post<{ rendered_subject: string; rendered_body: string }>(
        `/mail/templates/${templateId}/render-erp`,
        { template_id: templateId, ...body },
      )
      return data
    },
  })
}

// ── AI Rule Conditions ──────────────────────────────────────────────────────

export function useAddAIRuleCondition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { rule_id: string; ai_condition: string }) => {
      const { data } = await apiClient.post(`/mail/rules/${payload.rule_id}/ai-condition`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'rules'] }),
  })
}

// ── Annotations (Internal Team Comments) ────────────────────────────────────

export function useMessageAnnotations(messageId: string) {
  return useQuery({
    queryKey: ['mail', 'annotations', messageId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ annotations: MailAnnotation[]; total: number }>(
        `/mail/message/${messageId}/annotations`,
      )
      return data
    },
    enabled: !!messageId,
    ...LIST_PRESET,
  })
}

export function useCreateAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { data } = await apiClient.post(`/mail/message/${messageId}/annotations`, {
        content,
        is_internal: true,
      })
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['mail', 'annotations', variables.messageId] })
    },
  })
}

export function useDeleteAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (annotationId: string) => {
      await apiClient.delete(`/mail/annotations/${annotationId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail', 'annotations'] }),
  })
}
