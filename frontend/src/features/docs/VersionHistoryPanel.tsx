import { Card, Button, Spinner, Badge, toast } from '../../components/ui'
import { useDocVersionsExt, useRestoreVersion } from '../../api/docs_ext'
import type { DocVersion } from '../../api/docs'

interface Props {
  fileId: string
  onClose?: () => void
}

export default function VersionHistoryPanel({ fileId, onClose }: Props) {
  const { data: versions, isLoading } = useDocVersionsExt(fileId)
  const restoreVersion = useRestoreVersion(fileId)

  const handleRestore = (v: DocVersion) => {
    if (!confirm(`Restore to version ${v.version_number}? The current version will be saved as a new version.`)) return
    restoreVersion.mutate(v.id, {
      onSuccess: () => toast('success', `Restored to version ${v.version_number}`),
      onError: () => toast('error', 'Failed to restore version'),
    })
  }

  return (
    <div className="w-80 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 h-full overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Version History</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : !versions || versions.length === 0 ? (
        <div className="text-center py-12 px-4 text-sm text-gray-400">No version history available.</div>
      ) : (
        <div className="p-2 space-y-1">
          {versions.map((v, idx) => (
            <div
              key={v.id}
              className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Version {v.version_number}
                    </span>
                    {idx === 0 && <Badge variant="primary">Current</Badge>}
                  </div>
                  {v.label && (
                    <p className="text-xs text-gray-500 mt-0.5">{v.label}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400">
                      {(v.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  {v.saved_by && (
                    <span className="text-xs text-gray-400">by {v.saved_by}</span>
                  )}
                </div>
                {idx > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRestore(v)}
                    loading={restoreVersion.isPending}
                  >
                    Restore
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
