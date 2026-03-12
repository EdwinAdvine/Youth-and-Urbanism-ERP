import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, Pencil, Trash2, Bookmark, Pin, SmilePlus } from 'lucide-react'
import type { ChatMessage } from '@/store/chat'
import { useToggleReaction, useDeleteMessage, usePinMessage, useCreateBookmark } from '@/api/chat'
import PresenceIndicator from './PresenceIndicator'

interface MessageItemProps {
  message: ChatMessage
  onThreadClick?: (messageId: string) => void
  onEditClick?: (message: ChatMessage) => void
  currentUserId: string
  showThread?: boolean
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🙏']

export default function MessageItem({
  message,
  onThreadClick,
  onEditClick,
  currentUserId,
  showThread = true,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const toggleReaction = useToggleReaction()
  const deleteMessage = useDeleteMessage()
  const pinMessage = usePinMessage()
  const createBookmark = useCreateBookmark()

  if (message.is_deleted) {
    return (
      <div className="px-4 py-2 text-sm text-gray-400 italic">
        [Message deleted]
      </div>
    )
  }

  const isOwn = message.sender_id === currentUserId
  const sender = message.sender

  // System messages
  if (message.content_type === 'system') {
    return (
      <div className="px-4 py-1.5 text-center text-xs text-gray-500">
        {message.content}
      </div>
    )
  }

  // Card messages (ERP entity cards)
  if (message.content_type === 'card' && message.metadata) {
    return (
      <div className="px-4 py-2">
        <div className="flex items-start gap-3">
          {sender && (
            <div className="relative flex-shrink-0">
              {sender.avatar_url ? (
                <img src={sender.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#51459d] text-white flex items-center justify-center text-xs font-semibold">
                  {sender.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <PresenceIndicator userId={sender.id} size="sm" className="absolute -bottom-0.5 -right-0.5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {sender?.full_name || 'Unknown'}
                {sender?.is_bot && (
                  <span className="ml-1 px-1 py-0.5 text-[10px] bg-[#51459d] text-white rounded">BOT</span>
                )}
              </span>
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
              </span>
            </div>
            {message.content && <p className="text-sm text-gray-500 mb-1">{message.content}</p>}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="text-sm font-medium text-[#51459d]">
                {(message.metadata as Record<string, unknown>).entity_type as string || 'ERP Entity'}
              </div>
              <pre className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                {JSON.stringify(message.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group relative px-4 py-1.5 hover:bg-gray-50 transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactionPicker(false) }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {sender && (
          <div className="relative flex-shrink-0 mt-0.5">
            {sender.avatar_url ? (
              <img src={sender.avatar_url} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#51459d] text-white flex items-center justify-center text-xs font-semibold">
                {sender.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <PresenceIndicator userId={sender.id} size="sm" className="absolute -bottom-0.5 -right-0.5" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {sender?.full_name || 'Unknown'}
              {sender?.is_bot && (
                <span className="ml-1 px-1 py-0.5 text-[10px] bg-[#51459d] text-white rounded">BOT</span>
              )}
            </span>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
            {message.is_edited && (
              <span className="text-xs text-gray-400">(edited)</span>
            )}
          </div>

          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-0.5">
            {message.content}
          </p>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 bg-white">
                  <span className="truncate max-w-[150px]">{att.name}</span>
                  <span className="text-gray-400">{(att.size / 1024).toFixed(0)}KB</span>
                </div>
              ))}
            </div>
          )}

          {/* Reactions */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(message.reactions).map(([emoji, userIds]) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction.mutate({ messageId: message.id, emoji })}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                    userIds.includes(currentUserId)
                      ? 'bg-[#51459d]/10 border-[#51459d]/30 text-[#51459d]'
                      : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{userIds.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* Thread indicator */}
          {showThread && message.thread_reply_count > 0 && (
            <button
              onClick={() => onThreadClick?.(message.id)}
              className="flex items-center gap-1.5 mt-1.5 text-xs text-[#51459d] hover:underline"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{message.thread_reply_count} {message.thread_reply_count === 1 ? 'reply' : 'replies'}</span>
              {message.thread_last_reply_at && (
                <span className="text-gray-400">
                  Last reply {formatDistanceToNow(new Date(message.thread_last_reply_at), { addSuffix: true })}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Action toolbar */}
      {showActions && (
        <div className="absolute top-0 right-4 -translate-y-1/2 flex items-center gap-0.5 bg-white border border-gray-200 rounded-md shadow-sm px-1 py-0.5">
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            title="React"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
          {showThread && (
            <button
              onClick={() => onThreadClick?.(message.id)}
              className="p-1 rounded hover:bg-gray-100 text-gray-500"
              title="Reply in thread"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => createBookmark.mutate({ message_id: message.id })}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            title="Bookmark"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => pinMessage.mutate({ channelId: message.channel_id, messageId: message.id })}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            title="Pin"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          {isOwn && (
            <>
              <button
                onClick={() => onEditClick?.(message)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteMessage.mutate({ messageId: message.id, channelId: message.channel_id })}
                className="p-1 rounded hover:bg-gray-100 text-red-500"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Quick reaction picker */}
      {showReactionPicker && (
        <div className="absolute top-8 right-4 flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1 z-10">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                toggleReaction.mutate({ messageId: message.id, emoji })
                setShowReactionPicker(false)
              }}
              className="p-1 rounded hover:bg-gray-100 text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
