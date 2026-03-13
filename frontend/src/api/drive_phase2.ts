/**
 * Drive Phase 2 + 3 API hooks
 * Covers: file requests, webhooks, API keys, templates, vault, DLP,
 *         comment threads, file presence, sharing analytics, snapshots,
 *         eDiscovery, analytics.
 */
import apiClient from "./client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = "/drive";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface CommentThread {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  is_resolved: boolean;
  created_at: string;
  replies: Array<{
    id: string;
    user_id: string;
    content: string;
    created_at: string;
  }>;
}

export interface FileRequest {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  token: string;
  is_active: boolean;
  submission_count: number;
  created_at: string;
}

export interface FileRequestSubmission {
  id: string;
  file_name: string;
  file_size: number;
  submitted_by_name?: string;
  submitted_by_email?: string;
  status: string;
  created_at: string;
}

export interface DriveWebhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  failure_count: number;
  last_triggered_at?: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  success: boolean;
  response_status?: number;
  delivered_at: string;
}

export interface DriveApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  content_type: string;
  category?: string;
  is_public: boolean;
  use_count: number;
  variables?: Array<{ name: string; type: string; default?: string; required?: boolean }>;
}

export interface VaultStatus {
  is_locked: boolean;
  vault_folder_id?: string;
  lock_timeout_minutes: number;
  last_accessed?: string;
}

export interface DlpRule {
  id: string;
  name: string;
  description?: string;
  patterns: Array<{ type: string; value: string; label: string }>;
  action: string;
  is_active: boolean;
}

export interface DlpViolation {
  id: string;
  rule_name: string;
  file_name: string;
  file_id: string;
  matched_patterns: string[];
  action_taken: string;
  detected_at: string;
}

export interface DriveSnapshot {
  id: string;
  snapshot_at: string;
  file_count: number;
  total_size: number;
}

export interface SharingAnalytics {
  period_days: number;
  total_shares: number;
  active_links: number;
  total_downloads: number;
  action_breakdown: Record<string, number>;
  external_shares: number;
  internal_shares: number;
  top_shared_file_ids: string[];
}

export interface StorageTrend {
  date: string;
  file_count: number;
  total_size: number;
}

export interface FileLifecycle {
  total_files: number;
  stale_files_90d: number;
  by_type: Array<{ content_type: string; count: number; total_size: number }>;
}

export interface FilePresenceUser {
  name: string;
  connected_at: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMENT THREADS
// ══════════════════════════════════════════════════════════════════════════════

export function useThreadedComments(fileId: string) {
  return useQuery({
    queryKey: ["drive", "comments", "threaded", fileId],
    queryFn: () => apiClient.get(`${BASE}/files/${fileId}/comments/threaded`).then(r => r.data as { threads: CommentThread[]; total: number }),
    enabled: !!fileId,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { fileId: string; content: string; parentId?: string }) =>
      apiClient.post(`${BASE}/files/${vars.fileId}/comments`, { content: vars.content, parent_id: vars.parentId }).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["drive", "comments", "threaded", vars.fileId] });
    },
  });
}

export function useResolveComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { commentId: string; fileId: string }) =>
      apiClient.put(`${BASE}/comments/${vars.commentId}/resolve`).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["drive", "comments", "threaded", vars.fileId] });
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// FILE PRESENCE
// ══════════════════════════════════════════════════════════════════════════════

export function useFilePresence(fileId: string) {
  return useQuery({
    queryKey: ["drive", "presence", fileId],
    queryFn: () => apiClient.get(`${BASE}/files/${fileId}/presence`).then(r => r.data as { file_id: string; users: FilePresenceUser[] }),
    enabled: !!fileId,
    refetchInterval: 10000, // Refresh every 10s as fallback
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// FILE REQUESTS
// ══════════════════════════════════════════════════════════════════════════════

export function useFileRequests() {
  return useQuery({
    queryKey: ["drive", "file-requests"],
    queryFn: () => apiClient.get(`${BASE}/file-requests`).then(r => r.data as { requests: FileRequest[] }),
  });
}

export function useCreateFileRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      deadline?: string;
      required_types?: string[];
      max_file_size?: number;
      max_files?: number;
      folder_id?: string;
      branding_json?: Record<string, unknown>;
    }) => apiClient.post(`${BASE}/file-requests`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "file-requests"] }),
  });
}

