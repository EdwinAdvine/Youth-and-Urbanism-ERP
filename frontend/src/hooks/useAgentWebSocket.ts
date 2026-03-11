import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/auth'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AgentStep {
  id: string
  action: string
  args?: Record<string, unknown>
  rationale?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval' | 'approved' | 'rejected'
  approval_tier?: string
  result?: Record<string, unknown>
  risk_level?: string
  description?: string
}

export interface AgentRun {
  id: string
  status: string
  steps: AgentStep[]
  summary?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'agent'
  content: string
  agent?: string
  run?: AgentRun
  timestamp: number
}

type WSStatus = 'connecting' | 'connected' | 'disconnected'

interface AgentEvent {
  type: string
  agent?: string
  run_id?: string
  message?: string
  steps?: AgentStep[]
  step_id?: string
  action?: string
  result?: Record<string, unknown>
  summary?: string
  steps_completed?: string[]
  steps_pending_approval?: string[]
  risk_level?: string
  description?: string
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAgentWebSocket(sessionId: string) {
  const token = useAuthStore((s) => s.token)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const reconnectAttempt = useRef(0)

  const [status, setStatus] = useState<WSStatus>('disconnected')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null)
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null)
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null)

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case 'plan':
          setCurrentRun({
            id: event.run_id || '',
            status: 'planning',
            steps: (event.steps || []).map((s) => ({ ...s, status: 'pending' })),
          })
          setThinkingAgent(null)
          setThinkingMessage(null)
          break

        case 'agent_thinking':
          setThinkingAgent(event.agent || null)
          setThinkingMessage(event.message || null)
          break

        case 'step_started':
          setThinkingAgent('executor')
          setThinkingMessage(`Executing ${event.action}...`)
          setCurrentRun((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              status: 'executing',
              steps: prev.steps.map((s) =>
                s.id === event.step_id ? { ...s, status: 'running' as const } : s
              ),
            }
          })
          break

        case 'step_completed':
          setCurrentRun((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              steps: prev.steps.map((s) =>
                s.id === event.step_id
                  ? { ...s, status: 'completed' as const, result: event.result }
                  : s
              ),
            }
          })
          break

        case 'approval_needed':
          setThinkingAgent(null)
          setThinkingMessage(null)
          setCurrentRun((prev) => {
            if (!prev) return prev
            const pendingSteps = event.steps || []
            return {
              ...prev,
              id: event.run_id || prev.id,
              status: 'awaiting_approval',
              steps: prev.steps.map((s) => {
                const pending = pendingSteps.find((p) => p.id === s.id)
                if (pending) {
                  return {
                    ...s,
                    status: 'awaiting_approval' as const,
                    risk_level: pending.risk_level,
                    description: pending.description,
                  }
                }
                return s
              }),
            }
          })
          break

        case 'result':
          setThinkingAgent(null)
          setThinkingMessage(null)
          setCurrentRun((prev) => {
            if (!prev) return prev
            return { ...prev, status: 'completed', summary: event.summary }
          })
          addMessage({
            id: `result-${Date.now()}`,
            role: 'assistant',
            content: event.summary || 'Done.',
            run: currentRun || undefined,
            timestamp: Date.now(),
          })
          break

        case 'error':
          setThinkingAgent(null)
          setThinkingMessage(null)
          addMessage({
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: event.message || 'An error occurred.',
            timestamp: Date.now(),
          })
          break
      }
    },
    [addMessage, currentRun]
  )

  const connect = useCallback(() => {
    if (!token || !sessionId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // Use explicit WS host if set, otherwise derive from VITE_API_TARGET, else fall back to same host.
    // During local dev the Vite proxy runs on port 3000 (mapped to 3010 externally), so we can't
    // rely on window.location.host — point directly at the backend instead.
    const apiTarget = import.meta.env.VITE_API_TARGET || 'http://localhost:8010'
    const host = import.meta.env.VITE_API_WS_HOST || apiTarget.replace(/^https?:\/\//, '')
    const url = `${protocol}//${host}/api/v1/agent/ws/${sessionId}?token=${token}`

    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      reconnectAttempt.current = 0
    }

    ws.onmessage = (e) => {
      try {
        const event: AgentEvent = JSON.parse(e.data)
        handleEvent(event)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      wsRef.current = null
      // Exponential backoff reconnect
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000)
      reconnectAttempt.current += 1
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [token, sessionId, handleEvent])

  // Connect on mount
  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const sendPrompt = useCallback(
    (message: string, context?: Record<string, unknown>) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

      addMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
      })

      setCurrentRun(null)
      setThinkingAgent('orchestrator')
      setThinkingMessage('Analyzing your request...')

      wsRef.current.send(
        JSON.stringify({ type: 'prompt', message, context })
      )
    },
    [addMessage]
  )

  const sendApproval = useCallback(
    (runId: string, stepIds: string[], decision: 'approve' | 'reject') => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

      wsRef.current.send(
        JSON.stringify({ type: 'approve', run_id: runId, step_ids: stepIds, decision })
      )
    },
    []
  )

  return {
    status,
    messages,
    currentRun,
    thinkingAgent,
    thinkingMessage,
    sendPrompt,
    sendApproval,
    connect,
  }
}
