import React, { useState } from 'react'
import {
  useShareFile,
  useShareFolder,
  useFileShares,
  useRevokeShare,
  type FileShare,
  type ShareFilePayload,
} from '../../api/drive'

interface ShareDialogProps {
  itemId: string
  itemName: string
  itemType: 'file' | 'folder'
  onClose: () => void
}

type ShareTab = 'people' | 'link' | 'active'

export default function ShareDialog({ itemId, itemName, itemType, onClose }: ShareDialogProps) {
  const [tab, setTab] = useState<ShareTab>('people')
  const [userId, setUserId] = useState('')
  const [permission, setPermission] = useState('view')
  const [createLink, setCreateLink] = useState(false)
  const [linkPassword, setLinkPassword] = useState('')
  const [noDownload, setNoDownload] = useState(false)
  const [isFileDrop, setIsFileDrop] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [maxDownloads, setMaxDownloads] = useState('')
  const [notifyOnAccess, setNotifyOnAccess] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [lastCreatedShare, setLastCreatedShare] = useState<FileShare | null>(null)

  const shareFile = useShareFile()
  const shareFolder = useShareFolder()
  const revokeShare = useRevokeShare()
  const { data: sharesData, refetch: refetchShares } = useFileShares(
    itemType === 'file' ? itemId : ''
  )

  const handleShare = async () => {
    const payload: ShareFilePayload & { fileId?: string; folderId?: string } = {
      permission,
      create_link: createLink || tab === 'link',
      no_download: noDownload,
      is_file_drop: isFileDrop,
      notify_on_access: notifyOnAccess,
    }
    if (userId.trim()) payload.user_id = userId.trim()
    if (linkPassword.trim()) payload.link_password = linkPassword.trim()
    if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString()
    if (maxDownloads) payload.max_downloads = parseInt(maxDownloads, 10)

    try {
      let result: FileShare
      if (itemType === 'file') {
        result = await shareFile.mutateAsync({ fileId: itemId, ...payload })
      } else {
        result = await shareFolder.mutateAsync({ folderId: itemId, ...payload })
      }
      setLastCreatedShare(result)
      if (result.share_link) {
        const fullLink = `${window.location.origin}/drive/shared/${result.share_link}`
        setCopiedLink(fullLink)
      }
      refetchShares()
    } catch {
      alert('Failed to create share.')
    }
  }

  const handleCopy = () => {
    if (copiedLink) {
      navigator.clipboard.writeText(copiedLink)
    }
  }

  const handleRevoke = async (shareId: string) => {
    if (confirm('Revoke this share?')) {
      await revokeShare.mutateAsync(shareId)
      refetchShares()
    }
  }

  const tabs: { id: ShareTab; label: string; icon: string }[] = [
    { id: 'people', label: 'People', icon: '👤' },
    { id: 'link', label: 'Get Link', icon: '🔗' },
    { id: 'active', label: 'Active Shares', icon: '📋' },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Share "{itemName}"</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {itemType === 'file' ? 'File' : 'Folder'} sharing with enterprise controls
              </p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
                  tab === t.id
                    ? 'text-[#51459d] border-b-2 border-[#51459d]'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {tab === 'people' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Share with user (ID or email)</label>
                  <input
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter user ID…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Permission</label>
                  <select
                    value={permission}
                    onChange={(e) => setPermission(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-white dark:bg-gray-800"
                  >
                    <option value="view">View only</option>
                    <option value="edit">Can edit</option>
                    <option value="delete">Can delete</option>
                    <option value="reshare">Can reshare</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <input type="checkbox" checked={notifyOnAccess} onChange={(e) => setNotifyOnAccess(e.target.checked)} className="rounded" />
                  Notify me when accessed
                </label>

                <button
                  onClick={handleShare}
                  disabled={!userId.trim() || shareFile.isPending || shareFolder.isPending}
                  className="w-full bg-[#51459d] text-white text-sm font-medium py-2.5 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
                >
                  {shareFile.isPending || shareFolder.isPending ? 'Sharing…' : 'Share'}
                </button>
              </>
            )}

            {tab === 'link' && (
              <>
                <div className="bg-[#51459d]/5 rounded-[8px] p-3">
                  <p className="text-xs font-medium text-[#51459d] mb-1">Public Link Settings</p>
                  <p className="text-[10px] text-gray-500">Anyone with the link can access based on the settings below.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Permission</label>
                  <select
                    value={permission}
                    onChange={(e) => setPermission(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-white dark:bg-gray-800"
                  >
                    <option value="view">View only</option>
                    <option value="edit">Can edit</option>
                    <option value="upload_only">Upload only (File Drop)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Link password (optional)</label>
                  <input
                    type="password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="Set a password…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry date (optional)</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Max downloads (optional)</label>
                  <input
                    type="number"
                    value={maxDownloads}
                    onChange={(e) => setMaxDownloads(e.target.value)}
                    placeholder="Unlimited"
                    min="1"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <input type="checkbox" checked={noDownload} onChange={(e) => setNoDownload(e.target.checked)} className="rounded" />
                    Disable downloads (view only in browser)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={isFileDrop}
                      onChange={(e) => {
                        setIsFileDrop(e.target.checked)
                        if (e.target.checked) setPermission('upload_only')
                      }}
                      className="rounded"
                    />
                    File Drop mode (recipients can only upload, not view)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <input type="checkbox" checked={notifyOnAccess} onChange={(e) => setNotifyOnAccess(e.target.checked)} className="rounded" />
                    Notify me when link is accessed
                  </label>
                </div>

                <button
                  onClick={handleShare}
                  disabled={shareFile.isPending || shareFolder.isPending}
                  className="w-full bg-[#51459d] text-white text-sm font-medium py-2.5 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
                >
                  {shareFile.isPending || shareFolder.isPending ? 'Creating link…' : 'Create Share Link'}
                </button>

                {copiedLink && (
                  <div className="bg-green-50 border border-green-200 rounded-[8px] p-3">
                    <p className="text-xs font-medium text-green-800 mb-1">Link created!</p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={copiedLink}
                        className="flex-1 px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-green-200 rounded-[6px] text-gray-700 dark:text-gray-300"
                      />
                      <button
                        onClick={handleCopy}
                        className="shrink-0 px-3 py-1 text-xs bg-green-600 text-white rounded-[6px] hover:bg-green-700 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'active' && (
              <>
                {(!sharesData?.shares || sharesData.shares.length === 0) ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-2xl mb-2">🔒</p>
                    <p className="text-sm">No active shares for this item.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sharesData.shares.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950 rounded-[8px] border border-gray-100 dark:border-gray-800"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {share.share_link ? '🔗' : '👤'}
                            </span>
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                              {share.share_link
                                ? `Public link (${share.permission})`
                                : `User share (${share.permission})`}
                            </span>
                            {share.no_download && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">No DL</span>
                            )}
                            {share.is_file_drop && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">File Drop</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                            {share.expires_at && (
                              <span>Expires: {new Date(share.expires_at).toLocaleDateString()}</span>
                            )}
                            {share.max_downloads && (
                              <span>Downloads: {share.download_count}/{share.max_downloads}</span>
                            )}
                            <span>Created: {new Date(share.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevoke(share.id)}
                          className="shrink-0 ml-3 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-[6px] transition-colors"
                          title="Revoke share"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
