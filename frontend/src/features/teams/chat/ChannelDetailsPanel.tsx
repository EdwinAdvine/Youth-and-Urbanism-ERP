import { useState } from 'react'
import {
  X,
  Hash,
  Lock,
  Megaphone,
  Users,
  Pin,
  Bookmark,
  LayoutGrid,
  Share2,
  Pencil,
  Archive,
  LogOut,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Channel } from '@/store/chat'
import {
  useChannelMembers,
  usePinnedMessages,
  useBookmarks,
  useChannelTabs,
  useUpdateChannel,
  useArchiveChannel,
  useRemoveChannelMember,
  type ChannelMember,
  type PinnedMessage,
  type Bookmark as BookmarkType,
  type ChannelTab,
} from '@/api/chat'
import { useSharedChannels } from '@/api/chatExtended'
import { Button, Badge, Input, Spinner } from '@/components/ui/index'
import PresenceIndicator from './PresenceIndicator'

interface ChannelDetailsPanelProps {
  channel: Channel
  currentUserId: string
  onClose: () => void
}

type PanelSection = 'about' | 'members' | 'pins' | 'bookmarks' | 'tabs'

const channelTypeIcon: Record<string, React.ReactNode> = {
  public: <Hash className="w-5 h-5 text-gray-500" />,
  private: <Lock className="w-5 h-5 text-gray-500" />,
  announcement: <Megaphone className="w-5 h-5 text-[#ffa21d]" />,
}

