import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ChatMessage {
  id: string
  channel_id: string
  sender_id: string | null
  content: string
  content_type: 'text' | 'system' | 'file' | 'card' | 'action'
  parent_id: string | null
  thread_reply_count: number
  thread_last_reply_at: string | null
  reactions: Record<string, string[]> | null
  mentions: string[] | null
  attachments: Array<{ file_id: string; name: string; size: number; mime: string }> | null
  metadata: Record<string, unknown> | null
  is_edited: boolean
  is_deleted: boolean
  edited_at: string | null
  created_at: string
  updated_at: string
  sender: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
    is_bot: boolean
  } | null
}

export interface Channel {
  id: string
  team_id: string | null
  name: string
  slug: string
  channel_type: 'public' | 'private' | 'direct' | 'group' | 'announcement'
  topic: string | null
  description: string | null
  is_archived: boolean
  avatar_url: string | null
  last_message_at: string | null
  message_count: number
  created_by: string | null
  linked_entity_type: string | null
  linked_entity_id: string | null
  created_at: string
  updated_at: string
  unread_count: number
  member_count: number
}

export interface PresenceInfo {
  user_id: string
  status: 'online' | 'away' | 'dnd' | 'offline'
  status_message: string | null
  status_emoji: string | null
  last_active: string | null
}

interface ChatState {
  // Active state
  activeChannelId: string | null
  activeThreadId: string | null
  isThreadPanelOpen: boolean

  // Data
  channels: Channel[]
  unreadCounts: Record<string, number>
  typingUsers: Record<string, { user_id: string; user_name: string; timestamp: number }[]>
  presenceMap: Record<string, PresenceInfo>

  // Actions
  setActiveChannel: (channelId: string | null) => void
  setActiveThread: (messageId: string | null) => void
  toggleThreadPanel: () => void
  setChannels: (channels: Channel[]) => void
  addChannel: (channel: Channel) => void
  updateChannel: (channelId: string, updates: Partial<Channel>) => void
  removeChannel: (channelId: string) => void
  setUnreadCount: (channelId: string, count: number) => void
  incrementUnread: (channelId: string) => void
  clearUnread: (channelId: string) => void
  setTypingUser: (channelId: string, userId: string, userName: string) => void
  clearTypingUser: (channelId: string, userId: string) => void
  setPresence: (userId: string, presence: PresenceInfo) => void
  setBulkPresence: (presenceMap: Record<string, PresenceInfo>) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      activeChannelId: null,
      activeThreadId: null,
      isThreadPanelOpen: false,
      channels: [],
      unreadCounts: {},
      typingUsers: {},
      presenceMap: {},

      setActiveChannel: (channelId) =>
        set({ activeChannelId: channelId, activeThreadId: null, isThreadPanelOpen: false }),

      setActiveThread: (messageId) =>
        set({ activeThreadId: messageId, isThreadPanelOpen: messageId !== null }),

      toggleThreadPanel: () =>
        set((s) => ({ isThreadPanelOpen: !s.isThreadPanelOpen })),

      setChannels: (channels) => set({ channels }),

      addChannel: (channel) =>
        set((s) => ({ channels: [channel, ...s.channels] })),

      updateChannel: (channelId, updates) =>
        set((s) => ({
          channels: s.channels.map((ch) =>
            ch.id === channelId ? { ...ch, ...updates } : ch,
          ),
        })),

      removeChannel: (channelId) =>
        set((s) => ({
          channels: s.channels.filter((ch) => ch.id !== channelId),
          activeChannelId: s.activeChannelId === channelId ? null : s.activeChannelId,
        })),

      setUnreadCount: (channelId, count) =>
        set((s) => ({ unreadCounts: { ...s.unreadCounts, [channelId]: count } })),

      incrementUnread: (channelId) =>
        set((s) => ({
          unreadCounts: {
            ...s.unreadCounts,
            [channelId]: (s.unreadCounts[channelId] || 0) + 1,
          },
        })),

      clearUnread: (channelId) =>
        set((s) => ({ unreadCounts: { ...s.unreadCounts, [channelId]: 0 } })),

      setTypingUser: (channelId, userId, userName) =>
        set((s) => {
          const existing = s.typingUsers[channelId] || []
          const filtered = existing.filter((t) => t.user_id !== userId)
          return {
            typingUsers: {
              ...s.typingUsers,
              [channelId]: [...filtered, { user_id: userId, user_name: userName, timestamp: Date.now() }],
            },
          }
        }),

      clearTypingUser: (channelId, userId) =>
        set((s) => {
          const existing = s.typingUsers[channelId] || []
          return {
            typingUsers: {
              ...s.typingUsers,
              [channelId]: existing.filter((t) => t.user_id !== userId),
            },
          }
        }),

      setPresence: (userId, presence) =>
        set((s) => ({ presenceMap: { ...s.presenceMap, [userId]: presence } })),

      setBulkPresence: (presenceMap) =>
        set((s) => ({ presenceMap: { ...s.presenceMap, ...presenceMap } })),
    }),
    {
      name: 'urban-chat-store',
      partialize: (state) => ({
        activeChannelId: state.activeChannelId,
      }),
    },
  ),
)
