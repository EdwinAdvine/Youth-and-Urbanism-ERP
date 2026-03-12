import { useCallback, useRef, useState } from 'react'
import { Paperclip, Send, AtSign, SmilePlus } from 'lucide-react'
import { useSendMessage, useSendTyping } from '@/api/chat'

interface MessageComposerProps {
  channelId: string
  parentId?: string | null
  placeholder?: string
  onSend?: () => void
  sendTypingWs?: (channelId: string) => void
}

export default function MessageComposer({
  channelId,
  parentId = null,
  placeholder = 'Type a message...',
  onSend,
  sendTypingWs,
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendMessage = useSendMessage()
  const sendTyping = useSendTyping()
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const handleSend = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed) return

    sendMessage.mutate(
      {
        channelId,
        payload: {
          content: trimmed,
          parent_id: parentId,
        },
      },
      {
        onSuccess: () => {
          setContent('')
          onSend?.()
          // Reset textarea height
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
          }
        },
      },
    )
  }, [content, channelId, parentId, sendMessage, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value)

      // Auto-resize
      const el = e.target
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`

      // Throttled typing indicator
      if (!typingTimeoutRef.current) {
        sendTypingWs?.(channelId)
        sendTyping.mutate(channelId)
        typingTimeoutRef.current = setTimeout(() => {
          typingTimeoutRef.current = undefined
        }, 3000)
      }
    },
    [channelId, sendTyping, sendTypingWs],
  )

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-[#51459d] focus-within:ring-1 focus-within:ring-[#51459d]/20 transition-all">
        {/* Attach button */}
        <button className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded" title="Attach file">
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none max-h-[200px]"
        />

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded" title="Mention someone">
            <AtSign className="w-4 h-4" />
          </button>
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded" title="Emoji">
            <SmilePlus className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={!content.trim() || sendMessage.isPending}
            className="p-1.5 bg-[#51459d] text-white rounded-lg hover:bg-[#413880] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
