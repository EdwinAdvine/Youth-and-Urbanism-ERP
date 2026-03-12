import { useEffect, useRef } from 'react'
import { useMessages, useMarkChannelRead } from '@/api/chat'
import { useChatStore, type Channel as ChannelType } from '@/store/chat'
import ChannelHeader from './ChannelHeader'
import MessageItem from './MessageItem'
import MessageComposer from './MessageComposer'
import TypingIndicator from './TypingIndicator'

interface ChatPanelProps {
  channel: ChannelType
  currentUserId: string
  sendTypingWs?: (channelId: string) => void
}

export default function ChatPanel({ channel, currentUserId, sendTypingWs }: ChatPanelProps) {
  const { data, isLoading } = useMessages(channel.id)
  const markRead = useMarkChannelRead()
  const setActiveThread = useChatStore((s) => s.setActiveThread)
  const clearUnread = useChatStore((s) => s.clearUnread)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.messages?.length])

  // Mark channel as read when viewing
  useEffect(() => {
    markRead.mutate(channel.id)
    clearUnread(channel.id)
  }, [channel.id])

  return (
    <div className="flex flex-col h-full bg-white">
      <ChannelHeader channel={channel} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Loading messages...
          </div>
        ) : data?.messages && data.messages.length > 0 ? (
          <div className="py-4">
            {data.has_more && (
              <div className="text-center py-2">
                <button className="text-xs text-[#51459d] hover:underline">
                  Load older messages
                </button>
              </div>
            )}
            {data.messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                currentUserId={currentUserId}
                onThreadClick={(msgId) => setActiveThread(msgId)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Be the first to say something!</p>
          </div>
        )}
      </div>

      {/* Typing indicator */}
      <TypingIndicator channelId={channel.id} />

      {/* Composer */}
      <MessageComposer
        channelId={channel.id}
        sendTypingWs={sendTypingWs}
        placeholder={
          channel.channel_type === 'direct'
            ? `Message ${channel.name.replace('DM: ', '').split(' & ')[1] || ''}`
            : `Message #${channel.name}`
        }
      />
    </div>
  )
}
