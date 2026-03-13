import { useOfflineSync } from '@/hooks/useOfflineSync'

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncQueue: syncPending } = useOfflineSync()

  if (isOnline && pendingCount === 0) return null

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all ${
        isOnline
          ? 'bg-yellow-50 border border-yellow-300 text-yellow-800'
          : 'bg-red-50 border border-red-300 text-red-800'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-yellow-500' : 'bg-red-500'}`}
      />
      {isOnline ? (
        <>
          <span>
            {pendingCount} change{pendingCount !== 1 ? 's' : ''} pending sync
          </span>
          <button
            onClick={syncPending}
            className="underline hover:no-underline focus:outline-none"
          >
            Sync now
          </button>
        </>
      ) : (
        <span>You are offline — changes will sync when reconnected</span>
      )}
    </div>
  )
}