export function useDeactivateFileRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      apiClient.delete(`${BASE}/file-requests/${requestId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "file-requests"] }),
  });
}

export function useFileRequestSubmissions(requestId: string) {
  return useQuery({
    queryKey: ["drive", "file-requests", requestId, "submissions"],
    queryFn: () => apiClient.get(`${BASE}/file-requests/${requestId}/submissions`).then(r => r.data as { submissions: FileRequestSubmission[] }),
    enabled: !!requestId,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARING ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

export function useSharingAnalytics(days = 30) {
  return useQuery({
    queryKey: ["drive", "sharing-analytics", days],
    queryFn: () => apiClient.get(`${BASE}/sharing-analytics`, { params: { days } }).then(r => r.data as SharingAnalytics),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ══════════════════════════════════════════════════════════════════════════════

export function useDriveWebhooks() {
  return useQuery({
    queryKey: ["drive", "webhooks"],
    queryFn: () => apiClient.get(`${BASE}/webhooks`).then(r => r.data as { webhooks: DriveWebhook[] }),
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { url: string; events: string[]; secret?: string }) =>
      apiClient.post(`${BASE}/webhooks`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "webhooks"] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) =>
      apiClient.delete(`${BASE}/webhooks/${webhookId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "webhooks"] }),
  });
}

export function useWebhookDeliveries(webhookId: string) {
  return useQuery({
    queryKey: ["drive", "webhooks", webhookId, "deliveries"],
    queryFn: () => apiClient.get(`${BASE}/webhooks/${webhookId}/deliveries`).then(r => r.data as { deliveries: WebhookDelivery[] }),
    enabled: !!webhookId,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// API KEYS
// ══════════════════════════════════════════════════════════════════════════════

export function useDriveApiKeys() {
  return useQuery({
    queryKey: ["drive", "api-keys"],
    queryFn: () => apiClient.get(`${BASE}/api-keys`).then(r => r.data as { keys: DriveApiKey[] }),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; scopes?: string[]; expires_in_days?: number }) =>
      apiClient.post(`${BASE}/api-keys`, data).then(r => r.data as DriveApiKey & { key: string }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "api-keys"] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      apiClient.delete(`${BASE}/api-keys/${keyId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "api-keys"] }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

export function useDocumentTemplates(category?: string) {
  return useQuery({
    queryKey: ["drive", "templates", category],
    queryFn: () => apiClient.get(`${BASE}/templates`, { params: { category } }).then(r => r.data as { templates: DocumentTemplate[] }),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      content_type: string;
      minio_key: string;
      category?: string;
      is_public?: boolean;
      variables_json?: unknown[];
    }) => apiClient.post(`${BASE}/templates`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "templates"] }),
  });
}

export function useUseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { templateId: string; folderId?: string; fileName?: string }) =>
      apiClient.post(`${BASE}/templates/${vars.templateId}/use`, null, {
        params: { folder_id: vars.folderId, file_name: vars.fileName },
      }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "files"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      apiClient.delete(`${BASE}/templates/${templateId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "templates"] }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PERSONAL VAULT
// ══════════════════════════════════════════════════════════════════════════════

export function useVaultStatus() {
  return useQuery({
    queryKey: ["drive", "vault"],
    queryFn: () => apiClient.get(`${BASE}/vault`).then(r => r.data as VaultStatus),
  });
}

export function useUnlockVault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      apiClient.post(`${BASE}/vault/unlock`, { password }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "vault"] }),
  });
}

export function useLockVault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post(`${BASE}/vault/lock`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "vault"] }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// POINT-IN-TIME RESTORE
// ══════════════════════════════════════════════════════════════════════════════

