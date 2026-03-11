import { useOfflineSync } from './useOfflineSync';

export function OfflineBanner() {
  const { isOffline, pendingCount, isSyncing, lastSyncResult, syncNow } =
    useOfflineSync();

  // Hide banner when online with nothing pending and no recent sync result
  if (!isOffline && pendingCount === 0 && !isSyncing) {
    // Show brief success toast after sync, then hide
    if (lastSyncResult && lastSyncResult.synced > 0) {
      return (
        <div
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all duration-300"
          style={{
            backgroundColor: '#6fd943',
            borderRadius: '10px',
          }}
        >
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>
            {lastSyncResult.synced} transaction
            {lastSyncResult.synced !== 1 ? 's' : ''} synced successfully
          </span>
        </div>
      );
    }
    return null;
  }

  // Syncing state
  if (isSyncing) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white"
        style={{
          backgroundColor: '#51459d',
          borderRadius: '10px',
        }}
      >
        <svg
          className="h-4 w-4 flex-shrink-0 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>Syncing{pendingCount > 0 ? ` ${pendingCount} transaction${pendingCount !== 1 ? 's' : ''}` : ''}...</span>
      </div>
    );
  }

  // Offline state with pending count
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium text-white"
      style={{
        backgroundColor: '#ffa21d',
        borderRadius: '10px',
      }}
    >
      <div className="flex items-center gap-2">
        <svg
          className="h-4 w-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01"
          />
        </svg>
        <span>
          Offline Mode
          {pendingCount > 0 && (
            <>
              {' — '}
              {pendingCount} transaction{pendingCount !== 1 ? 's' : ''} pending
            </>
          )}
        </span>
      </div>

      {pendingCount > 0 && navigator.onLine && (
        <button
          onClick={syncNow}
          className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
          style={{ borderRadius: '6px' }}
        >
          Sync Now
        </button>
      )}
    </div>
  );
}
