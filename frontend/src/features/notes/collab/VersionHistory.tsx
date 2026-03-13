import { useState } from 'react'
import { useNoteVersions, useCreateVersion, useRestoreVersion, type NoteVersion } from '../../../api/noteCollab'

function VersionCard({ version, onRestore, isRestoring }: {
  version: NoteVersion
  onRestore: () => void
  isRestoring: boolean
}) {
  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-[8px] p-3 mb-2">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              v{version.version_number}
            </span>
            {version.label && (
              <span className="text-[10px] px-1.5 py-0.5 bg-[#51459d]/10 text-[#51459d] rounded-full truncate max-w-[120px]">
                {version.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <span>{version.created_by_name ?? 'Unknown'}</span>
            <span>·</span>
            <span>{new Date(version.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            {version.word_count > 0 && (
              <>
                <span>·</span>
                <span>{version.word_count} words</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onRestore}
          disabled={isRestoring}
          className="ml-2 text-[10px] px-2 py-1 border border-[#51459d] text-[#51459d] rounded-[6px] hover:bg-[#51459d] hover:text-white transition-colors disabled:opacity-50 shrink-0"
        >
          {isRestoring ? 'Restoring...' : 'Restore'}
        </button>
      </div>
    </div>
  )
}

export default function VersionHistory({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const { data: versions = [], isLoading } = useNoteVersions(noteId)
  const createVersion = useCreateVersion(noteId)
  const restoreVersion = useRestoreVersion(noteId)
  const [labelInput, setLabelInput] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const handleSaveVersion = async () => {
    await createVersion.mutateAsync(labelInput || undefined)
    setLabelInput('')
    setShowSave(false)
  }

  const handleRestore = async (versionId: string) => {
    if (!window.confirm('Restore this version? Current content will be replaced.')) return
    setRestoringId(versionId)
    await restoreVersion.mutateAsync(versionId)
    setRestoringId(null)
    onClose()
  }

  return (
    <div className="w-72 border-l border-gray-100 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Version History</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Save version prompt */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
        {showSave ? (
          <div className="space-y-1.5">
            <input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Version label (optional)"
              className="w-full text-[11px] px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-[6px] focus:outline-none focus:border-[#51459d] bg-transparent"
              autoFocus
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleSaveVersion}
                disabled={createVersion.isPending}
                className="flex-1 py-1.5 text-[11px] bg-[#51459d] text-white rounded-[6px] hover:bg-[#3d3480] disabled:opacity-50"
              >
                {createVersion.isPending ? 'Saving...' : 'Save Version'}
              </button>
              <button onClick={() => setShowSave(false)} className="px-2 text-[11px] text-gray-400">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowSave(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-[#51459d] hover:bg-[#51459d]/5 rounded-[6px] transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Save current version
          </button>
        )}
      </div>

      {/* Versions list */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <svg className="animate-spin h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">🕐</div>
            <p className="text-sm text-gray-400">No saved versions</p>
            <p className="text-[11px] text-gray-300 mt-1">Save a version to restore later</p>
          </div>
        ) : (
          versions.map(v => (
            <VersionCard
              key={v.id}
              version={v}
              onRestore={() => handleRestore(v.id)}
              isRestoring={restoringId === v.id}
            />
          ))
        )}
      </div>
    </div>
  )
}
