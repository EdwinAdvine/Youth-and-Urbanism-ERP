import { useState } from 'react'

interface ShareEntry {
  id: string
  email: string
  permission: 'view' | 'edit' | 'manage'
}

interface CalendarShareDialogProps {
  open: boolean
  onClose: () => void
  calendarName?: string
}

export default function CalendarShareDialog({
  open,
  onClose,
  calendarName = 'My Calendar',
}: CalendarShareDialogProps) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit' | 'manage'>('view')
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const handleAdd = () => {
    const trimmed = email.trim()
    if (!trimmed) return
    if (shares.some((s) => s.email === trimmed)) return

    setShares((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), email: trimmed, permission },
    ])
    setEmail('')
  }

  const handleRemove = (id: string) => {
    setShares((prev) => prev.filter((s) => s.id !== id))
  }

  const handlePermissionChange = (id: string, newPerm: 'view' | 'edit' | 'manage') => {
    setShares((prev) =>
      prev.map((s) => (s.id === id ? { ...s, permission: newPerm } : s))
    )
  }

  const handleCopyLink = () => {
    const link = `${window.location.origin}/calendar/shared/${Math.random().toString(36).slice(2, 10)}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Share Calendar</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{calendarName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Add people */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">
              Share with people
            </label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'view' | 'edit' | 'manage')}
                className="px-2 py-2 text-xs border border-gray-200 rounded-[8px] focus:outline-none"
              >
                <option value="view">View</option>
                <option value="edit">Edit</option>
                <option value="manage">Manage</option>
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

          {/* Shared with list */}
          {shares.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Shared with
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-[8px]"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#51459d]/10 text-[#51459d] flex items-center justify-center text-xs font-bold shrink-0">
                      {share.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-700 flex-1 truncate">{share.email}</span>
                    <select
                      value={share.permission}
                      onChange={(e) =>
                        handlePermissionChange(share.id, e.target.value as 'view' | 'edit' | 'manage')
                      }
                      className="text-[10px] border border-gray-200 rounded-[4px] px-1 py-0.5 focus:outline-none"
                    >
                      <option value="view">View</option>
                      <option value="edit">Edit</option>
                      <option value="manage">Manage</option>
                    </select>
                    <button
                      onClick={() => handleRemove(share.id)}
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

          {/* Share link */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Or share a link</p>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-gray-600">Copy shareable link</span>
                </>
              )}
            </button>
          </div>
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
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
