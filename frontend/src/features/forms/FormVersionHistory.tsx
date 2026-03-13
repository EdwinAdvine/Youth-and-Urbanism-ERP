import { useState } from 'react'
import { useFormVersions, useCreateVersion, useRestoreVersion, type FormVersion } from '@/api/forms'

interface FormVersionHistoryProps {
  formId: string
  onRestored?: () => void
}

export default function FormVersionHistory({ formId, onRestored }: FormVersionHistoryProps) {
  const { data: versions, isLoading } = useFormVersions(formId)
  const createVersion = useCreateVersion()
  const restoreVersion = useRestoreVersion()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)

  const handleCreateSnapshot = () => {
    createVersion.mutate(formId)
  }

  const handleRestore = (versionId: string) => {
    restoreVersion.mutate(
      { formId, versionId },
      {
        onSuccess: () => {
          setConfirmRestore(null)
          onRestored?.()
        },
      }
    )
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFieldCount = (v: FormVersion): number => {
    const snapshot = v.schema_snapshot as { fields?: unknown[] } | null
    return snapshot?.fields?.length ?? 0
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <svg className="w-5 h-5 animate-spin text-[#51459d]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Version History</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {versions?.length ?? 0} version{(versions?.length ?? 0) !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button
          onClick={handleCreateSnapshot}
          disabled={createVersion.isPending}
          className="px-3 py-1.5 text-[11px] font-medium text-white bg-[#51459d] hover:bg-[#3d3480] rounded-[8px] transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {createVersion.isPending ? (
            'Saving...'
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Save Snapshot
            </>
          )}
        </button>
      </div>

      {/* Timeline */}
      {!versions?.length ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">No versions yet</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Versions are created automatically when you publish</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-1">
            {versions.map((v, i) => {
              const isExpanded = expandedId === v.id
              const isLatest = i === 0
              const fieldCount = getFieldCount(v)

              return (
                <div key={v.id} className="relative pl-8">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-1.5 top-3 w-3 h-3 rounded-full border-2 ${
                      isLatest
                        ? 'bg-[#51459d] border-[#51459d]'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                    }`}
                  />

                  <div
                    className={`border rounded-[8px] transition-colors cursor-pointer ${
                      isExpanded
                        ? 'border-[#51459d]/30 bg-[#51459d]/5'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  >
                    <div className="px-3 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                              v{v.version_number}
                            </span>
                            {isLatest && (
                              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-[#51459d]/10 text-[#51459d] rounded-full">
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {formatDate(v.published_at || v.created_at)} · {fieldCount} field{fieldCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <svg
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2 space-y-3" onClick={(e) => e.stopPropagation()}>
                        {/* Schema preview */}
                        <div>
                          <h5 className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Fields in this version</h5>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {((v.schema_snapshot as { fields?: { label: string; field_type: string }[] })?.fields ?? []).map(
                              (f: { label: string; field_type: string }, fi: number) => (
                                <div key={fi} className="flex items-center gap-2 text-[11px]">
                                  <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[9px] font-mono text-gray-500 dark:text-gray-400">
                                    {f.field_type}
                                  </span>
                                  <span className="text-gray-700 dark:text-gray-300 truncate">{f.label}</span>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        {/* Restore button */}
                        {!isLatest && (
                          <div>
                            {confirmRestore === v.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-amber-600">Restore this version? Current form will be overwritten.</span>
                                <button
                                  onClick={() => handleRestore(v.id)}
                                  disabled={restoreVersion.isPending}
                                  className="px-2 py-1 text-[10px] font-medium bg-amber-500 text-white rounded-[6px] hover:bg-amber-600 disabled:opacity-50"
                                >
                                  {restoreVersion.isPending ? 'Restoring...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setConfirmRestore(null)}
                                  className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmRestore(v.id)}
                                className="flex items-center gap-1 text-[11px] text-[#51459d] hover:underline"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                Restore this version
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
