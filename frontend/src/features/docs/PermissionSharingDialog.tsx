import { useState } from 'react'

type PermissionLevel = 'view' | 'comment' | 'edit'

interface ShareRecipient {
  id: string
  name: string
  email: string
  permission: PermissionLevel
}

interface PermissionSharingDialogProps {
  open: boolean
  onClose: () => void
  fileName?: string
  fileId?: string
}

const PERMISSION_CONFIG: Record<PermissionLevel, { label: string; description: string; color: string }> = {
  view:    { label: 'Viewer',    description: 'Can only view',         color: 'bg-gray-100 text-gray-600' },
  comment: { label: 'Commenter', description: 'Can view and comment', color: 'bg-blue-100 text-blue-600' },
  edit:    { label: 'Editor',    description: 'Can view and edit',     color: 'bg-green-100 text-green-600' },
}

export default function PermissionSharingDialog({
  open,
  onClose,
  fileName = 'Untitled Document',
}: PermissionSharingDialogProps) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<PermissionLevel>('view')
  const [recipients, setRecipients] = useState<ShareRecipient[]>([])
  const [linkAccess, setLinkAccess] = useState<'restricted' | 'anyone_view' | 'anyone_edit'>('restricted')
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const [showMessage, setShowMessage] = useState(false)

  if (!open) return null

  const handleAdd = () => {
    const trimmed = email.trim()
    if (!trimmed) return
    if (recipients.some((r) => r.email === trimmed)) return

    setRecipients((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        name: trimmed.split('@')[0],
        email: trimmed,
        permission,
      },
    ])
    setEmail('')
  }

  const handleRemove = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id))
  }

  const handlePermissionChange = (id: string, newPerm: PermissionLevel) => {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, permission: newPerm } : r))
    )
  }

  const handleCopyLink = () => {
    const link = `${window.location.origin}/docs/shared/${Math.random().toString(36).slice(2, 10)}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Share "{fileName}"</h3>
        </div>

        <div className="p-5 space-y-4">
          {/* Add people */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">
              Add people or teams
            </label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email or team name"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as PermissionLevel)}
                className="px-2 py-2 text-xs border border-gray-200 rounded-[8px] focus:outline-none bg-white"
              >
                <option value="view">Viewer</option>
                <option value="comment">Commenter</option>
                <option value="edit">Editor</option>
              </select>
              <button
                onClick={handleAdd}
                disabled={!email.trim()}
                className="px-3 py-2 text-xs bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Optional message */}
          <div>
            <button
              onClick={() => setShowMessage(!showMessage)}
              className="text-[10px] text-[#51459d] hover:underline"
            >
              {showMessage ? 'Hide message' : 'Add a message (optional)'}
            </button>
            {showMessage && (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hey, check out this document..."
                className="mt-2 w-full px-3 py-2 text-xs border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 resize-none"
                rows={2}
              />
            )}
          </div>

          {/* Shared list */}
          {recipients.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                People with access
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {recipients.map((r) => {
                  const cfg = PERMISSION_CONFIG[r.permission]
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-[8px]"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#51459d]/10 text-[#51459d] flex items-center justify-center text-xs font-bold shrink-0">
                        {r.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{r.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{r.email}</p>
                      </div>
                      <select
                        value={r.permission}
                        onChange={(e) => handlePermissionChange(r.id, e.target.value as PermissionLevel)}
                        className={`text-[10px] rounded-full px-2 py-0.5 border-0 font-medium ${cfg.color}`}
                      >
                        <option value="view">Viewer</option>
                        <option value="comment">Commenter</option>
                        <option value="edit">Editor</option>
                      </select>
                      <button
                        onClick={() => handleRemove(r.id)}
                        className="p-1 text-gray-400 hover:text-[#ff3a6e] transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Link access */}
          <div className="border-t border-gray-100 pt-4">
            <label className="text-xs font-medium text-gray-700 block mb-2">
              Link access
            </label>
            <select
              value={linkAccess}
              onChange={(e) => setLinkAccess(e.target.value as typeof linkAccess)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-[8px] focus:outline-none bg-white"
            >
              <option value="restricted">Restricted - Only people added above</option>
              <option value="anyone_view">Anyone with the link can view</option>
              <option value="anyone_edit">Anyone with the link can edit</option>
            </select>
          </div>

          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs border border-gray-200 rounded-[8px] hover:bg-gray-50 transition-colors"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-600">Copy link</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  )
}