export function useDriveSnapshots() {
  return useQuery({
    queryKey: ["drive", "snapshots"],
    queryFn: () => apiClient.get(`${BASE}/snapshots`).then(r => r.data as { snapshots: DriveSnapshot[] }),
  });
}

export function useRestoreSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) =>
      apiClient.post(`${BASE}/snapshots/${snapshotId}/restore`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive", "folders"] });
      qc.invalidateQueries({ queryKey: ["drive", "files"] });
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// DLP (Admin)
// ══════════════════════════════════════════════════════════════════════════════

export function useDlpRules() {
  return useQuery({
    queryKey: ["drive", "dlp-rules"],
    queryFn: () => apiClient.get(`${BASE}/admin/dlp-rules`).then(r => r.data as { rules: DlpRule[] }),
  });
}

export function useCreateDlpRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      patterns: Array<{ type: string; value: string; label: string }>;
      action?: string;
      notify_admin?: boolean;
    }) => apiClient.post(`${BASE}/admin/dlp-rules`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "dlp-rules"] }),
  });
}

export function useDeleteDlpRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      apiClient.delete(`${BASE}/admin/dlp-rules/${ruleId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "dlp-rules"] }),
  });
}

export function useDlpViolations(days = 30) {
  return useQuery({
    queryKey: ["drive", "dlp-violations", days],
    queryFn: () => apiClient.get(`${BASE}/admin/dlp-violations`, { params: { days } }).then(r => r.data as { violations: DlpViolation[] }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// eDISCOVERY (Admin)
// ══════════════════════════════════════════════════════════════════════════════

export interface EDiscoveryFile {
  id: string;
  name: string;
  owner_id: string;
  content_type: string;
  size: number;
  sensitivity_level?: string;
  is_on_hold: boolean;
  folder_path?: string;
  created_at: string;
}

export function useEDiscoverySearch(params: {
  query?: string;
  owner_id?: string;
  content_type?: string;
  date_from?: string;
  date_to?: string;
  sensitivity?: string;
  limit?: number;
}, enabled = false) {
  return useQuery({
    queryKey: ["drive", "ediscovery", params],
    queryFn: () => apiClient.get(`${BASE}/admin/ediscovery/search`, { params }).then(r => r.data as { total: number; files: EDiscoveryFile[] }),
    enabled,
  });
}

export function useToggleLegalHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { fileId: string; hold: boolean }) =>
      apiClient.post(`${BASE}/admin/ediscovery/hold/${vars.fileId}`, null, { params: { hold: vars.hold } }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "ediscovery"] }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

export function useStorageTrends(days = 30) {
  return useQuery({
    queryKey: ["drive", "analytics", "storage-trends", days],
    queryFn: () => apiClient.get(`${BASE}/analytics/storage-trends`, { params: { days } }).then(r => r.data as { trends: StorageTrend[]; period_days: number }),
  });
}

export function useUserActivityAnalytics(days = 30) {
  return useQuery({
    queryKey: ["drive", "analytics", "user-activity", days],
    queryFn: () => apiClient.get(`${BASE}/analytics/user-activity`, { params: { days } }).then(r => r.data as { activity: Record<string, number>; period_days: number }),
  });
}

export function useFileLifecycleAnalytics() {
  return useQuery({
    queryKey: ["drive", "analytics", "file-lifecycle"],
    queryFn: () => apiClient.get(`${BASE}/analytics/file-lifecycle`).then(r => r.data as FileLifecycle),
  });
}

export function useRansomwareStatus() {
  return useQuery({
    queryKey: ["drive", "ransomware-status"],
    queryFn: () => apiClient.get(`${BASE}/admin/ransomware-status`).then(r => r.data),
    refetchInterval: 60000,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// DELTA CHANGE FEED (sync clients)
// ══════════════════════════════════════════════════════════════════════════════

export interface DriveChange {
  sequence_id: number
  operation: string
  entity_type: string
  entity_id: string
  entity_name?: string
  metadata_json?: Record<string, unknown>
  changed_at: string
}

export function useDriveChanges(cursor = 0, enabled = false) {
  return useQuery({
    queryKey: ["drive", "changes", cursor],
    queryFn: () =>
      apiClient.get(`${BASE}/changes`, { params: { cursor } }).then(r => r.data as { changes: DriveChange[]; next_cursor: number; has_more: boolean }),
    enabled,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// AI AUTO-LINKS
// ══════════════════════════════════════════════════════════════════════════════

export interface DriveAutoLink {
  id: string
  file_id: string
  module_name: string
  entity_type: string
  entity_id: string
  entity_name?: string
  confidence_score?: number
  status: string
  suggested_at: string
}

export function useFileAutoLinks(fileId: string) {
  return useQuery({
    queryKey: ["drive", "auto-links", fileId],
    queryFn: () =>
      apiClient.get(`${BASE}/files/${fileId}/auto-links`).then(r => r.data as { links: DriveAutoLink[] }),
    enabled: !!fileId,
  })
}

export function useSuggestAutoLinks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) =>
      apiClient.post(`${BASE}/files/${fileId}/suggest-links`).then(r => r.data),
    onSuccess: (_d, fileId) =>
      qc.invalidateQueries({ queryKey: ["drive", "auto-links", fileId] }),
  })
}

export function useAutoLinkAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { fileId: string; linkId: string; action: "confirm" | "dismiss" }) =>
      apiClient.post(`${BASE}/files/${vars.fileId}/auto-links/${vars.linkId}/action`, { action: vars.action }).then(r => r.data),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["drive", "auto-links", vars.fileId] }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTRACT INTELLIGENCE
// ══════════════════════════════════════════════════════════════════════════════

export interface ContractMetadata {
  id: string
  file_id: string
  parties: string[]
  effective_date?: string
  expiry_date?: string
  renewal_date?: string
  contract_value?: number
  currency?: string
  key_obligations?: string[]
  governing_law?: string
  auto_renews?: boolean
  notice_period_days?: number
  confidence_score?: number
  analysed_at?: string
}

export interface UpcomingContract {
  file_id: string
  file_name: string
  expiry_date?: string
  renewal_date?: string
  days_until_expiry?: number
  days_until_renewal?: number
  parties: string[]
  contract_value?: number
  currency?: string
}

export function useContractMetadata(fileId: string) {
  return useQuery({
    queryKey: ["drive", "contract", fileId],
    queryFn: () =>
      apiClient.get(`${BASE}/files/${fileId}/contract`).then(r => r.data as ContractMetadata),
    enabled: !!fileId,
    retry: false,
  })
}

export function useAnalyseContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) =>
      apiClient.post(`${BASE}/files/${fileId}/contract/analyse`).then(r => r.data),
    onSuccess: (_d, fileId) => {
      qc.invalidateQueries({ queryKey: ["drive", "contract", fileId] })
      qc.invalidateQueries({ queryKey: ["drive", "contracts"] })
    },
  })
}

export function useUpcomingContracts(daysAhead = 90) {
  return useQuery({
    queryKey: ["drive", "contracts", daysAhead],
    queryFn: () =>
      apiClient.get(`${BASE}/contracts`, { params: { days_ahead: daysAhead } }).then(r => r.data as { contracts: UpcomingContract[]; total: number }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED TIMELINE
// ══════════════════════════════════════════════════════════════════════════════

export interface TimelineEntry {
  file_id: string
  file_name: string
  content_type: string
  size: number
  link_type: string
  linked_at: string
  created_at: string
}

export function useEntityTimeline(module: string, entityId: string) {
  return useQuery({
    queryKey: ["drive", "timeline", module, entityId],
    queryFn: () =>
      apiClient.get(`${BASE}/timeline/${module}/${entityId}`).then(r => r.data as { entries: TimelineEntry[]; total: number }),
    enabled: !!(module && entityId),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTEXTUAL FILES
// ══════════════════════════════════════════════════════════════════════════════

export function useContextualFiles(module: string, entityId: string) {
  return useQuery({
    queryKey: ["drive", "contextual", module, entityId],
    queryFn: () =>
      apiClient.get(`${BASE}/files/contextual`, { params: { module, entity_id: entityId } }).then(r => r.data as { files: Array<{ file_id: string; file_name: string; relevance_score: number; link_type: string }> }),
    enabled: !!(module && entityId),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR ATTACHMENTS
// ══════════════════════════════════════════════════════════════════════════════

export interface CalendarAttachment {
  id: string
  file_id: string
  file_name: string
  content_type: string
  size: number
  attached_at: string
}

export function useCalendarAttachments(eventId: string) {
  return useQuery({
    queryKey: ["drive", "calendar-attachments", eventId],
    queryFn: () =>
      apiClient.get(`${BASE}/calendar/${eventId}/attachments`).then(r => r.data as { attachments: CalendarAttachment[] }),
    enabled: !!eventId,
  })
}

export function useAttachFileToCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { eventId: string; fileId: string }) =>
      apiClient.post(`${BASE}/calendar/${vars.eventId}/attachments`, { file_id: vars.fileId }).then(r => r.data),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["drive", "calendar-attachments", vars.eventId] }),
  })
}

export function useRemoveCalendarAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { eventId: string; fileId: string }) =>
      apiClient.delete(`${BASE}/calendar/${vars.eventId}/attachments/${vars.fileId}`).then(r => r.data),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["drive", "calendar-attachments", vars.eventId] }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SMART SHARE EXPIRY
// ══════════════════════════════════════════════════════════════════════════════

export function useSmartExpiry(fileId: string) {
  return useQuery({
    queryKey: ["drive", "smart-expiry", fileId],
    queryFn: () =>
      apiClient.get(`${BASE}/files/${fileId}/smart-expiry`).then(r => r.data as { recommended_hours: number; reason: string; sensitivity_level?: string }),
    enabled: !!fileId,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// STORAGE TIER
// ══════════════════════════════════════════════════════════════════════════════

export function useFileTier(fileId: string) {
  return useQuery({
    queryKey: ["drive", "file-tier", fileId],
    queryFn: () =>
      apiClient.get(`${BASE}/files/${fileId}/tier`).then(r => r.data as { file_id: string; tier: string; moved_at?: string; access_count_30d: number }),
    enabled: !!fileId,
  })
}

export function useSetFileTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { fileId: string; tier: string }) =>
      apiClient.post(`${BASE}/files/${vars.fileId}/tier`, { tier: vars.tier }).then(r => r.data),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["drive", "file-tier", vars.fileId] }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: USERS STORAGE
// ══════════════════════════════════════════════════════════════════════════════

export interface UserStorageRow {
  user_id: string
  email: string
  full_name: string
  file_count: number
  total_size: number
  last_upload: string | null
}

export function useAdminUsersStorage(limit = 50) {
  return useQuery({
    queryKey: ["drive", "admin", "users-storage", limit],
    queryFn: () =>
      apiClient.get(`${BASE}/admin/drive/users-storage`, { params: { limit } }).then(r => r.data as { users: UserStorageRow[]; total: number }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: ANOMALY ALERTS
// ══════════════════════════════════════════════════════════════════════════════

export interface AnomalyAlert {
  id: string
  user_id: string
  user_email: string
  alert_type: string
  severity: string
  details: Record<string, unknown>
  is_resolved: boolean
  detected_at: string
}

export function useAnomalyAlerts(unresolvedOnly = false, days = 30) {
  return useQuery({
    queryKey: ["drive", "admin", "anomaly-alerts", unresolvedOnly, days],
    queryFn: () =>
      apiClient.get(`${BASE}/admin/drive/anomaly-alerts`, { params: { days, unresolved_only: unresolvedOnly } }).then(r => r.data as { alerts: AnomalyAlert[]; total: number }),
  })
}

export function useResolveAnomalyAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (alertId: string) =>
      apiClient.post(`${BASE}/admin/drive/anomaly-alerts/${alertId}/resolve`).then(r => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["drive", "admin", "anomaly-alerts"] }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: BACKUP RULES
// ══════════════════════════════════════════════════════════════════════════════

export interface AutoBackupRule {
  id: string
  folder_id: string
  folder_name?: string
  schedule_cron: string
  destination?: string
  retention_count: number
  is_active: boolean
  last_run?: string
}

export function useBackupRules() {
  return useQuery({
    queryKey: ["drive", "backup-rules"],
    queryFn: () =>
      apiClient.get(`${BASE}/backup-rules`).then(r => r.data as { rules: AutoBackupRule[] }),
  })
}

export function useCreateBackupRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { folder_id: string; schedule_cron: string; destination?: string; retention_count?: number }) =>
      apiClient.post(`${BASE}/backup-rules`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "backup-rules"] }),
  })
}

export function useDeleteBackupRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ruleId: string) =>
      apiClient.delete(`${BASE}/backup-rules/${ruleId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "backup-rules"] }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: GUEST USERS
