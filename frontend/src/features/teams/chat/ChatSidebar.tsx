import { useState } from 'react'
import { Hash, Lock, MessageCircle, Plus, Search, ChevronDown, ChevronRight, Users, Star, Megaphone } from 'lucide-react'
import { useChannels, useCreateChannel } from '@/api/chat'
import { useChatStore, type Channel } from '@/store/chat'
import PresenceIndicator from './PresenceIndicator'

interface ChatSidebarProps {
  currentUserId: string
}

const channelTypeIcons: Record<string, React.ReactNode> = {
  public: <Hash className="w-4 h-4 text-gray-400" />,
  private: <Lock className="w-4 h-4 text-gray-400" />,
  announcement: <Megaphone className="w-4 h-4 text-yellow-500" />,
}

export default function ChatSidebar({ currentUserId }: ChatSidebarProps) {
  const { data } = useChannels()
  const { activeChannelId, setActiveChannel, unreadCounts } = useChatStore()
  const createChannel = useCreateChannel()
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    channels: true,
    dms: true,
  })

  const channels = data?.channels || []

  // Separate channels by type
  const teamChannels = channels.filter(
    (ch) => ch.channel_type === 'public' || ch.channel_type === 'private' || ch.channel_type === 'announcement',
  )
  const dmChannels = channels.filter(
    (ch) => ch.channel_type === 'direct' || ch.channel_type === 'group',
  )

  // Filter by search
  const filteredTeam = searchQuery
    ? teamChannels.filter((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : teamChannels
  const filteredDMs = searchQuery
    ? dmChannels.filter((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : dmChannels

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) return
    createChannel.mutate(
      { name: newChannelName.trim(), channel_type: 'public' },
      {
        onSuccess: (ch) => {
          setActiveChannel(ch.id)
          setNewChannelName('')
          setShowNewChannel(false)
        },
      },
    )
  }

  const getDMDisplayName = (channel: Channel) => {
    return channel.name.replace('DM: ', '').split(' & ').find((n) => n !== currentUserId) || channel.name
  }

  return (
    <div className="flex flex-col h-full w-[280px] border-r border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900">Y&U Teams</h2>
        <button
          onClick={() => setShowNewChannel(true)}
          className="p-1.5 text-gray-500 hover:text-[#51459d] hover:bg-gray-100 rounded-lg transition-colors"
          title="Create channel"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#51459d] focus:border-[#51459d]"
          />
        </div>
      </div>

      {/* New channel form */}
      {showNewChannel && (
        <div className="px-3 py-2 border-b border-gray-200">
          <input
            type="text"
            placeholder="Channel name"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#51459d]"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleCreateChannel}
              disabled={!newChannelName.trim()}
              className="flex-1 py-1 text-xs bg-[#51459d] text-white rounded-lg hover:bg-[#413880] disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => { setShowNewChannel(false); setNewChannelName('') }}
              className="flex-1 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {/* Team Channels */}
        <div className="py-1">
          <button
            onClick={() => toggleSection('channels')}
            className="flex items-center gap-1 px-3 py-1.5 w-full text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
          >
            {expandedSections.channels ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Channels
            <span className="ml-auto text-gray-400">{filteredTeam.length}</span>
          </button>

          {expandedSections.channels && filteredTeam.map((ch) => {
            const unread = unreadCounts[ch.id] || 0
            const isActive = activeChannelId === ch.id
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`flex items-center gap-2 px-3 py-1.5 w-full text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
                    : unread > 0
                      ? 'text-gray-900 font-medium hover:bg-gray-100'
                      : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {channelTypeIcons[ch.channel_type] || <Hash className="w-4 h-4 text-gray-400" />}
                <span className="truncate flex-1">{ch.name}</span>
                {unread > 0 && (
                  <span className="flex-shrink-0 min-w-[20px] h-5 flex items-center justify-center bg-[#51459d] text-white text-[10px] font-bold rounded-full px-1.5">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Direct Messages */}
        <div className="py-1">
          <button
            onClick={() => toggleSection('dms')}
            className="flex items-center gap-1 px-3 py-1.5 w-full text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
          >
            {expandedSections.dms ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Direct Messages
            <span className="ml-auto text-gray-400">{filteredDMs.length}</span>
          </button>

          {expandedSections.dms && filteredDMs.map((ch) => {
            const unread = unreadCounts[ch.id] || 0
            const isActive = activeChannelId === ch.id
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`flex items-center gap-2 px-3 py-1.5 w-full text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
                    : unread > 0
                      ? 'text-gray-900 font-medium hover:bg-gray-100'
                      : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <MessageCircle className="w-4 h-4 text-gray-400" />
                <span className="truncate flex-1">{getDMDisplayName(ch)}</span>
                {unread > 0 && (
                  <span className="flex-shrink-0 min-w-[20px] h-5 flex items-center justify-center bg-[#51459d] text-white text-[10px] font-bold rounded-full px-1.5">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
