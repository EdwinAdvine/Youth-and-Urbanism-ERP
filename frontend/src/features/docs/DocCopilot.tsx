import { useState, useRef, useEffect } from 'react'
import { useDocCopilot } from '../../hooks/useDocCopilot'

interface DocCopilotProps {
  fileId: string
  onClose: () => void
  onInsert?: (text: string) => void
}

const QUICK_PROMPTS = [
  { label: 'Summarize', prompt: 'Summarize this document concisely' },
  { label: 'Key points', prompt: 'List the key points from this document' },
  { label: 'Improve writing', prompt: 'Suggest improvements to the writing style' },
  { label: 'Fix grammar', prompt: 'Find and fix any grammar issues' },
]

export default function DocCopilot({ fileId, onClose, onInsert }: DocCopilotProps) {
  const { messages, streaming, connected, streamBuffer, sendMessage, clearMessages } = useDocCopilot(fileId)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamBuffer])

  const handleSend = () => {
    const text = input.trim()
    if (!text || streaming) return
    sendMessage(text)
    setInput('')
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-20 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[6px] bg-[#51459d]/10 flex items-center justify-center">
            <svg className="h-3.5 w-3.5 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Doc Copilot</h3>
          {connected && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#6fd943]" title="Connected" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-400"
            title="Clear chat"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#51459d]/10 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ask me anything about this document</p>
            <p className="text-[10px] text-gray-400">I can help with writing, summarizing, and more</p>

            {/* Quick prompts */}
            <div className="grid grid-cols-2 gap-1.5 mt-4">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => sendMessage(q.prompt)}
                  className="px-2 py-1.5 text-[10px] font-medium text-[#51459d] bg-[#51459d]/5 rounded-[6px] hover:bg-[#51459d]/10 transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-[8px] px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-[#51459d] text-white'
                  : 'bg-gray-50 dark:bg-gray-950 text-gray-700 dark:text-gray-300'
              }`}
            >
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.role === 'assistant' && onInsert && (
                <button
                  onClick={() => onInsert(msg.content)}
                  className="mt-1.5 text-[9px] text-[#51459d] hover:underline"
                >
                  Insert into document
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-[8px] px-3 py-2 bg-gray-50 dark:bg-gray-950">
              {streamBuffer ? (
                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {streamBuffer}
                  <span className="inline-block w-1.5 h-3.5 bg-[#51459d] animate-pulse ml-0.5" />
                </p>
              ) : (
                <div className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 text-[#51459d]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-[10px] text-gray-400">Thinking...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-3 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={connected ? 'Ask about this document...' : 'Connecting...'}
            disabled={!connected || streaming}
            className="flex-1 px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming || !connected}
            className="px-3 py-2 bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[9px] text-gray-400 text-center mt-1.5">
          Powered by Urban Vibes Dynamics AI
        </p>
      </div>
    </div>
  )
}
