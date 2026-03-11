/**
 * Mail API client — typed wrappers for the Mail API proxy endpoints.
 *
 * Provides both standalone async functions (fetchFolders, sendMessage, etc.)
 * and TanStack Query hooks (useMailFolders, useSendMail, etc.).
 *
 * Endpoint shapes match `/api/v1/mail/*` in `backend/app/api/v1/mail.py`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
): Promise<MailMessagesResponse> {
  const { data } = await apiClient.get<MailMessagesResponse>('/mail/messages', {
    params: { folder, page, limit },
  })
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
  })
}

export function useMailMessages(params?: { folder?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['mail', 'messages', params],
    queryFn: () =>
      fetchMessages(params?.folder ?? 'inbox', params?.page ?? 1, params?.limit ?? 50),
    retry: 1,
  })
}

export function useMailMessage(id: string) {
  return useQuery({
    queryKey: ['mail', 'message', id],
    queryFn: () => fetchMessage(id),
    select: (res) => res.message,
    enabled: !!id,
    retry: 1,
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
