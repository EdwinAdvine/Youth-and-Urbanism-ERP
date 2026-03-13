/**
 * SSE client for real-time data push.
 *
 * Opens a Server-Sent Events connection to /api/v1/data-push/stream and
 * invalidates TanStack Query caches whenever the backend publishes a data
 * change event. This ensures all users see updates within ≤5 seconds
 * without polling.
 *
 * Mount once at AppShell level:
 *   function AppShell() {
 *     useDataPush()
 *     ...
 *   }
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { ENTITY_QUERY_MAP } from '@/utils/entityQueryMap'

const MAX_RECONNECT_DELAY = 30_000  // 30 seconds max
const INITIAL_RECONNECT_DELAY = 2_000

export function useDataPush() {
  const queryClient = useQueryClient()
  const { token, isAuthenticated } = useAuthStore()
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)

  useEffect(() => {
    if (!isAuthenticated || !token) return

    function connect() {
      if (esRef.current) {
        esRef.current.close()
      }

      const url = `/api/v1/data-push/stream?token=${encodeURIComponent(token!)}`
      const es = new EventSource(url)
      esRef.current = es

      es.onopen = () => {
        // Reset backoff on successful connection
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
      }

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type?: string
            entity?: string
            action?: string
            id?: string
          }

          // Skip heartbeat/connected messages
          if (payload.type === 'connected' || !payload.entity) return

          const queryKey = ENTITY_QUERY_MAP[payload.entity]
          if (queryKey) {
            queryClient.invalidateQueries({ queryKey: queryKey as string[] })
          }
        } catch {
          // Silently ignore malformed messages
        }
      }

      es.onerror = () => {
        es.close()
        esRef.current = null

        // Exponential backoff reconnect
        reconnectTimerRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            MAX_RECONNECT_DELAY,
          )
          connect()
        }, reconnectDelayRef.current)
      }
    }

    connect()

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [isAuthenticated, token, queryClient])
}
