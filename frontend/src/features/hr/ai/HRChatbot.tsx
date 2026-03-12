import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Badge, Button, Spinner } from '../../../components/ui'
import { useHRChatbot } from '@/api/hr_phase3'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
}

// ─── Suggested Questions ──────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'What is our leave policy?',
  'How do I request a salary review?',
  'Who has the highest flight risk this month?',
  'Show me burnout alerts',
  "What's our current headcount by department?",
  'How do I start the onboarding process?',
]

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-8 h-8 rounded-full bg-[#51459d]/10 flex items-center justify-center flex-shrink-0">
        <span className="text-sm">🤖</span>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
              style={{
                animation: 'typing-bounce 1.4s infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#51459d]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">🤖</span>
        </div>
      )}

      <div className={`max-w-[75%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-[10px] text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-[#51459d] text-white rounded-br-sm'
              : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
          }`}
        >
          {message.content}
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.sources.map((src) => (
              <Badge key={src} variant="primary" className="text-[10px]">
                {src}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Welcome Message ───────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hello! I'm your HR Assistant. Ask me anything about HR policies, employee data, or best practices.",
  sources: [],
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HRChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const chatMutation = useHRChatbot()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatMutation.isPending])

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content) return

    const userMessage: ChatMessage = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    try {
      const response = await chatMutation.mutateAsync({
        query: content,
        context: { history: messages.map((m) => ({ role: m.role, content: m.content })) },
      })
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.answer ?? 'I could not process that request.',
        sources: response.sources ?? [],
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Typing bounce animation */}
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>

      <div className="flex h-full min-h-0 bg-gray-50 dark:bg-gray-900" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Left Panel — Suggested Questions */}
        <aside className="w-60 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Suggested Questions
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="w-full text-left px-3 py-2.5 rounded-[10px] text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors leading-snug"
              >
                {q}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
            <div className="w-9 h-9 rounded-full bg-[#51459d]/10 flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">HR Assistant</p>
              <p className="text-xs text-[#6fd943]">Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {chatMutation.isPending && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <textarea
                  rows={1}
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                  placeholder="Ask anything about HR..."
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    // Auto-resize
                    e.target.style.height = 'auto'
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                  }}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <Button
                loading={chatMutation.isPending}
                disabled={!input.trim() && !chatMutation.isPending}
                onClick={() => sendMessage()}
                className="flex-shrink-0"
              >
                {chatMutation.isPending ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                Send
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Press Enter to send, Shift+Enter for a new line</p>
          </div>
        </div>
      </div>
    </>
  )
}
