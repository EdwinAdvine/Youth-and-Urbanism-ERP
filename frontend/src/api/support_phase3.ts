/**
 * Support Phase 3 API client — analytics snapshots, proactive messaging, voice
 * channel, agent skills routing, sandbox environments, customer health scoring.
 *
 * Exports TanStack Query hooks and plain Axios helper functions for the Support
 * module's Phase 3 features. Uses a module-local Axios instance with a Bearer
 * token interceptor. Backend prefix: `/api/v1/support`.
 *
 * Key exports:
 *   - useAnalyticsSnapshots() — daily support KPI snapshots (SLA, CSAT, volume)
 *   - useProactiveMessages() / useCreateProactiveMessage() — outbound messaging
 *   - useVoiceChannel() / useVoiceCalls() — voice/telephony integration
 *   - useAgentSkills() / useSkillRouting() — skill-based ticket routing
 *   - useSandboxes() — isolated test environments for support workflows
 *   - useCustomerHealth() — customer health scores and churn-risk signals
 */
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';

const api = axios.create({ baseURL: '/api/v1/support' });
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsSnapshot {
  id: string;
  snapshot_date: string;
  new_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;
  reopened_tickets: number;
  backlog_count: number;
  sla_compliance_pct: number | null;
  avg_response_minutes: number | null;
  avg_resolution_minutes: number | null;
  avg_csat: number | null;
  csat_responses: number;
  ai_classified_count: number;
  ai_auto_responded_count: number;
  ai_deflected_count: number;
  channel_breakdown: Record<string, number>;
  priority_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  agent_performance: Array<{
    user_id: string;
    name: string;
    resolved: number;
    avg_csat: number;
    avg_response_min: number;
  }>;
}

export interface CustomerHealth {
  id: string;
  customer_email: string;
  contact_id: string | null;
  overall_score: number;
  engagement_score: number;
  satisfaction_score: number;
  effort_score: number;
  ticket_frequency: number | null;
  avg_sentiment: number | null;
  avg_csat: number | null;
  last_ticket_at: string | null;
  total_tickets: number;
  risk_level: 'healthy' | 'at_risk' | 'critical';
  churn_probability: number | null;
  score_factors: Array<{ factor: string; impact: number }>;
  computed_at: string;
}

export interface ProactiveRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: 'event' | 'schedule' | 'threshold';
  trigger_conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  is_active: boolean;
  execution_count: number;
  last_triggered_at: string | null;
  created_at: string;
}

export interface VoiceCall {
  id: string;
  ticket_id: string | null;
  agent_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'in_progress' | 'completed' | 'missed' | 'voicemail';
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  wait_seconds: number;
  recording_url: string | null;
  transcript: string | null;
  sentiment_score: number | null;
  notes: string | null;
  agent_name: string | null;
  created_at: string;
}

export interface AgentSkill {
  id: string;
  user_id: string;
  skill_name: string;
  proficiency: number;
  is_primary: boolean;
  max_concurrent: number;
  languages: string[] | null;
  user_name: string | null;
}

export interface AgentShift {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
  user_name: string | null;
}

export interface SupportSandbox {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  expires_at: string | null;
  config_snapshot: Record<string, unknown> | null;
  test_results: Array<Record<string, unknown>>;
  created_at: string;
}

// ── Analytics ────────────────────────────────────────────────────────────────

export const useAnalyticsOverview = (startDate?: string, endDate?: string) =>
  useQuery({
    queryKey: ['support', 'analytics', 'overview', startDate, endDate],
    queryFn: () =>
      api.get('/analytics/overview', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  });

export const useAnalyticsTrends = (startDate?: string, endDate?: string) =>
  useQuery({
    queryKey: ['support', 'analytics', 'trends', startDate, endDate],
    queryFn: () =>
      api.get('/analytics/trends', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  });

export const useAnalyticsAgents = (startDate?: string, endDate?: string) =>
  useQuery({
    queryKey: ['support', 'analytics', 'agents', startDate, endDate],
    queryFn: () =>
      api.get('/analytics/agents', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  });

export const useAnalyticsAIImpact = (startDate?: string, endDate?: string) =>
  useQuery({
    queryKey: ['support', 'analytics', 'ai-impact', startDate, endDate],
    queryFn: () =>
      api.get('/analytics/ai-impact', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  });

export const useAnalyticsForecast = () =>
  useQuery({
    queryKey: ['support', 'analytics', 'forecast'],
    queryFn: () => api.get('/analytics/forecast').then((r) => r.data),
  });

// ── Customer Health ──────────────────────────────────────────────────────────

export const useCustomerHealthScores = (riskLevel?: string, page = 1) =>
  useQuery({
    queryKey: ['support', 'customer-health', riskLevel, page],
    queryFn: () =>
      api.get('/analytics/customer-health', { params: { risk_level: riskLevel, page } }).then((r) => r.data),
  });

export const useCustomerHealthDetail = (email: string) =>
  useQuery({
    queryKey: ['support', 'customer-health', email],
    queryFn: () => api.get(`/analytics/customer-health/${encodeURIComponent(email)}`).then((r) => r.data),
    enabled: !!email,
  });

export const useComputeCustomerHealth = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email?: string) =>
      api.post('/analytics/customer-health/compute', null, { params: { customer_email: email } }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'customer-health'] }),
  });
};

