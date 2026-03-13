/**
 * Processes the IndexedDB sync queue when the browser comes back online.
 * Translates queued actions to API calls.
 */
import axios from 'axios'
import {
  getQueue,
  removeFromQueue,
  updateQueueEntry,
  saveEvent,
} from './calendarOfflineDB'

const MAX_RETRIES = 3

export async function flushSyncQueue(): Promise<{ success: number; failed: number }> {
  const queue = await getQueue()
  let success = 0
  let failed = 0

  for (const entry of queue) {
    try {
      if (entry.type === 'create' && entry.payload) {
        const res = await axios.post('/api/v1/calendar/events', entry.payload)
        // Update local event with server-assigned id
        await saveEvent({ ...entry.payload as any, id: res.data.id, synced: true })
        await removeFromQueue(entry.id)
        success++
      } else if (entry.type === 'update' && entry.payload) {
        await axios.put(`/api/v1/calendar/events/${entry.eventId}`, entry.payload)
        await removeFromQueue(entry.id)
        success++
      } else if (entry.type === 'delete') {
        await axios.delete(`/api/v1/calendar/events/${entry.eventId}`)
        await removeFromQueue(entry.id)
        success++
      }
    } catch (err) {
      if (entry.retries >= MAX_RETRIES) {
        await removeFromQueue(entry.id)
        failed++
      } else {
        await updateQueueEntry({ ...entry, retries: entry.retries + 1 })
      }
    }
  }

  return { success, failed }
}

export function startSyncListener(): () => void {
  const handler = () => {
    flushSyncQueue().then(({ success, failed }) => {
      if (success > 0 || failed > 0) {
        window.dispatchEvent(
          new CustomEvent('calendarSyncComplete', { detail: { success, failed } })
        )
      }
    })
  }
  window.addEventListener('online', handler)
  return () => window.removeEventListener('online', handler)
}
