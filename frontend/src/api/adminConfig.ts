/**
 * Admin Config API client — per-module admin configuration settings (mail, storage, integrations).
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/admin`.
 *
 * Key exports:
 *   - useMailServerConfig()      — read Stalwart SMTP/IMAP server settings
 *   - useUpdateMailConfig()      — update mail server domain or relay config
 *   - useStorageConfig()         — read MinIO bucket and storage settings
 *   - useUpdateStorageConfig()   — update storage endpoint or credentials
 *   - useIntegrationConfig()     — read third-party integration toggles
 *   - useUpdateIntegrationConfig() — enable/disable external integrations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ── Generic config hook factory ─────────────────────────────────────────────

function useAdminConfig<T>(module: string, section: string) {
  return useQuery({
    queryKey: ['admin', module, section],
    queryFn: async () => {
      const { data } = await apiClient.get<T>(`/admin/${module}/${section}`)
      return data
    },
  })
}

function useUpdateAdminConfig<T>(module: string, section: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: T) => {
      const { data } = await apiClient.put<T>(`/admin/${module}/${section}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', module, section] }),
  })
}

// ── Mail Admin ──────────────────────────────────────────────────────────────

export interface MailServerConfig {
  domain: string
  tls_cert_path: string
  tls_key_path: string
  smtp_relay_host: string
  smtp_relay_port: number
  smtp_relay_user: string
  smtp_relay_password: string
  smtp_relay_tls: boolean
}

export interface MailPolicies {
  max_attachment_size_mb: number
  retention_days: number
  allowed_domains: string[]
  blocked_domains: string[]
  max_recipients_per_message: number
}

export interface MailSpamConfig {
  spam_threshold: number
  blocklist: string[]
  allowlist: string[]
  reject_on_spam: boolean
  quarantine_enabled: boolean
}

export interface MailQuotas {
  default_quota_mb: number
  per_user_overrides: Record<string, number>
  warn_at_percent: number
}

export const useMailConfig = () => useAdminConfig<MailServerConfig>('mail', 'config')
export const useUpdateMailConfig = () => useUpdateAdminConfig<MailServerConfig>('mail', 'config')
export const useMailPolicies = () => useAdminConfig<MailPolicies>('mail', 'policies')
export const useUpdateMailPolicies = () => useUpdateAdminConfig<MailPolicies>('mail', 'policies')
export const useMailSpamConfig = () => useAdminConfig<MailSpamConfig>('mail', 'spam')
export const useUpdateMailSpamConfig = () => useUpdateAdminConfig<MailSpamConfig>('mail', 'spam')
export const useMailQuotas = () => useAdminConfig<MailQuotas>('mail', 'quotas')
export const useUpdateMailQuotas = () => useUpdateAdminConfig<MailQuotas>('mail', 'quotas')

// ── Drive Admin ─────────────────────────────────────────────────────────────

export interface DriveQuotas {
  default_storage_quota_mb: number
  per_user_overrides: Record<string, number>
  per_team_overrides: Record<string, number>
  warn_at_percent: number
}

export interface DriveFileTypes {
  allowed_mime_types: string[]
  blocked_mime_types: string[]
  max_file_size_mb: number
}

export interface DriveRetention {
  auto_delete_trash_days: number
  version_retention_count: number
  version_retention_days: number
}

export interface DriveHealth {
  minio_connected: boolean
  minio_url: string
  total_buckets: number
  storage_used_bytes: number
  storage_used_display: string
}

export const useDriveQuotas = () => useAdminConfig<DriveQuotas>('drive', 'quotas')
export const useUpdateDriveQuotas = () => useUpdateAdminConfig<DriveQuotas>('drive', 'quotas')
export const useDriveFileTypes = () => useAdminConfig<DriveFileTypes>('drive', 'file-types')
export const useUpdateDriveFileTypes = () => useUpdateAdminConfig<DriveFileTypes>('drive', 'file-types')
export const useDriveRetention = () => useAdminConfig<DriveRetention>('drive', 'retention')
export const useUpdateDriveRetention = () => useUpdateAdminConfig<DriveRetention>('drive', 'retention')
export const useDriveHealth = () => useAdminConfig<DriveHealth>('drive', 'health')

// ── Docs Admin ──────────────────────────────────────────────────────────────

export interface DocsServerConfig {
  onlyoffice_url: string
  jwt_secret: string
  jwt_header: string
  max_file_size_mb: number
  autosave_enabled: boolean
  autosave_interval_seconds: number
}

export interface DocsTemplates {
  templates: { name: string; type: string; url: string }[]
}

export interface DocsQuotas {
  default_storage_quota_mb: number
  per_user_overrides: Record<string, number>
  max_concurrent_editors: number
}

export interface DocsFileTypes {
  allowed_document_types: string[]
  allowed_image_types: string[]
  enable_pdf_editing: boolean
}

export const useDocsConfig = () => useAdminConfig<DocsServerConfig>('docs', 'config')
export const useUpdateDocsConfig = () => useUpdateAdminConfig<DocsServerConfig>('docs', 'config')
export const useDocsTemplates = () => useAdminConfig<DocsTemplates>('docs', 'templates')
export const useUpdateDocsTemplates = () => useUpdateAdminConfig<DocsTemplates>('docs', 'templates')
export const useDocsQuotas = () => useAdminConfig<DocsQuotas>('docs', 'quotas')
export const useUpdateDocsQuotas = () => useUpdateAdminConfig<DocsQuotas>('docs', 'quotas')
export const useDocsFileTypes = () => useAdminConfig<DocsFileTypes>('docs', 'file-types')
export const useUpdateDocsFileTypes = () => useUpdateAdminConfig<DocsFileTypes>('docs', 'file-types')

// ── Meetings Admin ──────────────────────────────────────────────────────────

export interface MeetingsServerConfig {
  jitsi_url: string
  jwt_app_id: string
  jwt_secret: string
  enable_lobby: boolean
  enable_breakout_rooms: boolean
  require_authentication: boolean
}

export interface MeetingsDefaults {
  max_participants: number
  recording_enabled: boolean
  default_video_quality: string
  default_mute_on_join: boolean
  default_camera_off_on_join: boolean
  max_meeting_duration_minutes: number
  enable_screen_sharing: boolean
  enable_chat: boolean
  enable_raise_hand: boolean
}

export interface MeetingsRecording {
  storage_bucket: string
  auto_delete_after_days: number
  max_recording_size_mb: number
  recording_format: string
  auto_transcribe: boolean
}

export interface LobbySettings {
  logo_url: string
  welcome_message: string
  background_color: string
  require_approval: boolean
}

export interface JitsiTheme {
  primary_color: string
  logo_url: string
  watermark_url: string
  toolbar_buttons: string[]
}

export interface SIPConfig {
  sip_enabled: boolean
  sip_server: string
  sip_username: string
  sip_password: string
  dial_in_number: string
  dial_in_pin_prefix: string
}

export const useMeetingsConfig = () => useAdminConfig<MeetingsServerConfig>('meetings', 'config')
export const useUpdateMeetingsConfig = () => useUpdateAdminConfig<MeetingsServerConfig>('meetings', 'config')
export const useMeetingsDefaults = () => useAdminConfig<MeetingsDefaults>('meetings', 'defaults')
export const useUpdateMeetingsDefaults = () => useUpdateAdminConfig<MeetingsDefaults>('meetings', 'defaults')
export const useMeetingsRecording = () => useAdminConfig<MeetingsRecording>('meetings', 'recording')
export const useUpdateMeetingsRecording = () => useUpdateAdminConfig<MeetingsRecording>('meetings', 'recording')
export const useMeetingsLobby = () => useAdminConfig<LobbySettings>('meetings', 'lobby')
export const useUpdateMeetingsLobby = () => useUpdateAdminConfig<LobbySettings>('meetings', 'lobby')
export const useMeetingsTheme = () => useAdminConfig<JitsiTheme>('meetings', 'theme')
export const useUpdateMeetingsTheme = () => useUpdateAdminConfig<JitsiTheme>('meetings', 'theme')
export const useMeetingsSIP = () => useAdminConfig<SIPConfig>('meetings', 'sip')
export const useUpdateMeetingsSIP = () => useUpdateAdminConfig<SIPConfig>('meetings', 'sip')
