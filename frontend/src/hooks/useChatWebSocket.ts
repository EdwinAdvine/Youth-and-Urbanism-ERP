/**
 * useChatWebSocket — real-time WebSocket hook for the Urban Vibes Dynamics team Chat module.
 *
 * Connects to `/api/v1/chat/ws?token={jwt}` and handles the full chat event
 * protocol: new/edited/deleted messages, typing indicators, presence changes,
 * emoji reactions, and read receipts.
 *
 * Key behaviours:
 * - 30-second heartbeat (ping/pong) to keep the connection alive through proxies
 * - Exponential backoff reconnection (1s → 2s → 4s … max 30s)
 * - Invalidates TanStack Query caches on message/reaction changes so UI stays fresh
 * - Typing indicators auto-clear after 5 seconds with no new typing event
 *
 * Mount once at the App level (inside AppShell) when the user is authenticated.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChatStore, type ChatMessage } from '@/store/chat'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseChatWebSocketOptions {
  token: string
  enabled?: boolean
  onMessage?: (message: ChatMessage) => void
}

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8010/api/v1'
const HEARTBEAT_INTERVAL = 30_000
const RECONNECT_BASE_DELAY = 1_000
const RECONNECT_MAX_DELAY = 30_000

export function useChatWebSocket({ token, enabled = true, onMessage }: UseChatWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>()
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const reconnectAttemptRef = useRef(0)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const queryClient = useQueryClient()

  const {
    incrementUnread,
    setTypingUser,
    clearTypingUser,
    setPresence,
    activeChannelId,
  } = useChatStore()

  const connect = useCallback(() => {
    if (!token || !enabled) return

    const ws = new WebSocket(`${WS_BASE}/chat/ws?token=${token}`)
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => {
      setStatus('connected')
      reconnectAttemptRef.current = 0

      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, HEARTBEAT_INTERVAL)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleMessage(data)
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onerror = () => {
      setStatus('error')
    }

    ws.onclose = () => {
      setStatus('disconnected')
      cleanup()
      scheduleReconnect()
    }
  }, [token, enabled])

  const handleMessage = useCallback(
    (data: Record<string, unknown>) => {
      const type = data.type as string

      switch (type) {
        case 'message.new': {
          const msg = data.message as ChatMessage
          const channelId = data.channel_id as string

          // Invalidate messages query for the channel
          queryClient.invalidateQueries({ queryKey: ['chat', 'messages', channelId] })

          // Increment unread if not the active channel
          if (channelId !== activeChannelId) {
            incrementUnread(channelId)
          }

          // Clear typing for this sender
          if (msg.sender_id) {
            clearTypingUser(channelId, msg.sender_id)
          }

          onMessage?.(msg)
          break
        }

        case 'message.edited': {
          const channelId = data.channel_id as string
          queryClient.invalidateQueries({ queryKey: ['chat', 'messages', channelId] })
          break
        }

        case 'message.deleted': {
          const channelId = data.channel_id as string
          queryClient.invalidateQueries({ queryKey: ['chat', 'messages', channelId] })
          break
        }

        case 'typing': {
          const channelId = data.channel_id as string
          const userId = data.user_id as string
          const userName = data.user_name as string
          setTypingUser(channelId, userId, userName)

          // Auto-clear typing after 5 seconds
          setTimeout(() => {
            clearTypingUser(channelId, userId)
          }, 5000)
          break
        }

        case 'presence.changed': {
          const userId = data.user_id as string
          setPresence(userId, {
            user_id: userId,
            status: data.status as 'online' | 'away' | 'dnd' | 'offline',
            status_message: (data.status_message as string) || null,
            status_emoji: null,
            last_active: new Date().toISOString(),
          })
          break
        }

        case 'reaction.added':
        case 'reaction.removed': {
          const channelId = data.channel_id as string
          queryClient.invalidateQueries({ queryKey: ['chat', 'messages', channelId] })
          break
        }

        case 'read_receipt': {
          // Could update read receipt UI
          break
        }

        case 'subscribed': {
          // Channel subscription confirmed
          break
        }

        case 'pong': {
          // Heartbeat acknowledged
          break
        }

        default:
          break
      }
    },
    [activeChannelId, queryClient, incrementUnread, setTypingUser, clearTypingUser, setPresence, onMessage],
  )

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = undefined
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (!enabled) return

    const attempt = reconnectAttemptRef.current
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, attempt),
      RECONNECT_MAX_DELAY,
    )
    reconnectAttemptRef.current += 1

    reconnectTimerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect, enabled])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
    }
    cleanup()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus('disconnected')
  }, [cleanup])

  const sendTyping = useCallback(
    (channelId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'typing', channel_id: channelId }))
      }
    },
    [],
  )

  const sendRead = useCallback(
    (channelId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'read', channel_id: channelId }))
      }
    },
    [],
  )

  const subscribeChannels = useCallback(
    (channelIds: string[]) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'subscribe', channel_ids: channelIds }))
      }
    },
    [],
  )

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled && token) {
      connect()
    }
    return () => {
      disconnect()
    }
  }, [token, enabled])

  return {
    status,
    sendTyping,
    sendRead,
    subscribeChannels,
    disconnect,
  }
}
