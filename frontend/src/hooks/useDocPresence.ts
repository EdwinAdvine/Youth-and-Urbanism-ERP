/**
 * useDocPresence — real-time collaborator presence for ONLYOFFICE document editing.
 *
 * Connects to `/api/v1/docs/ws/presence/{fileId}?token={jwt}` and tracks which
 * users are currently viewing/editing the document. The backend broadcasts
 * `user_joined` and `user_left` events with the full updated user list, so the
 * hook always holds an accurate snapshot of active collaborators.
 *
 * Also provides `sendCursorPosition()` to broadcast the current user's cursor
 * location for live cursor overlays in the editor UI.
 *
 * A 10-second ping heartbeat keeps the connection alive.
 * Reconnects every 3 seconds on drop (capped at 10s).
 *
 * Usage: Mount per document editor session; pass `fileId = null` to disable.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '../store/auth'

export interface PresenceUser {
  user_id: string
  user_name: string
}

interface PresenceMessage {
  type: 'user_joined' | 'user_left' | 'cursor_position' | 'pong'
  user_id?: string
  user_name?: string
  users?: PresenceUser[]
  cursor?: Record<string, unknown>
}

export function useDocPresence(fileId: string | null) {
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = useAuthStore((s) => s.token)

  const connect = useCallback(() => {
    if (!fileId || !token) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = '8010'
    const url = `${protocol}//${host}:${port}/api/v1/docs/ws/presence/${fileId}?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg: PresenceMessage = JSON.parse(event.data)
        if (msg.type === 'user_joined' || msg.type === 'user_left') {
          setUsers(msg.users ?? [])
        }
      } catch {
        // ignore
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      // Reconnect with exponential backoff (max 10s)
      reconnectRef.current = setTimeout(connect, Math.min(3000, 10000))
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [fileId, token])

  useEffect(() => {
    connect()

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 10000)

    return () => {
      clearInterval(heartbeat)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const sendCursorPosition = useCallback((cursor: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor_position', cursor }))
    }
  }, [])

  return { users, connected, sendCursorPosition }
}
