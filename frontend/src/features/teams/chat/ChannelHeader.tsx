import { Hash, Lock, Users, Pin, Search, Phone, Video, Settings } from 'lucide-react'
import type { Channel } from '@/store/chat'
import { useChannelMembers } from '@/api/chat'

interface ChannelHeaderProps {
  channel: Channel
  onSearchClick?: () => void
  onMembersClick?: () => void
  onPinsClick?: () => void
  onCallClick?: () => void
  onSettingsClick?: () => void
}

const channelIcon: Record<string, React.ReactNode> = {
  public: <Hash className="w-5 h-5 text-gray-500" />,
  private: <Lock className="w-5 h-5 text-gray-500" />,
  announcement: <Hash className="w-5 h-5 text-yellow-500" />,
}

export default function ChannelHeader({
  channel,
  onSearchClick,
  onMembersClick,
  onPinsClick,
  onCallClick,
  onSettingsClick,
}: ChannelHeaderProps) {
  const { data: members } = useChannelMembers(channel.id)

  const isDM = channel.channel_type === 'direct' || channel.channel_type === 'group'

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      {/* Left: Channel info */}
      <div className="flex items-center gap-2 min-w-0">
        {!isDM && channelIcon[channel.channel_type]}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {isDM ? channel.name.replace('DM: ', '') : channel.name}
          </h2>
          {channel.topic && (
            <p className="text-xs text-gray-500 truncate">{channel.topic}</p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {isDM && (
          <>
            <button
              onClick={onCallClick}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Audio call"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={onCallClick}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Video call"
            >
              <Video className="w-4 h-4" />
            </button>
          </>
        )}

        <button
          onClick={onPinsClick}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Pinned messages"
        >
          <Pin className="w-4 h-4" />
        </button>

        <button
          onClick={onMembersClick}
          className="flex items-center gap-1 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Members"
        >
          <Users className="w-4 h-4" />
          <span className="text-xs">{members?.length || channel.member_count}</span>
        </button>

        <button
          onClick={onSearchClick}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Search in channel"
        >
          <Search className="w-4 h-4" />
        </button>

        {!isDM && (
          <button
            onClick={onSettingsClick}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Channel settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