// ══════════════════════════════════════════════════════════════════════════════

export interface DriveGuestUser {
  id: string
  email: string
  name?: string
  share_id: string
  access_count: number
  last_access?: string
  is_revoked: boolean
  created_at: string
}

export function useGuestUsers() {
  return useQuery({
    queryKey: ["drive", "admin", "guests"],
    queryFn: () =>
      apiClient.get(`${BASE}/sharing/guests`).then(r => r.data as { guests: DriveGuestUser[]; total: number }),
  })
}

export function useRevokeGuestAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (guestId: string) =>
      apiClient.delete(`${BASE}/sharing/guests/${guestId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "admin", "guests"] }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: CONTENT TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface DriveContentType {
  id: string
  name: string
  description?: string
  required_fields: Array<{ name: string; type: string; required?: boolean }>
  is_active: boolean
}

export function useContentTypes() {
  return useQuery({
    queryKey: ["drive", "admin", "content-types"],
    queryFn: () =>
      apiClient.get(`${BASE}/admin/drive/content-types`).then(r => r.data as { content_types: DriveContentType[] }),
  })
}

export function useCreateContentType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; required_fields?: Array<{ name: string; type: string; required?: boolean }> }) =>
      apiClient.post(`${BASE}/admin/drive/content-types`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive", "admin", "content-types"] }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// FILE ROUTE (AI module routing)
// ══════════════════════════════════════════════════════════════════════════════

export function useRouteFile() {
  return useMutation({
    mutationFn: (fileId: string) =>
      apiClient.post(`${BASE}/files/${fileId}/route`).then(r => r.data as { file_id: string; detected_module?: string; confidence: number; action_taken: string; message: string }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// FILE DUPLICATES
// ══════════════════════════════════════════════════════════════════════════════

export interface DuplicateFile {
  file_id: string
  file_name: string
  similarity: number
  type: "exact" | "near"
}

export function useFileDuplicates(fileId: string) {
  return useQuery({
    queryKey: ["drive", "duplicates", fileId],
    queryFn: () =>
      apiClient.get(`${BASE}/files/${fileId}/duplicates`).then(r => r.data as { file_id: string; duplicates: DuplicateFile[] }),
    enabled: !!fileId,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE FOLDER AUTO-CREATION
// ══════════════════════════════════════════════════════════════════════════════

export function useEnsureModuleFolder() {
  return useMutation({
    mutationFn: (vars: { module: "hr" | "manufacturing" | "supply-chain"; entityId: string }) => {
      const path = vars.module === "hr"
        ? `${BASE}/modules/hr/employees/${vars.entityId}/folder`
        : vars.module === "manufacturing"
          ? `${BASE}/modules/manufacturing/work-orders/${vars.entityId}/folder`
          : `${BASE}/modules/supply-chain/pos/${vars.entityId}/folder`
      return apiClient.post(path).then(r => r.data)
    },
  })
}