// ── Proactive Rules ──────────────────────────────────────────────────────────

export const useProactiveRules = () =>
  useQuery({
    queryKey: ['support', 'proactive', 'rules'],
    queryFn: () => api.get('/proactive/rules').then((r) => r.data),
  });

export const useCreateProactiveRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProactiveRule>) => api.post('/proactive/rules', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'proactive'] }),
  });
};

export const useUpdateProactiveRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<ProactiveRule>) =>
      api.put(`/proactive/rules/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'proactive'] }),
  });
};

export const useToggleProactiveRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/proactive/rules/${id}/toggle`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'proactive'] }),
  });
};

export const useDeleteProactiveRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/proactive/rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'proactive'] }),
  });
};

// ── Voice Calls ──────────────────────────────────────────────────────────────

export const useVoiceCalls = (params?: { direction?: string; status?: string; page?: number }) =>
  useQuery({
    queryKey: ['support', 'voice', 'calls', params],
    queryFn: () => api.get('/voice/calls', { params }).then((r) => r.data),
  });

export const useVoiceCall = (id: string) =>
  useQuery({
    queryKey: ['support', 'voice', 'calls', id],
    queryFn: () => api.get(`/voice/calls/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateVoiceCall = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { customer_phone: string; customer_name?: string; direction: string; ticket_id?: string }) =>
      api.post('/voice/calls', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'voice'] }),
  });
};

export const useEndVoiceCall = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/voice/calls/${id}/end`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'voice'] }),
  });
};

export const useVoiceStats = (startDate?: string, endDate?: string) =>
  useQuery({
    queryKey: ['support', 'voice', 'stats', startDate, endDate],
    queryFn: () =>
      api.get('/voice/stats', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  });

// ── Agent Skills ─────────────────────────────────────────────────────────────

export const useAgentSkills = (agentId?: string) =>
  useQuery({
    queryKey: ['support', 'skills', agentId],
    queryFn: () =>
      agentId
        ? api.get(`/skills/agents/${agentId}`).then((r) => r.data)
        : api.get('/skills').then((r) => r.data),
  });

export const useCreateSkill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AgentSkill>) => api.post('/skills', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'skills'] }),
  });
};

export const useDeleteSkill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/skills/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'skills'] }),
  });
};

export const useSkillBasedRouting = () =>
  useMutation({
    mutationFn: (ticketId: string) =>
      api.post('/skills/route-ticket', { ticket_id: ticketId }).then((r) => r.data),
  });

// ── Agent Shifts ─────────────────────────────────────────────────────────────

export const useAgentShifts = (agentId: string) =>
  useQuery({
    queryKey: ['support', 'shifts', agentId],
    queryFn: () => api.get(`/shifts/agents/${agentId}`).then((r) => r.data),
    enabled: !!agentId,
  });

export const useCreateShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AgentShift>) => api.post('/shifts', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'shifts'] }),
  });
};

export const useOnDutyAgents = () =>
  useQuery({
    queryKey: ['support', 'shifts', 'on-duty'],
    queryFn: () => api.get('/shifts/on-duty').then((r) => r.data),
    refetchInterval: 60000,
  });

export const useShiftCoverage = () =>
  useQuery({
    queryKey: ['support', 'shifts', 'coverage'],
    queryFn: () => api.get('/shifts/coverage').then((r) => r.data),
  });

// ── Sandboxes ────────────────────────────────────────────────────────────────

export const useSandboxes = () =>
  useQuery({
    queryKey: ['support', 'sandboxes'],
    queryFn: () => api.get('/sandboxes').then((r) => r.data),
  });

export const useSandbox = (id: string) =>
  useQuery({
    queryKey: ['support', 'sandboxes', id],
    queryFn: () => api.get(`/sandboxes/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateSandbox = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; expires_at?: string }) =>
      api.post('/sandboxes', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sandboxes'] }),
  });
};

export const useRunSandboxTest = () =>
  useMutation({
    mutationFn: ({ id, test_ticket }: { id: string; test_ticket: Record<string, unknown> }) =>
      api.post(`/sandboxes/${id}/run-test`, { test_ticket }).then((r) => r.data),
  });

export const useDeleteSandbox = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sandboxes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'sandboxes'] }),
  });
};
