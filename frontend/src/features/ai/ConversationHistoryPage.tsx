import { useState } from 'react'
import { Card, Input, Badge, Button, Spinner } from '../../components/ui'
import {
  useAIConversations,
  useAIConversationMessages,
  type AIConversation,
  type AIConversationMessage,
} from '../../api/ai_ext'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function ConversationHistoryPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useAIConversations({ page, limit: 20 })
  const conversations = data?.conversations ?? []
  const total = data?.total ?? 0

  const filtered = conversations.filter((c) =>
    !search || (c.title ?? c.last_message ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 h-[calc(100vh-64px)]">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Conversation History</h1>
          <p className="text-sm text-gray-500 mt-1">Browse past AI conversations</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 h-[calc(100%-80px)]">
        {/* Conversation List */}
        <div className={`w-full sm:w-96 shrink-0 flex flex-col ${selectedId ? 'hidden sm:flex' : 'flex'}`}>
          <div className="mb-3">
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16"><Spinner /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No conversations found</p>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left p-3 rounded-[10px] transition-colors border ${ selectedId === conv.id ? 'bg-primary/5 border-primary/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800' }`}
                >
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate mb-1">
                    {conv.title || conv.last_message || `Session ${conv.session_id.slice(0, 8)}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-[10px]">{conv.message_count} messages</Badge>
                    <span className="text-[11px] text-gray-400">{formatDate(conv.updated_at)}</span>
                  </div>
                </button>
              ))
            )}
            {total > 20 && (
              <div className="flex justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
                <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            )}
          </div>
        </div>

        {/* Conversation View */}
        {selectedId ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile back button */}
            <button
              onClick={() => setSelectedId(null)}
              className="sm:hidden flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3 min-h-[44px] px-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to conversations
            </button>
            <ConversationView conversationId={selectedId} conversations={conversations} />
          </div>
        ) : (
          <Card className="hidden sm:flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Select a conversation to view</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function ConversationView({ conversationId, conversations }: { conversationId: string; conversations: AIConversation[] }) {
  const { data: messages, isLoading } = useAIConversationMessages(conversationId)
  const convo = conversations.find((c) => c.id === conversationId)

  return (
    <Card className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-gray-100 dark:border-gray-800 pb-3 mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {convo?.title || convo?.last_message || 'Conversation'}
          </p>
          {convo && (
            <p className="text-xs text-gray-400 mt-0.5">{formatFullDate(convo.created_at)}</p>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            No messages in this conversation
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-[10px] p-3 ${ msg.role === 'user' ? 'bg-primary text-white' : msg.role === 'system' ? 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400' : 'bg-gray-50 dark:bg-gray-950 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800' }`}>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                <div className={`flex items-center gap-2 mt-1.5 ${msg.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                  <span className="text-[10px]">{formatDate(msg.timestamp)}</span>
                  {msg.tokens_used && <span className="text-[10px]">{msg.tokens_used} tokens</span>}
                  {msg.model && <span className="text-[10px]">{msg.model}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
