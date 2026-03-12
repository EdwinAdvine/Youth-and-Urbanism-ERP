import { X } from 'lucide-react'
import { useThread } from '@/api/chat'
import { useChatStore } from '@/store/chat'
import MessageItem from './MessageItem'
import MessageComposer from './MessageComposer'

interface ThreadPanelProps {
  messageId: string
  currentUserId: string
  sendTypingWs?: (channelId: string) => void
}

export default function ThreadPanel({ messageId, currentUserId, sendTypingWs }: ThreadPanelProps) {
  const { data, isLoading } = useThread(messageId)
  const setActiveThread = useChatStore((s) => s.setActiveThread)

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white w-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Thread</h3>
        <button
          onClick={() => setActiveThread(null)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            Loading thread...
          </div>
        ) : data ? (
          <div className="py-2">
            {/* Root message */}
            <div className="border-b border-gray-100 pb-2 mb-2">
              <MessageItem
                message={data.root_message}
                currentUserId={currentUserId}
                showThread={false}
              />
            </div>

            {/* Reply count */}
            <div className="px-4 py-2 text-xs text-gray-500">
              {data.total_replies} {data.total_replies === 1 ? 'reply' : 'replies'}
            </div>

            {/* Replies */}
            {data.replies.map((reply) => (
              <MessageItem
                key={reply.id}
                message={reply}
                currentUserId={currentUserId}
                showThread={false}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Reply composer */}
      {data && (
        <MessageComposer
          channelId={data.root_message.channel_id}
          parentId={messageId}
          placeholder="Reply..."
          sendTypingWs={sendTypingWs}
        />
      )}
    </div>
  )
}
