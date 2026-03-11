import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIAgentConfig {
  id: string
  agent_type: string
  name: string
  description: string | null
  is_active: boolean
  config: Record<string, unknown> | null
  schedule: string | null
  approval_required: boolean
  max_actions_per_run: number
  owner_id: string
  created_at: string
  updated_at: string
}

export interface AIAgentRun {
  id: string
  agent_config_id: string
  status: 'running' | 'completed' | 'failed' | 'needs_approval'
  trigger: string
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  actions_taken: Record<string, unknown>[] | null
  started_at: string
  completed_at: string | null
  error_message: string | null
  approved_by: string | null
}

// ─── API Functions ────────────────────────────────────────────────────────────

const getAIAgents = (params?: Record<string, unknown>) =>
  apiClient.get('/crm/ai-agents', { params }).then((r) => r.data)

const createAIAgent = (data: Partial<AIAgentConfig>) =>
  apiClient.post('/crm/ai-agents', data).then((r) => r.data)

const getAIAgent = (id: string) =>
  apiClient.get(`/crm/ai-agents/${id}`).then((r) => r.data)

const updateAIAgent = ({ id, ...data }: Partial<AIAgentConfig> & { id: string }) =>
  apiClient.put(`/crm/ai-agents/${id}`, data).then((r) => r.data)

const deleteAIAgent = (id: string) =>
  apiClient.delete(`/crm/ai-agents/${id}`).then((r) => r.data)

const runAIAgent = (id: string) =>
  apiClient.post(`/crm/ai-agents/${id}/run`).then((r) => r.data)

const getAIAgentRuns = (agentId: string, params?: Record<string, unknown>) =>
  apiClient.get(`/crm/ai-agents/${agentId}/runs`, { params }).then((r) => r.data)

const getAIAgentRun = (agentId: string, runId: string) =>
  apiClient.get(`/crm/ai-agents/${agentId}/runs/${runId}`).then((r) => r.data)

const approveRun = (agentId: string, runId: string) =>
  apiClient.post(`/crm/ai-agents/${agentId}/runs/${runId}/approve`).then((r) => r.data)

const rejectRun = (agentId: string, runId: string) =>
  apiClient.post(`/crm/ai-agents/${agentId}/runs/${runId}/reject`).then((r) => r.data)

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useAIAgents = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['crm-ai-agents', params],
    queryFn: () => getAIAgents(params),
  })

export const useCreateAIAgent = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAIAgent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-ai-agents'] }),
  })
}

export const useAIAgent = (id: string) =>
  useQuery({
    queryKey: ['crm-ai-agents', id],
    queryFn: () => getAIAgent(id),
    enabled: !!id,
  })

export const useUpdateAIAgent = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAIAgent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-ai-agents'] }),
  })
}

export const useDeleteAIAgent = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAIAgent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-ai-agents'] }),
  })
}

export const useRunAIAgent = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: runAIAgent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-ai-agent-runs'] }),
  })
}

export const useAIAgentRuns = (agentId: string, params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['crm-ai-agent-runs', agentId, params],
    queryFn: () => getAIAgentRuns(agentId, params),
    enabled: !!agentId,
  })

export const useAIAgentRun = (agentId: string, runId: string) =>
  useQuery({
    queryKey: ['crm-ai-agent-runs', agentId, runId],
    queryFn: () => getAIAgentRun(agentId, runId),
    enabled: !!agentId && !!runId,
  })

export const useApproveRun = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, runId }: { agentId: string; runId: string }) =>
      approveRun(agentId, runId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-ai-agent-runs'] }),
  })
}

export const useRejectRun = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, runId }: { agentId: string; runId: string }) =>
      rejectRun(agentId, runId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-ai-agent-runs'] }),
  })
}