export default function ChannelDetailsPanel({
  channel,
  currentUserId,
  onClose,
}: ChannelDetailsPanelProps) {
  const [activeSection, setActiveSection] = useState<PanelSection>('about')
  const [editing, setEditing] = useState(false)
  const [editTopic, setEditTopic] = useState(channel.topic || '')
  const [editDescription, setEditDescription] = useState(channel.description || '')

  const { data: members, isLoading: membersLoading } = useChannelMembers(channel.id)
  const { data: pinnedMessages, isLoading: pinsLoading } = usePinnedMessages(channel.id)
  const { data: bookmarks, isLoading: bookmarksLoading } = useBookmarks()
  const { data: tabs, isLoading: tabsLoading } = useChannelTabs(channel.id)
  const { data: sharedChannels } = useSharedChannels(channel.team_id || undefined)

  const updateChannel = useUpdateChannel()
  const archiveChannel = useArchiveChannel()
  const removeMember = useRemoveChannelMember()

  const isShared = sharedChannels?.some(
    (sc: { channel_id: string }) => sc.channel_id === channel.id
  )

  const handleSaveEdit = () => {
    updateChannel.mutate(
      {
        channelId: channel.id,
        payload: { topic: editTopic, description: editDescription },
      },
      { onSuccess: () => setEditing(false) }
    )
  }

  const handleArchive = () => {
    if (window.confirm('Are you sure you want to archive this channel?')) {
      archiveChannel.mutate(channel.id)
    }
  }

  const handleLeave = () => {
    if (window.confirm('Are you sure you want to leave this channel?')) {
      removeMember.mutate(
        { channelId: channel.id, userId: currentUserId },
        { onSuccess: () => onClose() }
      )
    }
  }

  const sectionTabs: { key: PanelSection; label: string; icon: React.ReactNode; count?: number }[] =
    [
      { key: 'about', label: 'About', icon: <Hash className="w-3.5 h-3.5" /> },
      {
        key: 'members',
        label: 'Members',
        icon: <Users className="w-3.5 h-3.5" />,
        count: members?.length || channel.member_count,
      },
      {
        key: 'pins',
        label: 'Pins',
        icon: <Pin className="w-3.5 h-3.5" />,
        count: pinnedMessages?.length,
      },
      {
        key: 'bookmarks',
        label: 'Bookmarks',
        icon: <Bookmark className="w-3.5 h-3.5" />,
        count: bookmarks?.length,
      },
      {
        key: 'tabs',
        label: 'Tabs',
        icon: <LayoutGrid className="w-3.5 h-3.5" />,
        count: tabs?.length,
      },
    ]

  return (
    <div className="w-[380px] h-full flex flex-col border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          {channelTypeIcon[channel.channel_type] || <Hash className="w-5 h-5 text-gray-500" />}
          <h3 className="text-sm font-semibold text-gray-900 truncate">{channel.name}</h3>
          {isShared && (
            <Share2 className="w-3.5 h-3.5 text-[#3ec9d6] flex-shrink-0" title="Shared channel" />
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-gray-200 px-2">
        {sectionTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeSection === tab.key
                ? 'text-[#51459d] border-[#51459d]'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-0.5 text-[10px] bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* About section */}
        {activeSection === 'about' && (
          <div className="p-4 space-y-4">
            {editing ? (
              <div className="space-y-3">
                <Input
                  label="Topic"
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  placeholder="Channel topic"
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
                    placeholder="Describe this channel"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit} loading={updateChannel.isPending}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {channel.topic && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Topic
                    </h4>
                    <p className="text-sm text-gray-800">{channel.topic}</p>
                  </div>
                )}
                {channel.description && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Description
                    </h4>
                    <p className="text-sm text-gray-600">{channel.description}</p>
                  </div>
                )}
                {!channel.topic && !channel.description && (
                  <p className="text-sm text-gray-400">
                    No topic or description set for this channel.
                  </p>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Details
                  </h4>
                  <div className="space-y-1.5 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Type</span>
                      <Badge variant="primary">{channel.channel_type}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Members</span>
                      <span className="font-medium">{channel.member_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Messages</span>
                      <span className="font-medium">{channel.message_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created</span>
                      <span className="font-medium">
                        {formatDistanceToNow(new Date(channel.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {isShared && (
                      <div className="flex justify-between">
                        <span>Shared</span>
                        <Badge variant="info">
                          <Share2 className="w-3 h-3 mr-1" />
                          Shared
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Members section */}
        {activeSection === 'members' && (
          <div className="p-4">
            {membersLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : members && members.length > 0 ? (
              <ul className="space-y-1">
                {members.map((member: ChannelMember) => (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      {member.user_avatar ? (
                        <img
                          src={member.user_avatar}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#51459d] text-white flex items-center justify-center text-xs font-semibold">
                          {(member.user_name || member.user_email || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <PresenceIndicator
                        userId={member.user_id}
                        size="sm"
                        className="absolute -bottom-0.5 -right-0.5"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.user_name || member.user_email || 'Unknown'}
                        {member.is_bot && (
                          <span className="ml-1 px-1 py-0.5 text-[10px] bg-[#51459d] text-white rounded">
                            BOT
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                    </div>
                    {member.is_muted && (
                      <Badge variant="default">Muted</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No members found</p>
            )}
          </div>
        )}

        {/* Pinned messages section */}
        {activeSection === 'pins' && (
          <div className="p-4">
            {pinsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : pinnedMessages && pinnedMessages.length > 0 ? (
              <ul className="space-y-2">
                {pinnedMessages.map((pin: PinnedMessage) => (
                  <li
                    key={pin.id}
                    className="border border-gray-200 rounded-[10px] p-3 hover:bg-gray-50 transition-colors"
                  >
                    {pin.message ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <Pin className="w-3 h-3 text-[#ffa21d]" />
                          <span className="text-xs font-medium text-gray-900">
                            {pin.message.sender?.full_name || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(pin.message.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-3">
                          {pin.message.content}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Message unavailable</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8">
                <Pin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No pinned messages</p>
              </div>
            )}
          </div>
        )}

        {/* Bookmarks section */}
        {activeSection === 'bookmarks' && (
          <div className="p-4">
            {bookmarksLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : bookmarks && bookmarks.length > 0 ? (
              <ul className="space-y-2">
                {bookmarks.map((bm: BookmarkType) => (
                  <li
                    key={bm.id}
                    className="border border-gray-200 rounded-[10px] p-3 hover:bg-gray-50 transition-colors"
                  >
                    {bm.message ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <Bookmark className="w-3 h-3 text-[#51459d]" />
                          <span className="text-xs font-medium text-gray-900">
                            {bm.message.sender?.full_name || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(bm.message.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-3">
                          {bm.message.content}
                        </p>
                        {bm.note && (
                          <p className="mt-1 text-xs text-[#51459d] italic">Note: {bm.note}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Message unavailable</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8">
                <Bookmark className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No bookmarks</p>
              </div>
            )}
          </div>
        )}

        {/* Tabs section */}
        {activeSection === 'tabs' && (
          <div className="p-4">
            {tabsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : tabs && tabs.length > 0 ? (
              <ul className="space-y-2">
                {tabs.map((tab: ChannelTab) => (
                  <li
                    key={tab.id}
                    className="flex items-center gap-3 border border-gray-200 rounded-[10px] p-3 hover:bg-gray-50 transition-colors"
                  >
                    <LayoutGrid className="w-4 h-4 text-[#3ec9d6] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{tab.label}</p>
                      <p className="text-xs text-gray-500 capitalize">{tab.tab_type}</p>
                    </div>
                    <Badge variant="default">#{tab.position}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8">
                <LayoutGrid className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No tabs configured</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => setEditing(true)}
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={handleArchive}
          loading={archiveChannel.isPending}
        >
          <Archive className="w-3.5 h-3.5" />
          Archive
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="flex-1"
          onClick={handleLeave}
          loading={removeMember.isPending}
        >
          <LogOut className="w-3.5 h-3.5" />
          Leave
        </Button>
      </div>
    </div>
  )
}
