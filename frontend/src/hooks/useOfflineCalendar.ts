/**
 * useOfflineCalendar — offline-first calendar event management hook.
 *
 * Stores calendar events in IndexedDB (via `services/calendarOfflineDB`) so
 * users can create and delete events while offline. A sync queue is maintained
 * and flushed automatically when connectivity is restored via
 * `services/calendarSyncService`.
 *
 * Listens for:
 * - `window online/offline` events to track connectivity
 * - `calendarSyncComplete` custom events (dispatched by the sync service) to
 *   refresh the pending count and event list after a sync run
 *
 * Use alongside the standard Calendar API client; fall back to these offline
 * methods when the network request would fail.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  getAllEvents,
  saveEvent,
  deleteEvent,
  enqueue,
  getQueue,
  type OfflineEvent,
} from '@/services/calendarOfflineDB'
import { startSyncListener } from '@/services/calendarSyncService'

export function useOfflineCalendar() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [offlineEvents, setOfflineEvents] = useState<OfflineEvent[]>([])

  const refreshPendingCount = useCallback(async () => {
    const q = await getQueue()
    setPendingCount(q.length)
  }, [])

  useEffect(() => {
    // Load offline events
    getAllEvents().then(setOfflineEvents)
    refreshPendingCount()

    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    const onSync = () => { refreshPendingCount(); getAllEvents().then(setOfflineEvents) }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('calendarSyncComplete', onSync)
    const cleanup = startSyncListener()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('calendarSyncComplete', onSync)
      cleanup()
    }
  }, [refreshPendingCount])

  const createEventOffline = useCallback(async (event: Omit<OfflineEvent, 'id' | 'synced'>) => {
    const id = crypto.randomUUID()
    const full: OfflineEvent = { ...event, id, synced: false }
    await saveEvent(full)
    await enqueue({ type: 'create', eventId: id, payload: full })
    setOfflineEvents(prev => [...prev, full])
    await refreshPendingCount()
    return full
  }, [refreshPendingCount])

  const deleteEventOffline = useCallback(async (eventId: string) => {
    await deleteEvent(eventId)
    await enqueue({ type: 'delete', eventId })
    setOfflineEvents(prev => prev.filter(e => e.id !== eventId))
    await refreshPendingCount()
  }, [refreshPendingCount])

  return {
    isOnline,
    pendingCount,
    offlineEvents,
    createEventOffline,
    deleteEventOffline,
  }
}
