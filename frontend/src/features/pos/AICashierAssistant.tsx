import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Badge, Spinner } from '../../components/ui'
import { useAuthStore } from '../../store/auth'

interface AISuggestion {
  type: 'upsell' | 'demand' | 'alert' | 'info'
  title: string
  content: string
  items?: { name: string; price?: number }[]
}

interface Props {
  cartItemIds: string[]
  customerId?: string
}

export default function AICashierAssistant({ cartItemIds, customerId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const token = useAuthStore((s) => s.token)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef(`pos-ai-${Date.now()}`)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages])

  const connectWS = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(
      `ws://localhost:8000/api/v1/ai/ws/chat/${sessionId.current}?token=${token}`
    )

    ws.onopen = () => {
      // Request initial suggestions based on context
      if (cartItemIds.length > 0) {
        ws.send(JSON.stringify({
          message: `I'm at the POS register. Items in cart: ${cartItemIds.length} items. Suggest upsells or tips for this sale.`,
          context: { module: 'pos', route: '/pos/register' },
        }))
        setLoading(true)
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'response' || data.type === 'message') {
          setMessages((prev) => [...prev, { role: 'assistant', content: data.content || data.message || '' }])
          setLoading(false)
        } else if (data.type === 'tool_result') {
          // Parse tool results into suggestions
          if (data.tool === 'pos_suggest_upsell' && data.result?.suggestions) {
            setSuggestions((prev) => [
              ...prev,
              {
                type: 'upsell',
                title: 'Upsell Suggestions',
                content: 'Customers who bought similar items also purchased:',
                items: data.result.suggestions.map((s: { name: string; price: number }) => ({
                  name: s.name,
                  price: s.price,
                })),
              },
            ])
          }
        }
      } catch {
        // Plain text message
        setMessages((prev) => [...prev, { role: 'assistant', content: event.data }])
        setLoading(false)
      }
    }

    ws.onclose = () => {
      wsRef.current = null
    }

    wsRef.current = ws
  }, [token, cartItemIds])

  useEffect(() => {
    if (isOpen) connectWS()
    return () => {
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [isOpen, connectWS])

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return
    const msg = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    wsRef.current.send(JSON.stringify({
      message: msg,
      context: { module: 'pos', route: '/pos/register', cart_item_ids: cartItemIds, customer_id: customerId },
    }))
    setInput('')
    setLoading(true)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        title="AI Assistant"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 h-96 bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-primary text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-sm font-semibold">AI Cashier</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 max-h-24 overflow-auto">
          {suggestions.map((s, i) => (
            <div key={i} className="mb-1">
              <Badge variant={s.type === 'upsell' ? 'info' : s.type === 'alert' ? 'warning' : 'default'} className="text-[10px]">
                {s.title}
              </Badge>
              {s.items?.map((item, j) => (
                <p key={j} className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                  {item.name} {item.price ? `$${item.price.toFixed(2)}` : ''}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
        {messages.length === 0 && !loading && (
          <div className="text-center text-xs text-gray-400 mt-8">
            <p>Ask me about upsells, demand, pricing, or anything POS-related.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-1.5 rounded-lg text-xs ${
                m.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
              <Spinner size="sm" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask AI..."
          className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent focus:outline-none focus:border-primary"
        />
        <Button size="sm" onClick={sendMessage} disabled={!input.trim() || loading}>
          Send
        </Button>
      </div>
    </div>
  )
}
