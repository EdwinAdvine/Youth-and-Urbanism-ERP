import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { cn } from '../../components/ui'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import { useAuthStore } from '../../store/auth'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  streaming?: boolean
}

interface AIChatProps {
  onClose?: () => void
  context?: string
  fullPage?: boolean
  initialMessage?: string
}

export default function AIChat({ onClose, context, fullPage, initialMessage }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hello! I'm your Urban ERP assistant. I can help you with finance reports, HR queries, inventory management, and much more. What can I help you with today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const user = useAuthStore((s) => s.user)

  // ── Voice input ───────────────────────────────────────────────────────────
  const { isListening, transcript, startListening, stopListening, error: voiceError, isSupported: voiceSupported } = useVoiceInput()

  // When voice recognition produces a transcript, fill it into the input
  useEffect(() => {
    if (transcript) {
      setInput(transcript)
    }
  }, [transcript])

  // ── TTS helper ────────────────────────────────────────────────────────────
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  const sessionId = useMemo(() => crypto.randomUUID(), [])

  const { status, connect, send } = useWebSocket({
    url: `/api/v1/ai/ws/chat/${sessionId}`,
    autoReconnect: true,
    onMessage: (msg) => {
      if (msg.type === 'delta' && msg.delta) {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + msg.delta },
            ]
          }
          return prev
        })
      }
      if (msg.type === 'done' || msg.done) {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming) {
            return [...prev.slice(0, -1), { ...last, streaming: false }]
          }
          return prev
        })
        setIsThinking(false)
      }
      if (msg.type === 'error') {
        setIsThinking(false)
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: `I encountered an error: ${msg.error ?? 'Unknown error'}. Please try again.`,
            timestamp: new Date(),
          },
        ])
      }
    },
  })

  useEffect(() => {
    connect()
  }, [connect])

  // Auto-send initial message once WebSocket opens
  const initialSentRef = useRef(false)
  useEffect(() => {
    if (!initialMessage || initialSentRef.current || status !== 'open') return
    initialSentRef.current = true
    const text = initialMessage.trim()
    if (!text) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', timestamp: new Date(), streaming: true }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsThinking(true)
    send({ type: 'chat', content: text, message: text, metadata: { context } })
  }, [status, initialMessage, context, send])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    const text = input.trim()
    if (!text || isThinking) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsThinking(true)

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true,
    }
    setMessages((prev) => [...prev, assistantMsg])

    if (status === 'open') {
      send({ type: 'chat', content: text, message: text, metadata: { context } })
    } else {
      // Fallback: simulate response
      setTimeout(() => {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.streaming) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: "I'm having trouble connecting to the AI service right now. Please check that the backend and Ollama services are running.",
                streaming: false,
              },
            ]
          }
          return prev
        })
        setIsThinking(false)
      }, 1000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Mobile: swipe down to dismiss
  const handleSwipeDown = useCallback(() => {
    if (onClose) onClose()
  }, [onClose])
  const swipeHandlers = useSwipeGesture({
    onSwipeDown: handleSwipeDown,
    threshold: 80,
  })

  return (
    <div className={cn(
      'flex flex-col h-full bg-white dark:bg-gray-800',
      fullPage
        ? 'w-full'
        : 'rounded-[10px] shadow-sm border border-gray-100 dark:border-gray-800 fixed inset-0 sm:static sm:inset-auto z-50 sm:z-auto'
    )}>
      {/* Header - with swipe-down handle on mobile */}
      <div {...swipeHandlers} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        {/* Mobile drag handle */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-300 rounded-full sm:hidden" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Urban AI</p>
            <p className={cn('text-xs', status === 'open' ? 'text-success' : 'text-gray-400')}>
              {status === 'open' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {context && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {context}
            </span>
          )}
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
              msg.role === 'user'
                ? 'bg-primary text-white'
                : 'bg-gradient-to-br from-primary to-primary-700 text-white'
            )}>
              {msg.role === 'user'
                ? (user?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U')
                : 'AI'
              }
            </div>
            <div className={cn(
              'max-w-[75%] rounded-[10px] px-3.5 py-2.5 text-sm',
              msg.role === 'user'
                ? 'bg-primary text-white rounded-tr-sm'
                : 'bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-100'
            )}>
              {msg.content || (msg.streaming && (
                <span className="flex gap-1 items-center py-0.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              ))}
              <div className={cn(
                'flex items-center gap-1 mt-1',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}>
                <p className={cn(
                  'text-[10px]',
                  msg.role === 'user' ? 'text-white/60' : 'text-gray-400'
                )}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {msg.role === 'assistant' && msg.content && !msg.streaming && (
                  <button
                    onClick={() => speakText(msg.content)}
                    title="Read aloud"
                    className="text-gray-400 hover:text-primary transition-colors ml-1"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.5H4a1 1 0 00-1 1v5a1 1 0 001 1h2.5l5 4V4.5l-5 4z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - bottom-anchored, safe area padding on mobile */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2 items-end">
          {/* Voice input button */}
          {voiceSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              title={isListening ? 'Stop recording' : 'Start voice input'}
              className={cn(
                'p-2 rounded-[8px] transition-colors shrink-0 relative',
                isListening
                  ? 'text-red-500 bg-red-50'
                  : 'text-gray-400 hover:text-primary hover:bg-primary/10'
              )}
            >
              {isListening && (
                <span className="absolute inset-0 rounded-[8px] border-2 border-red-400 animate-ping pointer-events-none" />
              )}
              <svg className="h-5 w-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            style={{ maxHeight: '120px' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim() || isThinking}
            className="p-2 min-w-[44px] min-h-[44px] rounded-[8px] bg-primary text-white hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:pointer-events-none shrink-0 flex items-center justify-center"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        {voiceError && (
          <p className="text-[10px] text-red-500 mt-1 px-1">{voiceError}</p>
        )}
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
          AI responses may be inaccurate. Always verify important decisions.
        </p>
      </div>
    </div>
  )
}
