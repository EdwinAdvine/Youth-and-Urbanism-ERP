import { useFileVersions, useRestoreFileVersion, formatFileSize } from '../../api/drive'

interface Props {
  fileId: string
  fileName: string
  onClose: () => void
}

export default function FileVersionsPanel({ fileId, fileName, onClose }: Props) {
  const { data: versionsData, isLoading } = useFileVersions(fileId)
  const restoreVersion = useRestoreFileVersion()
  const versions = versionsData?.versions ?? []

  const handleRestore = (versionId: string) => {
    if (!confirm('Restore this version? The current version will be replaced.')) return
    restoreVersion.mutate({ fileId, versionId })
  }

  return (
    <div className="w-80 border-l border-gray-100 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">Version History</h3>
          <p className="text-[11px] text-gray-400 truncate mt-0.5">{fileName}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-[6px] text-gray-400 shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Versions list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <svg className="h-8 w-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-400">No version history available</p>
            <p className="text-xs text-gray-300 mt-1">Versions are created when a file is updated</p>
          </div>
        ) : (
          <div className="p-3 space-y-1">
            {versions.map((version, idx) => {
              const isCurrent = idx === 0
              const date = new Date(version.created_at)
              return (
                <div
                  key={version.id}
                  className={`p-3 rounded-[8px] border transition-colors ${
                    isCurrent
                      ? 'border-[#51459d]/20 bg-[#51459d]/5'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-800">
                        v{version.version_number}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] bg-[#6fd943]/10 text-[#6fd943] px-1.5 py-0.5 rounded-full font-medium">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {formatFileSize(version.size)}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-500">
                    {date.toLocaleDateString('en-KE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>

                  {version.created_by && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      by {version.created_by}
                    </p>
                  )}

                  {version.comment && (
                    <p className="text-[11px] text-gray-600 mt-1 italic">
                      "{version.comment}"
                    </p>
                  )}

                  {!isCurrent && (
                    <button
                      onClick={() => handleRestore(version.id)}
                      disabled={restoreVersion.isPending}
                      className="mt-2 text-xs text-[#51459d] hover:underline disabled:opacity-50"
                    >
                      {restoreVersion.isPending ? 'Restoring...' : 'Restore this version'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
