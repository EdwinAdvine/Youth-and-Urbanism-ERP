import { useState } from 'react'
import { Card, Button, Spinner } from '../../components/ui'
import { useDriveSnapshots, useRestoreSnapshot } from '../../api/drive_phase2'
import { formatFileSize } from '../../api/drive'

export default function DriveRestorePanel() {
  const { data, isLoading } = useDriveSnapshots()
  const restore = useRestoreSnapshot()
  const [restoredId, setRestoredId] = useState<string | null>(null)

  const handleRestore = async (snapshotId: string) => {
    if (!confirm('Restore to this snapshot? A new "Restored" folder will be created with the snapshot contents.')) return
    try {
      const result = await restore.mutateAsync(snapshotId)
      setRestoredId(snapshotId)
      alert(`Restored ${result.restored_files} files to folder "${result.folder_id}"`)
    } catch {
      alert('Restore failed. Please try again.')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restore Points</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Daily snapshots of your drive. Restore to a previous state at any time.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !data?.snapshots.length ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-4xl mb-3">⏪</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No snapshots yet</p>
            <p className="text-xs text-gray-400 mt-1">Snapshots are taken automatically every night at 1:30 AM</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.snapshots.map((snap) => {
            const date = new Date(snap.snapshot_at)
            const isToday = new Date().toDateString() === date.toDateString()
            const isRestored = restoredId === snap.id

            return (
              <Card key={snap.id}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-[#51459d]/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {isToday && (
                        <span className="text-[10px] bg-[#6fd943]/20 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Today</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · {snap.file_count.toLocaleString()} files · {formatFileSize(snap.total_size)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(snap.id)}
                    loading={restore.isPending && !isRestored}
                    disabled={restore.isPending}
                  >
                    {isRestored ? 'Restored ✓' : 'Restore'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-[10px] p-4">
        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">About Restore Points</p>
        <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>Snapshots are taken automatically every day at 1:30 AM</li>
          <li>Restoring creates a new "Restored" folder — your current files are not affected</li>
          <li>Up to 30 snapshots are kept (last 30 days)</li>
          <li>Restore copies files from MinIO — may take a moment for large drives</li>
        </ul>
      </div>
    </div>
  )
}
