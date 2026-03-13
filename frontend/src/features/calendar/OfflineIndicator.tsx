/**
 * OfflineIndicator.tsx
 * Fixed bottom banner that shows offline/sync state to the user.
 */

import { useState, useEffect } from 'react'
import { useOfflineCalendar } from '../../hooks/useOfflineCalendar'

export default function OfflineIndicator() {
  const { isOnline, pendingCount: pendingSync } = useOfflineCalendar()
  const [showBackOnline, setShowBackOnline] = useState(false)
  const [wasOffline, setWasOffline] = useState(!isOnline)

  // Detect the offline → online transition and show a brief "syncing" banner
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowBackOnline(true)
      setWasOffline(false)

      const timer = setTimeout(() => setShowBackOnline(false), 3000)
      return () => clearTimeout(timer)
    }

    if (!isOnline) {
      setWasOffline(true)
      setShowBackOnline(false)
    }
  }, [isOnline, wasOffline])

  // Nothing to show while online with no pending items and not transitioning
  if (isOnline && !showBackOnline && pendingSync === 0) {
    return null
  }

  // "Back online — syncing..." banner
  if (showBackOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-[#6fd943] text-white text-xs font-medium px-4 py-2 shadow-lg transition-all"
      >
        <svg className="h-3.5 w-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Back online — syncing{pendingSync > 0 ? ` ${pendingSync} change${pendingSync !== 1 ? 's' : ''}` : ''}…
      </div>
    )
  }

  // Offline banner with pending count
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-[#ffa21d] text-white text-xs font-medium px-4 py-2 shadow-lg"
    >
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12h.01" />
      </svg>
      {pendingSync > 0
        ? `Offline — ${pendingSync} change${pendingSync !== 1 ? 's' : ''} pending sync`
        : 'Offline — changes will sync when you reconnect'}
    </div>
  )
}
