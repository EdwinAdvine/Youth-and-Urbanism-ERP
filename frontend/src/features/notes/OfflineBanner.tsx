/**
 * OfflineBanner — Shows when the user is offline or when offline mutations are pending sync.
 */
import { useOfflineSync } from '../../hooks/useOfflineSync'

export default function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount } = useOfflineSync()

  if (isOnline && pendingCount === 0 && !isSyncing) return null

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 shrink-0">
        <svg className="h-3.5 w-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728" />
        </svg>
        <span className="text-[11px] text-amber-700 dark:text-amber-400">
          You're offline — changes are saved locally and will sync when reconnected
          {pendingCount > 0 && ` (${pendingCount} pending)`}
        </span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 shrink-0">
        <svg className="animate-spin h-3.5 w-3.5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-[11px] text-blue-700 dark:text-blue-400">
          Syncing {pendingCount} offline change{pendingCount !== 1 ? 's' : ''}...
        </span>
      </div>
    )
  }

  return null
}
