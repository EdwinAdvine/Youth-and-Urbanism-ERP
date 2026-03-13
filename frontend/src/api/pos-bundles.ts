/**
 * POS Bundles API client — product bundle/combo management and item modifier groups.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/pos`.
 *
 * Key exports:
 *   - useBundles() — list active product bundles with their constituent items
 *   - useCreateBundle() / useUpdateBundle() — bundle CRUD with pricing and items
 *   - useModifierGroups() / useCreateModifierGroup() — option groups (size, add-ons, etc.)
 *   - useDeleteBundle() — deactivate or permanently remove a bundle
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BundleItem {
  id: string
  item_id: string
  item_name: string
  item_sku: string
  quantity: number
}

export interface POSBundle {
  id: string
  name: string
  description: string | null
  bundle_price: string
  is_active: boolean
  created_at: string | null
  updated_at: string | null
  items: BundleItem[]
}

export interface BundleItemPayload {
  item_id: string
  quantity: number
}

export interface BundlePayload {
  name: string
  description?: string
  bundle_price: number
  is_active?: boolean
  items: BundleItemPayload[]
}

export interface ModifierOption {
  id: string
  name: string
  price_adjustment: string
  is_active: boolean
}

export interface ModifierGroupData {
  id: string
  name: string
  selection_type: string
  is_required: boolean
  min_selections: number
  max_selections: number
  modifiers: ModifierOption[]
}

export interface ModifierPayload {
  name: string
  price_adjustment?: number
  is_active?: boolean
}

export interface ModifierGroupPayload {
  name: string
  selection_type?: string
  is_required?: boolean
  min_selections?: number
  max_selections?: number
  modifiers?: ModifierPayload[]
}

// ─── Bundles ─────────────────────────────────────────────────────────────────

export function useBundles(activeOnly = true) {
  return useQuery({
    queryKey: ['pos', 'bundles', { activeOnly }],
    queryFn: async () => {
      const { data } = await apiClient.get<POSBundle[]>('/pos/bundles', {
        params: { active_only: activeOnly },
      })
      return data
    },
  })
}

export function useBundle(id: string) {
  return useQuery({
    queryKey: ['pos', 'bundles', id],
    queryFn: async () => {
      const { data } = await apiClient.get<POSBundle>(`/pos/bundles/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BundlePayload) => {
      const { data } = await apiClient.post<POSBundle>('/pos/bundles', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'bundles'] }),
  })
}

export function useUpdateBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: BundlePayload & { id: string }) => {
      const { data } = await apiClient.put<POSBundle>(`/pos/bundles/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'bundles'] }),
  })
}

export function useDeleteBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/pos/bundles/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'bundles'] }),
  })
}

// ─── Modifier Groups ────────────────────────────────────────────────────────

export function useModifierGroups() {
  return useQuery({
    queryKey: ['pos', 'modifier-groups'],
    queryFn: async () => {
      const { data } = await apiClient.get<ModifierGroupData[]>('/pos/modifier-groups')
      return data
    },
  })
}

export function useCreateModifierGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ModifierGroupPayload) => {
      const { data } = await apiClient.post<ModifierGroupData>('/pos/modifier-groups', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'modifier-groups'] }),
  })
}

export function useUpdateModifierGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: ModifierGroupPayload & { id: string }) => {
      const { data } = await apiClient.put<ModifierGroupData>(`/pos/modifier-groups/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'modifier-groups'] }),
  })
}

export function useDeleteModifierGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/pos/modifier-groups/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'modifier-groups'] }),
  })
}

export function useLinkModifierGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, groupId }: { itemId: string; groupId: string }) => {
      const { data } = await apiClient.post(`/pos/products/${itemId}/modifier-groups/${groupId}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'products'] }),
  })
}

export function useUnlinkModifierGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, groupId }: { itemId: string; groupId: string }) => {
      await apiClient.delete(`/pos/products/${itemId}/modifier-groups/${groupId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'products'] }),
  })
}
