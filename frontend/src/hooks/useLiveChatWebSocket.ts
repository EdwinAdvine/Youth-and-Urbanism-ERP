import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/auth'

// -- Types --------------------------------------------------------------------

export interface ChatMessage {
  id?: string
  session_id: string
  sender_type: 'visitor' | 'agent' | 'bot'
  content: string
  content_type: string
  created_at: string
}

interface LiveChatEvent {
  type: 'message' | 'typing' | 'system' | 'closed'
  message?: ChatMessage
  sender_id?: string
  sender_type?: string
  content?: string
}

const MAX_RECONNECT_ATTEMPTS = 5

// -- Hook ---------------------------------------------------------------------

export function useLiveChatWebSocket(sessionId: string) {
  const token = useAuthStore((s) => s.token)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const reconnectAttempt = useRef(0)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({})

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const handleEvent = useCallback(
    (event: LiveChatEvent) => {
      switch (event.type) {
        case 'message':
          if (event.message) {
            addMessage(event.message)
          }
          // Clear typing indicator for the sender
          if (event.message?.sender_type) {
            setIsTyping((prev) => ({
              ...prev,
              [event.message!.sender_type]: false,
            }))
          }
          break

        case 'typing':
          if (event.sender_id || event.sender_type) {
            const key = event.sender_id || event.sender_type || 'unknown'
            setIsTyping((prev) => ({ ...prev, [key]: true }))
            // Auto-clear typing after 3 seconds
            setTimeout(() => {
              setIsTyping((prev) => ({ ...prev, [key]: false }))
            }, 3000)
          }
          break

        case 'system':
          addMessage({
            session_id: sessionId,
            sender_type: 'bot',
            content: event.content || '',
            content_type: 'system',
            created_at: new Date().toISOString(),
          })
          break

        case 'closed':
          addMessage({
            session_id: sessionId,
            sender_type: 'bot',
            content: event.content || 'Chat session closed.',
            content_type: 'system',
            created_at: new Date().toISOString(),
          })
          // Don't reconnect when the session is explicitly closed
          reconnectAttempt.current = MAX_RECONNECT_ATTEMPTS
          wsRef.current?.close()
          break
      }
    },
    [addMessage, sessionId]
  )

  const connect = useCallback(() => {
    if (!token || !sessionId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/api/v1/support/live-chat/ws/${sessionId}?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      reconnectAttempt.current = 0
    }

    ws.onmessage = (e) => {
      try {
        const event: LiveChatEvent = JSON.parse(e.data)
        handleEvent(event)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      wsRef.current = null

      if (reconnectAttempt.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000)
        reconnectAttempt.current += 1
        reconnectTimer.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [token, sessionId, handleEvent])

  // Connect on mount, clean up on unmount
  useEffect(() => {
    connect()
    return () => {
      // Prevent reconnect on intentional unmount
      reconnectAttempt.current = MAX_RECONNECT_ATTEMPTS
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const sendMessage = useCallback(
    (content: string, contentType: string = 'text') => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      wsRef.current.send(
        JSON.stringify({ type: 'message', content, content_type: contentType })
      )
    },
    []
  )

  const sendTyping = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'typing' }))
  }, [])

  const disconnect = useCallback(() => {
    reconnectAttempt.current = MAX_RECONNECT_ATTEMPTS
    clearTimeout(reconnectTimer.current)
    wsRef.current?.close()
    wsRef.current = null
    setIsConnected(false)
  }, [])

  return {
    messages,
    isConnected,
    isTyping,
    sendMessage,
    sendTyping,
    disconnect,
  }
}
