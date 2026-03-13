/**
 * useWebSocket — generic, reusable WebSocket hook for Urban Vibes Dynamics.
 *
 * Manages a single WebSocket connection with optional automatic reconnection.
 * Appends the current JWT as a query parameter so the backend can authenticate
 * the connection without a custom upgrade header.
 *
 * Usage:
 *   const { status, connect, disconnect, send } = useWebSocket({
 *     url: '/api/v1/ai/ws/chat/session-id',
 *     onMessage: (msg) => handleStreamChunk(msg),
 *     autoReconnect: true,
 *   })
 *
 * For module-specific protocols (agent, team chat, live-chat, doc copilot) use
 * the dedicated hooks instead — this hook is for generic streaming scenarios.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '../store/auth'

export type WSStatus = 'connecting' | 'open' | 'closed' | 'error'

export interface WSMessage {
  type: string
  content?: string
  message?: string
  delta?: string
  done?: boolean
  error?: string
  metadata?: Record<string, unknown>
}

interface UseWebSocketOptions {
  url: string
  onMessage?: (msg: WSMessage) => void
  onOpen?: () => void
  onClose?: () => void
  autoReconnect?: boolean
  reconnectDelay?: number
  maxRetries?: number
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  autoReconnect = true,
  reconnectDelay = 2000,
  maxRetries = 5,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WSStatus>('closed')
  const ws = useRef<WebSocket | null>(null)
  const retries = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = useAuthStore((s) => s.token)

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    const wsUrl = `${url}${url.includes('?') ? '&' : '?'}token=${token ?? ''}`
    setStatus('connecting')

    const socket = new WebSocket(wsUrl)
    ws.current = socket

    socket.onopen = () => {
      setStatus('open')
      retries.current = 0
      onOpen?.()
    }

    socket.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        onMessage?.(msg)
      } catch {
        // raw text fallback
        onMessage?.({ type: 'text', content: event.data })
      }
    }

    socket.onerror = () => {
      setStatus('error')
    }

    socket.onclose = () => {
      setStatus('closed')
      onClose?.()
      if (autoReconnect && retries.current < maxRetries) {
        retries.current += 1
        reconnectTimer.current = setTimeout(connect, reconnectDelay * retries.current)
      }
    }
  }, [url, token, onMessage, onOpen, onClose, autoReconnect, reconnectDelay, maxRetries])

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    ws.current?.close()
    ws.current = null
    retries.current = 0
  }, [])

  const send = useCallback((data: WSMessage | string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return { status, connect, disconnect, send }
}
