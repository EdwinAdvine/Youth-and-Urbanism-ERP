/**
 * useOfflineSync — Detects online/offline status and manages a mutation queue
 * in localStorage for notes changes made while offline.
 *
 * On reconnect, replays queued mutations via POST /notes/sync-batch.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'

export interface PendingMutation {
  id: string
  type: 'create_note' | 'update_note' | 'delete_note'
  payload: Record<string, any>
  timestamp: number
}

const QUEUE_KEY = 'yu_notes_offline_queue'

function loadQueue(): PendingMutation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(q: PendingMutation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => loadQueue().length)
  const syncInProgress = useRef(false)

  const addToQueue = useCallback((type: PendingMutation['type'], payload: Record<string, any>) => {
    const q = loadQueue()
    q.push({ id: crypto.randomUUID(), type, payload, timestamp: Date.now() })
    saveQueue(q)
    setPendingCount(q.length)
  }, [])

  const syncQueue = useCallback(async () => {
    if (syncInProgress.current) return
    const q = loadQueue()
    if (q.length === 0) return

    syncInProgress.current = true
    setIsSyncing(true)
    try {
      await axios.post('/api/v1/notes/sync-batch', { mutations: q })
      saveQueue([])
      setPendingCount(0)
    } catch (err) {
      console.warn('[useOfflineSync] sync failed, will retry on next reconnect', err)
    } finally {
      syncInProgress.current = false
      setIsSyncing(false)
    }
  }, [])

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      syncQueue()
    }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [syncQueue])

  return { isOnline, isSyncing, pendingCount, addToQueue, syncQueue }
}
