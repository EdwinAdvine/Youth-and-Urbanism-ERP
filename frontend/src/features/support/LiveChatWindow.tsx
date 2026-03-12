import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Modal, Input, toast } from '../../components/ui'
import {
  useChatMessages,
  useCloseChatSession,
  useConvertChatToTicket,
  useTransferChatSession,
  useOnlineAgents,
  type LiveChatMessage,
} from '../../api/support_phase1'
import { useLiveChatWebSocket } from '../../hooks/useLiveChatWebSocket'
import { useAuthStore } from '../../store/auth'

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LiveChatWindow() {
  const { id: sessionId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [inputValue, setInputValue] = useState('')
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferAgentId, setTransferAgentId] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()

  // Initial message history
  const { data: history, isLoading: historyLoading } = useChatMessages(sessionId ?? '')

  // Real-time WebSocket
  const {
    messages: wsMessages,
    isConnected,
    isTyping,
    sendMessage,
    sendTyping,
  } = useLiveChatWebSocket(sessionId ?? '')

  // Mutations
  const closeMutation = useCloseChatSession()
  const convertMutation = useConvertChatToTicket()
  const transferMutation = useTransferChatSession()
  const { data: onlineAgents } = useOnlineAgents()

  // Merge history + ws messages, deduplicate by id
  const allMessages: LiveChatMessage[] = (() => {
    const historyMessages = history ?? []
    const merged = [...historyMessages]
    const existingIds = new Set(historyMessages.map((m) => m.id))
    for (const msg of wsMessages) {
      if (!msg.id || !existingIds.has(msg.id)) {
        merged.push({
          id: msg.id ?? `ws-${merged.length}`,
          session_id: msg.session_id,
          sender_type: msg.sender_type,
          content: msg.content,
          content_type: msg.content_type,
          attachments: null,
          created_at: msg.created_at,
        })
      }
    }
    return merged.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  })()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allMessages.length])

  // Debounced typing indicator
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value)
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
      sendTyping()
      typingTimeout.current = setTimeout(() => {
        // Typing stopped — no further action needed; server auto-clears
      }, 2000)
    },
    [sendTyping]
  )

  const handleSend = () => {
    const text = inputValue.trim()
    if (!text) return
    sendMessage(text)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClose = async () => {
    if (!sessionId) return
    try {
      await closeMutation.mutateAsync(sessionId)
      toast('success', 'Chat session closed')
      navigate('/support/live-chat')
    } catch {
      toast('error', 'Failed to close session')
    }
  }

  const handleConvert = async () => {
    if (!sessionId) return
    try {
      await convertMutation.mutateAsync(sessionId)
      toast('success', 'Chat converted to ticket')
      navigate('/support/tickets')
    } catch {
      toast('error', 'Failed to convert to ticket')
    }
  }

  const handleTransfer = async () => {
    if (!sessionId || !transferAgentId) return
    try {
      await transferMutation.mutateAsync({
        sessionId,
        target_agent_id: transferAgentId,
      })
      toast('success', 'Chat transferred')
      setShowTransfer(false)
      navigate('/support/live-chat')
    } catch {
      toast('error', 'Failed to transfer chat')
    }
  }

  // Derive visitor info from messages or session
  const visitorName = (() => {
    // Try to find a visitor message to get context; fallback to session ID
    const firstVisitorMsg = allMessages.find((m) => m.sender_type === 'visitor')
    return firstVisitorMsg ? 'Visitor' : 'Visitor'
  })()

  const typingEntries = Object.entries(isTyping).filter(([, v]) => v)

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">No session ID provided</p>
      </div>
    )
  }

  if (historyLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/support/live-chat')}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>
          <div className="h-8 w-8 rounded-full bg-[#51459d]/10 flex items-center justify-center">
            <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{visitorName}</p>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? 'success' : 'default'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTransfer(true)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Transfer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConvert}
            loading={convertMutation.isPending}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Convert to Ticket
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[#ff3a6e] border-[#ff3a6e]/30 hover:bg-[#ff3a6e]/5"
            onClick={handleClose}
            loading={closeMutation.isPending}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </Button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-gray-50 dark:bg-gray-900">
        {allMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">No messages yet. Start the conversation.</p>
          </div>
        )}

        {allMessages.map((msg, idx) => {
          const isAgent = msg.sender_type === 'agent'
          const isVisitor = msg.sender_type === 'visitor'
          const isBot = msg.sender_type === 'bot'
          const isSystem = msg.content_type === 'system'

          if (isSystem) {
            return (
              <div key={msg.id ?? idx} className="flex justify-center">
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            )
          }

          return (
            <div
              key={msg.id ?? idx}
              className={cn('flex', isAgent ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[70%] rounded-[10px] px-4 py-2.5 shadow-sm',
                  isAgent && 'bg-[#51459d] text-white',
                  isVisitor && 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700',
                  isBot && 'bg-[#3ec9d6]/10 text-gray-900 dark:text-gray-100 border border-[#3ec9d6]/20'
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isAgent ? 'text-white/70' : 'text-gray-500'
                    )}
                  >
                    {isAgent ? (user?.name || 'Agent') : isBot ? 'Bot' : 'Visitor'}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      isAgent ? 'text-white/50' : 'text-gray-400'
                    )}
                  >
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          )
        })}

        {/* Typing Indicator */}
        {typingEntries.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <input
            type="text"
            className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            placeholder="Type a message..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <Button onClick={handleSend} disabled={!inputValue.trim() || !isConnected}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send
          </Button>
        </div>
        {!isConnected && (
          <p className="text-xs text-[#ff3a6e] mt-2">Disconnected from chat. Attempting to reconnect...</p>
        )}
      </div>

      {/* Transfer Modal */}
      <Modal open={showTransfer} onClose={() => setShowTransfer(false)} title="Transfer Chat" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Select an agent to transfer this chat session to.</p>
          {onlineAgents && onlineAgents.length > 0 ? (
            <div className="space-y-2">
              {onlineAgents
                .filter((a) => a.user_id !== user?.id)
                .map((agent) => (
                  <button
                    key={agent.user_id}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-[10px] border text-left transition-colors',
                      transferAgentId === agent.user_id
                        ? 'border-[#51459d] bg-[#51459d]/5'
                        : 'border-gray-200 dark:border-gray-700 hover:border-[#51459d]/30'
                    )}
                    onClick={() => setTransferAgentId(agent.user_id)}
                  >
                    <div
                      className={cn(
                        'h-2.5 w-2.5 rounded-full flex-shrink-0',
                        agent.status === 'online' ? 'bg-[#6fd943]' : 'bg-[#ffa21d]'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {agent.user_id}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{agent.status}</p>
                    </div>
                  </button>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No other agents online</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowTransfer(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!transferAgentId}
              loading={transferMutation.isPending}
            >
              Transfer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
