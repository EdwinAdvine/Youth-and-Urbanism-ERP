import { useChatStore } from '@/store/chat'

interface TypingIndicatorProps {
  channelId: string
}

export default function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const typingUsers = useChatStore((s) => s.typingUsers[channelId] || [])

  // Filter out stale entries (>5s old)
  const active = typingUsers.filter((t) => Date.now() - t.timestamp < 5000)

  if (active.length === 0) return null

  const names = active.map((t) => t.user_name)
  let text = ''
  if (names.length === 1) {
    text = `${names[0]} is typing`
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`
  } else {
    text = `${names[0]} and ${names.length - 1} others are typing`
  }

  return (
    <div className="flex items-center gap-1.5 px-4 py-1 text-xs text-gray-500">
      <span className="flex gap-0.5">
        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
      <span>{text}</span>
    </div>
  )
}
