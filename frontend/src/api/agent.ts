import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AgentRunStepResponse {
  id: string
  agent: string
  action: string
  status: string
  approval_tier: string | null
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface AgentRunResponse {
  id: string
  prompt: string
  status: string
  plan: Record<string, unknown>[] | null
  result_summary: string | null
  provider: string | null
  model: string | null
  total_llm_calls: number
  total_tool_calls: number
  total_tokens_used: number
  page_context: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
  steps: AgentRunStepResponse[]
}

export interface AgentApprovalResponse {
  id: string
  run_id: string
  step_id: string
  action_description: string
  risk_level: string
  status: string
  decided_at: string | null
  created_at: string
}

// ── API functions ───────────────────────────────────────────────────────────

export async function fetchAgentRuns(skip = 0, limit = 20): Promise<AgentRunResponse[]> {
  const { data } = await apiClient.get<AgentRunResponse[]>('/agent/runs', {
    params: { skip, limit },
  })
  return data
}

export async function fetchAgentRun(runId: string): Promise<AgentRunResponse> {
  const { data } = await apiClient.get<AgentRunResponse>(`/agent/runs/${runId}`)
  return data
}

export async function fetchPendingApprovals(): Promise<AgentApprovalResponse[]> {
  const { data } = await apiClient.get<AgentApprovalResponse[]>('/agent/approvals/pending')
  return data
}

// ── TanStack Query hooks ────────────────────────────────────────────────────

export function useAgentRuns(skip = 0, limit = 20) {
  return useQuery({
    queryKey: ['agent-runs', skip, limit],
    queryFn: () => fetchAgentRuns(skip, limit),
  })
}

export function useAgentRun(runId: string | null) {
  return useQuery({
    queryKey: ['agent-run', runId],
    queryFn: () => fetchAgentRun(runId!),
    enabled: !!runId,
  })
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['agent-approvals-pending'],
    queryFn: fetchPendingApprovals,
    refetchInterval: 30_000,
  })
}
