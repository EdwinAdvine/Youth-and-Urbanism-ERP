/**
 * Manufacturing ECO API client — Engineering Change Orders (ECO) for BOM
 * revisions, multi-step approval workflows, and change implementation tracking.
 *
 * Exports TanStack Query hooks and Axios helper functions for the Manufacturing
 * module's ECO feature. All requests go through `client.ts` (Axios instance
 * with auth interceptors). Backend prefix: `/api/v1/manufacturing`.
 *
 * Key exports:
 *   - useECOs() / useECO() / useCreateECO() — ECO document CRUD
 *   - useSubmitECO() — submit an ECO for approval routing
 *   - useECOApprovals() / useApproveECO() / useRejectECO() — approval decisions
 *   - useImplementECO() — mark an approved ECO as implemented (updates BOM)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ECOApproval {
  id: string
  eco_id: string
  approver_id: string
  decision: string
  comments: string | null
  decided_at: string | null
  sequence: number
  created_at: string
}

export interface ECO {
  id: string
  eco_number: string
  title: string
  description: string | null
  bom_id: string
  change_type: string
  status: string
  priority: string
  requested_by: string
  approved_by: string | null
  submitted_at: string | null
  approved_at: string | null
  implemented_at: string | null
  reason: string | null
  impact_analysis: string | null
  affected_items: string[] | null
  new_bom_version: number | null
  created_at: string
  updated_at: string
}

export interface ECODetail extends ECO {
  approvals: ECOApproval[]
}

export interface ECOCreate {
  title: string
  description?: string
  bom_id: string
  change_type?: string
  priority?: string
  reason?: string
  impact_analysis?: string
  affected_items?: string[]
}

export interface MaterialSubstitution {
  id: string
  bom_item_id: string
  substitute_item_id: string
  priority: number
  conversion_factor: number
  is_active: boolean
  notes: string | null
  valid_from: string | null
  valid_until: string | null
  created_at: string
}

export interface SubstitutionCreate {
  substitute_item_id: string
  priority?: number
  conversion_factor?: number
  notes?: string
  valid_from?: string
  valid_until?: string
}

export interface BOMVersion {
  id: string
  bom_number: string
  name: string
  version: number
  is_active: boolean
  is_default: boolean
  created_at: string | null
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useECOs = (params?: { bom_id?: string; status?: string }) =>
  useQuery({
    queryKey: ['ecos', params],
    queryFn: () => apiClient.get<ECO[]>('/manufacturing/eco', { params }).then(r => r.data),
  })

export const useECO = (ecoId: string) =>
  useQuery({
    queryKey: ['eco', ecoId],
    queryFn: () => apiClient.get<ECODetail>(`/manufacturing/eco/${ecoId}`).then(r => r.data),
    enabled: !!ecoId,
  })

export const useBOMVersions = (bomId: string) =>
  useQuery({
    queryKey: ['bom-versions', bomId],
    queryFn: () => apiClient.get<BOMVersion[]>(`/manufacturing/bom/${bomId}/versions`).then(r => r.data),
    enabled: !!bomId,
  })

export const useBOMSubstitutions = (bomId: string) =>
  useQuery({
    queryKey: ['bom-substitutions', bomId],
    queryFn: () => apiClient.get<MaterialSubstitution[]>(`/manufacturing/bom/${bomId}/substitutions`).then(r => r.data),
    enabled: !!bomId,
  })

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useCreateECO = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ECOCreate) => apiClient.post<ECO>('/manufacturing/eco', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecos'] }),
  })
}

export const useUpdateECO = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<ECOCreate> & { id: string }) =>
      apiClient.put<ECO>(`/manufacturing/eco/${id}`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ecos'] })
      qc.invalidateQueries({ queryKey: ['eco', vars.id] })
    },
  })
}

export const useSubmitECO = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ecoId: string) => apiClient.post<ECO>(`/manufacturing/eco/${ecoId}/submit`).then(r => r.data),
    onSuccess: (_, ecoId) => {
      qc.invalidateQueries({ queryKey: ['ecos'] })
      qc.invalidateQueries({ queryKey: ['eco', ecoId] })
    },
  })
}

export const useAddECOApprovers = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ecoId, approverIds }: { ecoId: string; approverIds: string[] }) =>
      apiClient.post<ECODetail>(`/manufacturing/eco/${ecoId}/add-approvers`, { approver_ids: approverIds }).then(r => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['eco', vars.ecoId] }),
  })
}

export const useApproveECO = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ecoId, decision, comments }: { ecoId: string; decision: string; comments?: string }) =>
      apiClient.post<ECO>(`/manufacturing/eco/${ecoId}/approve`, { decision, comments }).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ecos'] })
      qc.invalidateQueries({ queryKey: ['eco', vars.ecoId] })
    },
  })
}

export const useImplementECO = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ecoId: string) => apiClient.post<ECO>(`/manufacturing/eco/${ecoId}/implement`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ecos'] })
      qc.invalidateQueries({ queryKey: ['boms'] })
    },
  })
}

export const useAddSubstitution = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bomItemId, ...data }: SubstitutionCreate & { bomItemId: string }) =>
      apiClient.post<MaterialSubstitution>(`/manufacturing/bom-items/${bomItemId}/substitutions`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bom-substitutions'] }),
  })
}

export const useDeleteSubstitution = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (subId: string) => apiClient.delete(`/manufacturing/substitutions/${subId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bom-substitutions'] }),
  })
}
