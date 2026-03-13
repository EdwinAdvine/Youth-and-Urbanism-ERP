/**
 * useDocCopilot — AI copilot WebSocket hook for ONLYOFFICE document editing.
 *
 * Connects to `/api/v1/docs/ws/copilot/{fileId}?token={jwt}` and streams
 * AI assistant responses while the user edits a document. Responses arrive
 * as streaming chunks (`type: "chunk"`) which build up the `streamBuffer`,
 * then a final `type: "done"` message commits the full response to the
 * message history.
 *
 * Reconnects automatically every 3 seconds on drop (no exponential backoff —
 * doc copilot sessions are short-lived and user-initiated).
 * A 15-second ping heartbeat keeps the connection alive through load balancers.
 *
 * Usage: Mount per document editor session; pass `fileId = null` to disable.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '../store/auth'

export interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  model?: string
}

interface CopilotServerMessage {
  type: 'chunk' | 'done' | 'error' | 'pong'
  content?: string
  full_content?: string
  model?: string
  message?: string
}

export function useDocCopilot(fileId: string | null) {
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = useAuthStore((s) => s.token)

  const connect = useCallback(() => {
    if (!fileId || !token) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = '8010'
    const url = `${protocol}//${host}:${port}/api/v1/docs/ws/copilot/${fileId}?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg: CopilotServerMessage = JSON.parse(event.data)
        if (msg.type === 'chunk') {
          setStreamBuffer((prev) => prev + (msg.content ?? ''))
        } else if (msg.type === 'done') {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: msg.full_content ?? '', model: msg.model },
          ])
          setStreamBuffer('')
          setStreaming(false)
        } else if (msg.type === 'error') {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `Error: ${msg.message ?? 'Unknown error'}` },
          ])
          setStreamBuffer('')
          setStreaming(false)
        }
      } catch {
        // ignore
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [fileId, token])

  useEffect(() => {
    connect()

    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 15000)

    return () => {
      clearInterval(heartbeat)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const sendMessage = useCallback((message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    if (streaming) return

    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setStreaming(true)
    setStreamBuffer('')
    wsRef.current.send(JSON.stringify({ type: 'prompt', message }))
  }, [streaming])

  const clearMessages = useCallback(() => {
    setMessages([])
    setStreamBuffer('')
  }, [])

  return { messages, streaming, connected, streamBuffer, sendMessage, clearMessages }
}
