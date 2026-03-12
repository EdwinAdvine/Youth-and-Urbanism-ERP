import { useChatStore } from '@/store/chat'

interface PresenceIndicatorProps {
  userId: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
}

const colorMap: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-400',
}

export default function PresenceIndicator({ userId, size = 'md', className = '' }: PresenceIndicatorProps) {
  const presence = useChatStore((s) => s.presenceMap[userId])
  const status = presence?.status || 'offline'

  return (
    <span
      className={`inline-block rounded-full border-2 border-white ${sizeMap[size]} ${colorMap[status]} ${className}`}
      title={status === 'dnd' ? 'Do not disturb' : status}
    />
  )
}
