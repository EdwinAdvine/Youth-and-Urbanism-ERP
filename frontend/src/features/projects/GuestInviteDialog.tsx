import { useState } from 'react'
import { useGuests, useInviteGuest, useRevokeGuest } from '@/api/projects_guests'

interface GuestInviteDialogProps {
  projectId: string
  open: boolean
  onClose: () => void
}

const DEFAULT_PERMISSIONS = {
  can_comment: true,
  can_view_tasks: true,
  can_edit_tasks: false,
}

export function GuestInviteDialog({ projectId, open, onClose }: GuestInviteDialogProps) {
  const [email, setEmail] = useState('')
  const [permissions, setPermissions] = useState({ ...DEFAULT_PERMISSIONS })
  const [expiresAt, setExpiresAt] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const { data: guests = [], isLoading } = useGuests(projectId)
  const inviteGuest = useInviteGuest(projectId)
  const revokeGuest = useRevokeGuest(projectId)

  if (!open) return null

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    await inviteGuest.mutateAsync({
      email: email.trim(),
      permissions,
      expires_at: expiresAt || null,
    })
    setEmail('')
    setExpiresAt('')
    setPermissions({ ...DEFAULT_PERMISSIONS })
  }

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/projects/guest-view/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRevoke = (guestId: string) => {
    if (confirm('Revoke this guest invitation? The link will stop working immediately.')) {
      revokeGuest.mutate(guestId)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Guest Access</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="guest@example.com"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            <div className="space-y-2">
              {Object.entries(permissions).map(([key, val]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={e => setPermissions(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="accent-[#51459d]"
                  />
                  {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expires at (optional)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            />
          </div>

          <button
            type="submit"
            disabled={inviteGuest.isPending}
            className="w-full bg-[#51459d] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#51459d]/90 disabled:opacity-50"
          >
            {inviteGuest.isPending ? 'Sending invite…' : 'Send Invitation'}
          </button>
        </form>

        {/* Existing guests */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Current Guests ({guests.length})</h3>
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : guests.length === 0 ? (
            <p className="text-sm text-gray-400">No guests invited yet.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {guests.map(g => (
                <li key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{g.email}</p>
                    {g.expires_at && (
                      <p className="text-xs text-gray-400">
                        Expires {new Date(g.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button
                      onClick={() => handleCopyLink(g.token)}
                      className="text-xs text-[#51459d] hover:text-[#51459d]/80 font-medium"
                    >
                      {copied === g.token ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      onClick={() => handleRevoke(g.id)}
                      disabled={revokeGuest.isPending}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
