/**
 * Chat API client — team channels, messages, members, and channel tabs.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/chat`.
 *
 * Key exports:
 *   - useChannels() — list public/private/DM channels with optional team filter
 *   - useCreateChannel() — create a new channel (public, private, DM, or group)
 *   - useJoinChannel() — add the current user to a channel
 *   - useDiscoverChannels() — browse joinable public channels
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import type { Channel, ChatMessage } from '@/store/chat'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChannelCreatePayload {
  team_id?: string | null
  name: string
  channel_type?: 'public' | 'private' | 'direct' | 'group' | 'announcement'
  topic?: string
  description?: string
  member_ids?: string[]
}

export interface ChannelUpdatePayload {
  name?: string
  topic?: string
  description?: string
  avatar_url?: string
}

export interface MessageCreatePayload {
  content: string
  content_type?: 'text' | 'system' | 'file' | 'card' | 'action'
  parent_id?: string | null
  mentions?: string[]
  attachments?: Array<{ file_id: string; name: string; size: number; mime: string }>
  metadata?: Record<string, unknown>
}

export interface ChannelMember {
  id: string
  user_id: string
  role: string
  notifications_pref: string
  is_muted: boolean
  last_read_at: string | null
  joined_at: string
  user_name: string | null
  user_email: string | null
  user_avatar: string | null
  is_bot: boolean
}

export interface ChannelTab {
  id: string
  channel_id: string
  tab_type: string
  label: string
  config: Record<string, unknown> | null
  position: number
  created_at: string
}

export interface PinnedMessage {
  id: string
  channel_id: string
  message_id: string
  pinned_by: string | null
  created_at: string
  message: ChatMessage | null
}

export interface Bookmark {
  id: string
  user_id: string
  message_id: string
  note: string | null
  created_at: string
  message: ChatMessage | null
}

export interface PresenceInfo {
  user_id: string
  status: string
  status_message: string | null
  status_emoji: string | null
  last_active: string | null
}

interface ChannelListResponse {
  channels: Channel[]
  total: number
}

interface MessageListResponse {
  messages: ChatMessage[]
  has_more: boolean
  next_cursor: string | null
}

interface ThreadResponse {
  root_message: ChatMessage
  replies: ChatMessage[]
  total_replies: number
}

interface SearchResponse {
  messages: ChatMessage[]
  total: number
}

// ─── Channel Hooks ────────────────────────────────────────────────────────────

export function useChannels(params?: { team_id?: string; channel_type?: string; include_archived?: boolean }) {
  return useQuery({
    queryKey: ['chat', 'channels', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ChannelListResponse>('/chat/channels', { params })
      return data
    },
  })
}

export function useDiscoverChannels(params?: { team_id?: string; search?: string }) {
  return useQuery({
    queryKey: ['chat', 'discover', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ChannelListResponse>('/chat/channels/discover', { params })
      return data
    },
  })
}

export function useChannel(channelId: string) {
  return useQuery({
    queryKey: ['chat', 'channel', channelId],
    queryFn: async () => {
      const { data } = await apiClient.get<Channel>(`/chat/channels/${channelId}`)
      return data
    },
    enabled: !!channelId,
  })
}

export function useCreateChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ChannelCreatePayload) => {
      const { data } = await apiClient.post<Channel>('/chat/channels', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] })
    },
  })
}

export function useUpdateChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, payload }: { channelId: string; payload: ChannelUpdatePayload }) => {
      const { data } = await apiClient.put<Channel>(`/chat/channels/${channelId}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] })
      qc.invalidateQueries({ queryKey: ['chat', 'channel', vars.channelId] })
    },
  })
}

export function useArchiveChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data } = await apiClient.post<Channel>(`/chat/channels/${channelId}/archive`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] })
    },
  })
}

export function useDeleteChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (channelId: string) => {
      await apiClient.delete(`/chat/channels/${channelId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] })
    },
  })
}

export function useJoinChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data } = await apiClient.post<ChannelMember>(`/chat/channels/${channelId}/join`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] })
    },
  })
}

// ─── Channel Members Hooks ────────────────────────────────────────────────────

export function useChannelMembers(channelId: string) {
  return useQuery({
    queryKey: ['chat', 'members', channelId],
    queryFn: async () => {
      const { data } = await apiClient.get<ChannelMember[]>(`/chat/channels/${channelId}/members`)
      return data
    },
    enabled: !!channelId,
  })
}

export function useAddChannelMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, userId, role }: { channelId: string; userId: string; role?: string }) => {
      const { data } = await apiClient.post<ChannelMember>(`/chat/channels/${channelId}/members`, {
        user_id: userId,
        role: role || 'member',
      })
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat', 'members', vars.channelId] })
    },
  })
}

export function useRemoveChannelMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, userId }: { channelId: string; userId: string }) => {
      await apiClient.delete(`/chat/channels/${channelId}/members/${userId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat', 'members', vars.channelId] })
    },
  })
}

// ─── Message Hooks ────────────────────────────────────────────────────────────

export function useMessages(channelId: string, before?: string) {
  return useQuery({
    queryKey: ['chat', 'messages', channelId, before],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (before) params.before = before
      const { data } = await apiClient.get<MessageListResponse>(
        `/chat/channels/${channelId}/messages`,
        { params },
      )
      return data
    },
    enabled: !!channelId,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, payload }: { channelId: string; payload: MessageCreatePayload }) => {
      const { data } = await apiClient.post<ChatMessage>(`/chat/channels/${channelId}/messages`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', vars.channelId] })
    },
  })
}

export function useEditMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { data } = await apiClient.put<ChatMessage>(`/chat/messages/${messageId}`, { content })
      return data
    },
    onSuccess: (msg) => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', msg.channel_id] })
    },
  })
}

export function useDeleteMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, channelId }: { messageId: string; channelId: string }) => {
      await apiClient.delete(`/chat/messages/${messageId}`)
      return channelId
    },
    onSuccess: (channelId) => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', channelId] })
    },
  })
}

export function useToggleReaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const { data } = await apiClient.post<ChatMessage>(`/chat/messages/${messageId}/reactions`, { emoji })
      return data
    },
    onSuccess: (msg) => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', msg.channel_id] })
    },
  })
}

// ─── Thread Hooks ─────────────────────────────────────────────────────────────

export function useThread(messageId: string) {
  return useQuery({
    queryKey: ['chat', 'thread', messageId],
    queryFn: async () => {
      const { data } = await apiClient.get<ThreadResponse>(`/chat/messages/${messageId}/thread`)
      return data
    },
    enabled: !!messageId,
  })
}

// ─── DM Hook ──────────────────────────────────────────────────────────────────

export function useGetOrCreateDM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiClient.post<Channel>(`/chat/dm?user_id=${userId}`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] })
    },
  })
}

// ─── Read & Typing ────────────────────────────────────────────────────────────

export function useMarkChannelRead() {
  return useMutation({
    mutationFn: async (channelId: string) => {
      await apiClient.post(`/chat/channels/${channelId}/read`)
    },
  })
}

export function useSendTyping() {
  return useMutation({
    mutationFn: async (channelId: string) => {
      await apiClient.post(`/chat/channels/${channelId}/typing`)
    },
  })
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export function usePresence(userIds: string[]) {
  return useQuery({
    queryKey: ['chat', 'presence', userIds.sort().join(',')],
    queryFn: async () => {
      const { data } = await apiClient.get<PresenceInfo[]>('/chat/presence', {
        params: { user_ids: userIds.join(',') },
      })
      return data
    },
    enabled: userIds.length > 0,
    refetchInterval: 30000,
  })
}

export function useUpdatePresence() {
  return useMutation({
    mutationFn: async (payload: { status: string; status_message?: string; status_emoji?: string }) => {
      await apiClient.put('/chat/presence', payload)
    },
  })
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function useChatSearch(query: string, channelId?: string) {
  return useQuery({
    queryKey: ['chat', 'search', query, channelId],
    queryFn: async () => {
      const params: Record<string, string> = { q: query }
      if (channelId) params.channel_id = channelId
      const { data } = await apiClient.get<SearchResponse>('/chat/search', { params })
      return data
    },
    enabled: query.length > 0,
  })
}

// ─── Pinned Messages ──────────────────────────────────────────────────────────

export function usePinnedMessages(channelId: string) {
  return useQuery({
    queryKey: ['chat', 'pins', channelId],
    queryFn: async () => {
      const { data } = await apiClient.get<PinnedMessage[]>(`/chat/channels/${channelId}/pins`)
      return data
    },
    enabled: !!channelId,
  })
}

export function usePinMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, messageId }: { channelId: string; messageId: string }) => {
      const { data } = await apiClient.post<PinnedMessage>(`/chat/channels/${channelId}/pin/${messageId}`)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat', 'pins', vars.channelId] })
    },
  })
}

export function useUnpinMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, messageId }: { channelId: string; messageId: string }) => {
      await apiClient.delete(`/chat/channels/${channelId}/pin/${messageId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat', 'pins', vars.channelId] })
    },
  })
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export function useBookmarks() {
  return useQuery({
    queryKey: ['chat', 'bookmarks'],
    queryFn: async () => {
      const { data } = await apiClient.get<Bookmark[]>('/chat/bookmarks')
      return data
    },
  })
}

export function useCreateBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { message_id: string; note?: string }) => {
      const { data } = await apiClient.post<Bookmark>('/chat/bookmarks', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'bookmarks'] })
    },
  })
}

export function useDeleteBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bookmarkId: string) => {
      await apiClient.delete(`/chat/bookmarks/${bookmarkId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'bookmarks'] })
    },
  })
}

// ─── Channel Tabs ─────────────────────────────────────────────────────────────

export function useChannelTabs(channelId: string) {
  return useQuery({
    queryKey: ['chat', 'tabs', channelId],
    queryFn: async () => {
      const { data } = await apiClient.get<ChannelTab[]>(`/chat/channels/${channelId}/tabs`)
      return data
    },
    enabled: !!channelId,
  })
}

export function useCreateTab() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      channelId,
      payload,
    }: {
      channelId: string
      payload: { tab_type: string; label: string; config?: Record<string, unknown>; position?: number }
    }) => {
      const { data } = await apiClient.post<ChannelTab>(`/chat/channels/${channelId}/tabs`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat', 'tabs', vars.channelId] })
    },
  })
}

export function useDeleteTab() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, tabId }: { channelId: string; tabId: string }) => {
      await apiClient.delete(`/chat/channels/${channelId}/tabs/${tabId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat', 'tabs', vars.channelId] })
    },
  })
}
