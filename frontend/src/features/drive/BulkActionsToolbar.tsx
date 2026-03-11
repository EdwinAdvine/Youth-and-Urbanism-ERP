import { useState } from 'react'
import {
  useBulkDeleteFiles,
  useBulkMoveFiles,
  useDownloadFile,
  useDriveFolders,
} from '../../api/drive'

interface BulkActionsToolbarProps {
  selectedIds: string[]
  onClearSelection: () => void
  onShareSelected?: () => void
}

export default function BulkActionsToolbar({
  selectedIds,
  onClearSelection,
  onShareSelected,
}: BulkActionsToolbarProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const bulkDelete = useBulkDeleteFiles()
  const bulkMove = useBulkMoveFiles()
  const downloadFile = useDownloadFile()
  const { data: foldersData } = useDriveFolders()
  const folders = foldersData?.folders ?? []

  if (selectedIds.length === 0) return null

  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedIds.length} selected item(s)?`)) return
    bulkDelete.mutate(selectedIds, {
      onSuccess: () => onClearSelection(),
    })
  }

  const handleBulkDownload = async () => {
    for (const id of selectedIds) {
      try {
        const result = await downloadFile.mutateAsync(id)
        window.open(result.download_url, '_blank')
      } catch {
        // skip failed downloads
      }
    }
  }

  const handleMove = (folderId: string) => {
    bulkMove.mutate(
      { fileIds: selectedIds, folderId },
      { onSuccess: () => { onClearSelection(); setShowMoveMenu(false) } },
    )
  }

  return (
    <div className="bg-[#51459d] text-white px-5 py-2.5 flex items-center gap-3 shrink-0 animate-in slide-in-from-top">
      {/* Selection count */}
      <div className="flex items-center gap-2">
        <button
          onClick={onClearSelection}
          className="p-1 hover:bg-white/20 rounded-[6px] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm font-medium">
          {selectedIds.length} selected
        </span>
      </div>

      <div className="h-5 w-px bg-white/30" />

      {/* Actions */}
      <button
        onClick={handleBulkDownload}
        disabled={downloadFile.isPending}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 hover:bg-white/20 rounded-[8px] transition-colors disabled:opacity-50"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download
      </button>

      <div className="relative">
        <button
          onClick={() => setShowMoveMenu(!showMoveMenu)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 hover:bg-white/20 rounded-[8px] transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Move to
          <svg className={`h-3 w-3 transition-transform ${showMoveMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMoveMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowMoveMenu(false)} />
            <div className="absolute top-full left-0 mt-1 z-40 bg-white border border-gray-200 rounded-[8px] shadow-lg py-1 w-48 max-h-48 overflow-y-auto">
              {folders.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">No folders available</p>
              ) : (
                folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMove(folder.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {folder.name}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {onShareSelected && (
        <button
          onClick={onShareSelected}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 hover:bg-white/20 rounded-[8px] transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      )}

      <button
        onClick={handleBulkDelete}
        disabled={bulkDelete.isPending}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 hover:bg-red-500/80 bg-red-500/40 rounded-[8px] transition-colors disabled:opacity-50 ml-auto"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </button>
    </div>
  )
}
