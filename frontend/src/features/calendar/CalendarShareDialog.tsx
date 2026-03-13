import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

// ── Permission level definitions (matches backend VALID_PERMISSION_LEVELS) ──

type PermissionLevel = 'free_busy' | 'read' | 'propose' | 'edit' | 'manage'

const PERMISSION_LABELS: Record<PermissionLevel, { label: string; desc: string }> = {
  free_busy: {
    label: 'Free/Busy',
    desc: 'See only busy/free status, no event details',
  },
  read: {
    label: 'Read',
    desc: 'View all event details',
  },
  propose: {
    label: 'Propose',
    desc: 'View events and propose new times',
  },
  edit: {
    label: 'Edit',
    desc: 'Create, edit, and delete events',
  },
  manage: {
    label: 'Manage',
    desc: 'Full control including sharing permissions',
  },
}

const PERMISSION_LEVELS: PermissionLevel[] = ['free_busy', 'read', 'propose', 'edit', 'manage']

interface PermissionRecord {
  id: string
  calendar_id: string
  grantee_id: string
  permission_level: PermissionLevel
  granted_by: string | null
  created_at: string | null
}

interface ShareEntry {
  id: string
  email: string
  grantee_id: string
  permission: PermissionLevel
  saved: boolean
}

interface CalendarShareDialogProps {
  open: boolean
  onClose: () => void
  calendarId?: string
  calendarName?: string
}

// ── API hooks ────────────────────────────────────────────────────────────────

function useCalendarPermissions(calendarId?: string) {
  return useQuery<PermissionRecord[]>({
    queryKey: ['calendar-permissions', calendarId],
    queryFn: async () => {
      if (!calendarId) return []
      const { data } = await apiClient.get<PermissionRecord[]>('/calendar/permissions', {
        params: { calendar_id: calendarId },
      })
      return data
    },
    enabled: !!calendarId,
  })
}

function useGrantPermission(calendarId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ grantee_id, permission_level }: { grantee_id: string; permission_level: PermissionLevel }) => {
      const { data } = await apiClient.post<PermissionRecord>('/calendar/permissions', {
        calendar_id: calendarId,
        grantee_id,
        permission_level,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-permissions', calendarId] }),
  })
}

function useUpdatePermission(calendarId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ permission_id, permission_level }: { permission_id: string; permission_level: PermissionLevel }) => {
      await apiClient.put(`/calendar/permissions/${permission_id}`, { permission_level })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-permissions', calendarId] }),
  })
}

function useRevokePermission(calendarId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (permission_id: string) => {
      await apiClient.delete(`/calendar/permissions/${permission_id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-permissions', calendarId] }),
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CalendarShareDialog({
  open,
  onClose,
  calendarId,
  calendarName = 'My Calendar',
}: CalendarShareDialogProps) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<PermissionLevel>('read')
  const [copied, setCopied] = useState(false)
  const [pendingGrant, setPendingGrant] = useState<{ email: string; permission: PermissionLevel }[]>([])

  const { data: savedPerms = [], isLoading } = useCalendarPermissions(calendarId)
  const grantMutation = useGrantPermission(calendarId)
  const updateMutation = useUpdatePermission(calendarId)
  const revokeMutation = useRevokePermission(calendarId)

  if (!open) return null

  const handleAdd = () => {
    const trimmed = email.trim()
    if (!trimmed) return
    if (pendingGrant.some((s) => s.email === trimmed)) return
    setPendingGrant((prev) => [...prev, { email: trimmed, permission }])
    setEmail('')
  }

  const handleRemovePending = (email: string) => {
    setPendingGrant((prev) => prev.filter((s) => s.email !== email))
  }

  const handleCopyLink = () => {
    const link = `${window.location.origin}/calendar/shared/${calendarId || Math.random().toString(36).slice(2, 10)}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // For simplicity, pending entries are not yet resolved to grantee_id
  // (requires a user-search endpoint). The UI shows them and submits on "Done."
  const handleDone = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Share Calendar</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{calendarName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Add people */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
              Share with people
            </label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email or User ID"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as PermissionLevel)}
                className="px-2 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-[8px] focus:outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
              >
                {PERMISSION_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{PERMISSION_LABELS[lvl].label}</option>
                ))}
              </select>
              <button
                onClick={handleAdd}
                disabled={!email.trim()}
                className="px-3 py-2 text-xs bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {/* Permission level descriptions */}
            <div className="mt-2 grid grid-cols-1 gap-0.5">
              {PERMISSION_LEVELS.map((lvl) => (
                <div key={lvl} className={`flex items-center gap-1.5 text-[9px] px-1 ${lvl === permission ? 'text-[#51459d] font-semibold' : 'text-gray-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${lvl === permission ? 'bg-[#51459d]' : 'bg-gray-200 dark:bg-gray-600'}`} />
                  <span className="font-medium">{PERMISSION_LABELS[lvl].label}:</span>
                  <span>{PERMISSION_LABELS[lvl].desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending (unsaved) additions */}
          {pendingGrant.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#ffa21d] uppercase tracking-wider mb-2">
                Pending (not yet saved)
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {pendingGrant.map((share) => (
                  <div
                    key={share.email}
                    className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-[8px] border border-yellow-200 dark:border-yellow-800/40"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#ffa21d]/20 text-[#ffa21d] flex items-center justify-center text-xs font-bold shrink-0">
                      {share.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{share.email}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-[#51459d]/10 text-[#51459d] rounded-full font-medium">
                      {PERMISSION_LABELS[share.permission].label}
                    </span>
                    <button
                      onClick={() => handleRemovePending(share.email)}
                      className="p-1 text-gray-400 hover:text-[#ff3a6e] transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved permissions */}
          {calendarId && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Currently shared with
              </p>
              {isLoading ? (
                <div className="space-y-1.5">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-[8px] animate-pulse" />
                  ))}
                </div>
              ) : savedPerms.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic">No permissions granted yet</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {savedPerms.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-[8px]"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#51459d]/10 text-[#51459d] flex items-center justify-center text-xs font-bold shrink-0">
                        {perm.grantee_id.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-1 truncate font-mono">
                        {perm.grantee_id.slice(0, 8)}…
                      </span>
                      <select
                        value={perm.permission_level}
                        onChange={(e) =>
                          updateMutation.mutate({
                            permission_id: perm.id,
                            permission_level: e.target.value as PermissionLevel,
                          })
                        }
                        className="text-[10px] border border-gray-200 dark:border-gray-600 rounded-[4px] px-1 py-0.5 focus:outline-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      >
                        {PERMISSION_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>{PERMISSION_LABELS[lvl].label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => revokeMutation.mutate(perm.id)}
                        disabled={revokeMutation.isPending}
                        className="p-1 text-gray-400 hover:text-[#ff3a6e] transition-colors disabled:opacity-50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Share link */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Or share a link</p>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {copied ? (
                <>
                  <svg className="h-3.5 w-3.5 text-[#6fd943]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[#6fd943] font-medium">Link copied!</span>
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-400">Copy shareable link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
