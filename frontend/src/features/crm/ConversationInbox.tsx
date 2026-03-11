import { useState, useRef, useEffect } from 'react'
import {
  useConversations,
  useCreateConversation,
  useConversation,
  useAddMessage,
  useAssignConversation,
  useResolveConversation,
  type Conversation,
  type ConversationCreatePayload,
} from '@/api/crm_service'
import { Button, Spinner, Modal, Input, Select, toast } from '@/components/ui'

type Channel = 'email' | 'chat' | 'phone' | 'social' | 'web'
type ConvoStatus = 'open' | 'assigned' | 'resolved' | 'closed'

const CHANNELS: Channel[] = ['email', 'chat', 'phone', 'social', 'web']
const STATUSES: ConvoStatus[] = ['open', 'assigned', 'resolved', 'closed']

const CHANNEL_ICONS: Record<string, string> = {
  email: '\u{1F4E7}',
  chat: '\u{1F4AC}',
  phone: '\u{1F4DE}',
  social: '\u{1F310}',
  web: '\u{1F4CB}',
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  chat: 'Chat',
  phone: 'Phone',
  social: 'Social',
  web: 'Web',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-[#3ec9d6]/10 text-[#3ec9d6]',
  assigned: 'bg-[#ffa21d]/10 text-[#ffa21d]',
  resolved: 'bg-[#6fd943]/10 text-[#6fd943]',
  closed: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  assigned: 'Assigned',
  resolved: 'Resolved',
  closed: 'Closed',
}

const SENDER_COLORS: Record<string, string> = {
  customer: 'bg-gray-100 text-gray-700',
  agent: 'bg-[#51459d]/10 text-[#51459d]',
  system: 'bg-[#3ec9d6]/10 text-[#3ec9d6]',
  ai: 'bg-[#6fd943]/10 text-[#6fd943]',
}

const EMPTY_CREATE: ConversationCreatePayload = {
  channel: 'chat',
  subject: '',
  contact_id: null,
}

export default function ConversationInbox() {
  const [channelFilter, setChannelFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<ConversationCreatePayload>(EMPTY_CREATE)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTo, setAssignTo] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: convosData, isLoading } = useConversations({
    channel: channelFilter || undefined,
    status: statusFilter || undefined,
  })
  const conversations: Conversation[] = convosData?.conversations ?? convosData ?? []

  const { data: activeConvo, isLoading: convoLoading } = useConversation(selectedId)

  const createMutation = useCreateConversation()
  const addMessageMutation = useAddMessage(selectedId)
  const assignMutation = useAssignConversation()
  const resolveMutation = useResolveConversation()

  const messages = activeConvo?.messages ?? []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleCreate = async () => {
    try {
      const created = await createMutation.mutateAsync(createForm)
      toast('success', 'Conversation created')
      setCreateOpen(false)
      setCreateForm(EMPTY_CREATE)
      setSelectedId(created.id)
    } catch {
      toast('error', 'Failed to create conversation')
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedId) return
    try {
      await addMessageMutation.mutateAsync({
        sender_type: 'agent',
        content: newMessage.trim(),
        content_type: 'text',
      })
      setNewMessage('')
    } catch {
      toast('error', 'Failed to send message')
    }
  }

  const handleAssign = async () => {
    if (!assignTo.trim() || !selectedId) return
    try {
      await assignMutation.mutateAsync({ conversationId: selectedId, assignTo: assignTo.trim() })
      toast('success', 'Conversation assigned')
      setAssignOpen(false)
      setAssignTo('')
    } catch {
      toast('error', 'Failed to assign conversation')
    }
  }

  const handleResolve = async () => {
    if (!selectedId) return
    try {
      await resolveMutation.mutateAsync(selectedId)
      toast('success', 'Conversation resolved')
    } catch {
      toast('error', 'Failed to resolve conversation')
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Conversation Inbox</h1>
          <p className="text-sm text-gray-500 mt-1">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Conversation</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
        >
          <option value="">All Channels</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>{CHANNEL_ICONS[c]} {CHANNEL_LABELS[c]}</option>
          ))}
        </Select>
      </div>

      {/* Split Layout */}
      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Left Panel — Conversation List */}
        <div className="w-[360px] flex-shrink-0 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex justify-center items-center flex-1"><Spinner size="lg" /></div>
          ) : conversations.length === 0 ? (
            <div className="flex justify-center items-center flex-1 text-gray-400 text-sm px-4 text-center">
              No conversations found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedId(convo.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                    selectedId === convo.id ? 'bg-[#51459d]/5 border-l-2 border-l-[#51459d]' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg mt-0.5" title={CHANNEL_LABELS[convo.channel] ?? convo.channel}>
                      {CHANNEL_ICONS[convo.channel] ?? '\u{1F4AC}'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {convo.subject || `Conversation #${convo.id.slice(0, 8)}`}
                        </span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatTime(convo.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[convo.status] ?? STATUS_COLORS.open}`}>
                          {STATUS_LABELS[convo.status] ?? convo.status}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {CHANNEL_LABELS[convo.channel] ?? convo.channel}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel — Message Thread */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          {!selectedId ? (
            <div className="flex justify-center items-center flex-1 text-gray-400 text-sm">
              Select a conversation to view messages
            </div>
          ) : convoLoading ? (
            <div className="flex justify-center items-center flex-1"><Spinner size="lg" /></div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{CHANNEL_ICONS[activeConvo?.channel ?? ''] ?? '\u{1F4AC}'}</span>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {activeConvo?.subject || `Conversation #${selectedId.slice(0, 8)}`}
                    </h3>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[activeConvo?.status ?? 'open']}`}>
                      {STATUS_LABELS[activeConvo?.status ?? 'open'] ?? activeConvo?.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                    Assign
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResolve}
                    loading={resolveMutation.isPending}
                    disabled={activeConvo?.status === 'resolved' || activeConvo?.status === 'closed'}
                    className="text-[#6fd943] border-[#6fd943]/30 hover:bg-[#6fd943]/10"
                  >
                    Resolve
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">
                    No messages yet. Send the first message below.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isCustomer = msg.sender_type === 'customer'
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[70%] ${isCustomer ? 'order-1' : 'order-1'}`}>
                          <div
                            className={`rounded-[10px] px-3 py-2 text-sm ${
                              isCustomer
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                                : 'bg-[#51459d] text-white'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1 ${isCustomer ? '' : 'justify-end'}`}>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${SENDER_COLORS[msg.sender_type] ?? SENDER_COLORS.agent}`}>
                              {msg.sender_type}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/40"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendMessage}
                    loading={addMessageMutation.isPending}
                    disabled={!newMessage.trim()}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Conversation Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Conversation">
        <div className="space-y-4">
          <Input
            label="Subject"
            value={createForm.subject ?? ''}
            onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
            placeholder="Conversation subject"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Channel</label>
            <Select
              value={createForm.channel}
              onChange={(e) => setCreateForm({ ...createForm, channel: e.target.value })}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{CHANNEL_ICONS[c]} {CHANNEL_LABELS[c]}</option>
              ))}
            </Select>
          </div>
          <Input
            label="Contact ID (optional)"
            value={createForm.contact_id ?? ''}
            onChange={(e) => setCreateForm({ ...createForm, contact_id: e.target.value || null })}
            placeholder="Contact UUID"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Conversation">
        <div className="space-y-4">
          <Input
            label="Assign to (User ID)"
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            placeholder="Enter user ID to assign"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} loading={assignMutation.isPending}>
              Assign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
