/**
 * Support Phase 2 API client — automations, customer portal, community forum,
 * omnichannel channels, ticket followers, escalation rules, AI copilot.
 *
 * Exports TanStack Query hooks and plain Axios helper functions for the Support
 * module's Phase 2 features. Uses a module-local Axios instance with a Bearer
 * token interceptor. Backend prefix: `/api/v1/support`.
 *
 * Key exports:
 *   - useAutomations() / useCreateAutomation() — trigger-based automation rules
 *   - usePortalSettings() / useUpdatePortalSettings() — self-service portal config
 *   - useForumTopics() / useCreateForumTopic() — community forum management
 *   - useOmnichannelChannels() — connected channel list (email, chat, social)
 *   - useFollowers() / useAddFollower() — ticket follower subscriptions
 *   - useEscalationRules() — time-based escalation configuration
 *   - useAICopilot() — AI-suggested replies and auto-classification
 */
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const api = axios.create({ baseURL: '/api/v1/support' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface SupportAutomation {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  conditions: Record<string, unknown> | null;
  actions: Array<Record<string, unknown>> | null;
  is_active: boolean;
  execution_count: number;
  last_executed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  ticket_id: string | null;
  actions_executed: string[];
  success: boolean;
  error_message: string | null;
  executed_at: string;
}

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  post_count: number;
  created_at: string;
}

export interface ForumPost {
  id: string;
  category_id: string;
  author_id: string;
  author_type: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  upvote_count: number;
  reply_count: number;
  author_name: string | null;
  category_name: string | null;
  created_at: string;
}

export interface ForumReply {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  is_best_answer: boolean;
  upvote_count: number;
  author_name: string | null;
  created_at: string;
}

export interface OmnichannelConfig {
  id: string;
  channel: string;
  display_name: string;
  webhook_url: string | null;
  api_key_masked: string | null;
  settings: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

export interface TicketFollower {
  id: string;
  ticket_id: string;
  user_id: string;
  notify_on_comment: boolean;
  notify_on_status_change: boolean;
  user_name: string | null;
  created_at: string;
}

export interface EscalationChain {
  id: string;
  sla_policy_id: string;
  level: number;
  trigger_minutes_before_breach: number;
  action: string;
  target_user_id: string | null;
  notify_channel: string;
  target_user_name: string | null;
}

// ── Automations ──────────────────────────────────────────────────────────────

export const useAutomations = (isActive?: boolean) =>
  useQuery({
    queryKey: ['support', 'automations', isActive],
    queryFn: () => api.get('/automations', { params: { is_active: isActive } }).then((r) => r.data),
  });

export const useAutomation = (id: string) =>
  useQuery({
    queryKey: ['support', 'automations', id],
    queryFn: () => api.get(`/automations/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateAutomation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SupportAutomation>) => api.post('/automations', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'automations'] }),
  });
};

export const useUpdateAutomation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<SupportAutomation>) =>
      api.put(`/automations/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'automations'] }),
  });
};

export const useDeleteAutomation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/automations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'automations'] }),
  });
};

export const useToggleAutomation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/automations/${id}/toggle`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'automations'] }),
  });
};

export const useTestAutomation = () =>
  useMutation({
    mutationFn: ({ id, ticket_id }: { id: string; ticket_id: string }) =>
      api.post(`/automations/${id}/test`, { ticket_id }).then((r) => r.data),
  });

export const useAutomationLogs = (id: string, page = 1) =>
  useQuery({
    queryKey: ['support', 'automations', id, 'logs', page],
    queryFn: () => api.get(`/automations/${id}/logs`, { params: { page } }).then((r) => r.data),
    enabled: !!id,
  });

// ── Forum ────────────────────────────────────────────────────────────────────

export const useForumCategories = () =>
  useQuery({
    queryKey: ['support', 'forum', 'categories'],
    queryFn: () => api.get('/forum/categories').then((r) => r.data),
  });

export const useCreateForumCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ForumCategory>) => api.post('/forum/categories', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'forum', 'categories'] }),
  });
};

export const useForumPosts = (categoryId?: string, page = 1) =>
  useQuery({
    queryKey: ['support', 'forum', 'posts', categoryId, page],
    queryFn: () =>
      api.get('/forum/posts', { params: { category_id: categoryId, page } }).then((r) => r.data),
  });

export const useForumPost = (id: string) =>
  useQuery({
    queryKey: ['support', 'forum', 'posts', id],
    queryFn: () => api.get(`/forum/posts/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateForumPost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { category_id: string; title: string; content: string }) =>
      api.post('/forum/posts', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'forum', 'posts'] }),
  });
};

export const useCreateForumReply = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      api.post(`/forum/posts/${postId}/replies`, { content }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'forum', 'posts'] }),
  });
};

export const useUpvotePost = () =>
  useMutation({
    mutationFn: (postId: string) => api.post(`/forum/posts/${postId}/upvote`).then((r) => r.data),
  });

export const useMarkBestAnswer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (replyId: string) => api.post(`/forum/replies/${replyId}/best-answer`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'forum'] }),
  });
};

// ── Omnichannel ──────────────────────────────────────────────────────────────

export const useOmnichannelConfigs = () =>
  useQuery({
    queryKey: ['support', 'omnichannel'],
    queryFn: () => api.get('/omnichannel/channels').then((r) => r.data),
  });

export const useCreateChannel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<OmnichannelConfig>) =>
      api.post('/omnichannel/channels', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'omnichannel'] }),
  });
};

export const useUpdateChannel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<OmnichannelConfig>) =>
      api.put(`/omnichannel/channels/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'omnichannel'] }),
  });
};

export const useToggleChannel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/omnichannel/channels/${id}/toggle`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'omnichannel'] }),
  });
};

export const useOmnichannelStats = () =>
  useQuery({
    queryKey: ['support', 'omnichannel', 'stats'],
    queryFn: () => api.get('/omnichannel/stats').then((r) => r.data),
  });

// ── Ticket Followers ─────────────────────────────────────────────────────────

export const useTicketFollowers = (ticketId: string) =>
  useQuery({
    queryKey: ['support', 'tickets', ticketId, 'followers'],
    queryFn: () => api.get(`/tickets/${ticketId}/followers`).then((r) => r.data),
    enabled: !!ticketId,
  });

export const useFollowTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => api.post(`/tickets/${ticketId}/follow`).then((r) => r.data),
    onSuccess: (_, ticketId) =>
      qc.invalidateQueries({ queryKey: ['support', 'tickets', ticketId, 'followers'] }),
  });
};

export const useUnfollowTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => api.post(`/tickets/${ticketId}/unfollow`).then((r) => r.data),
    onSuccess: (_, ticketId) =>
      qc.invalidateQueries({ queryKey: ['support', 'tickets', ticketId, 'followers'] }),
  });
};

// ── SLA Escalation Chains ────────────────────────────────────────────────────

export const useEscalationChain = (slaPolicyId: string) =>
  useQuery({
    queryKey: ['support', 'sla', slaPolicyId, 'escalation'],
    queryFn: () => api.get(`/sla/${slaPolicyId}/escalation-chain`).then((r) => r.data),
    enabled: !!slaPolicyId,
  });

export const useAddEscalationLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slaPolicyId, ...data }: { slaPolicyId: string } & Partial<EscalationChain>) =>
      api.post(`/sla/${slaPolicyId}/escalation-chain`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sla'] }),
  });
};

export const useDeleteEscalationLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chainId: string) => api.delete(`/sla/escalation-chain/${chainId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sla'] }),
  });
};
