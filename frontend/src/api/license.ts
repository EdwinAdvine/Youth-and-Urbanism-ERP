/**
 * License API client — Urban Vibes Dynamics license management (status, activation, seat tracking).
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/license`.
 *
 * Key exports:
 *   - useLicenseStatus()    — current license validity, days remaining, and feature flags
 *   - useLicenses()         — full list of license records (Super Admin only)
 *   - useCreateLicense()    — register a new license key (trial, standard, professional, enterprise)
 *   - useUpdateLicense()    — update seat count, expiry, or notes on an existing license
 *   - useDeleteLicense()    — deactivate and remove a license record
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface License {
  id: string
  license_key: string
  license_type: 'trial' | 'standard' | 'professional' | 'enterprise'
  max_users: number
  current_users: number
  features: string[]
  issued_at: string
  expires_at: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LicenseStatus {
  is_active: boolean
  days_remaining: number | null
  current_users: number
  max_users: number
  features: string[]
  license_type: string | null
  expires_at: string | null
}

export interface LicenseActivatePayload {
  license_key: string
  license_type: 'trial' | 'standard' | 'professional' | 'enterprise'
  max_users: number
  features?: string[]
  expires_at?: string | null
  notes?: string | null
}

export interface LicenseUpdatePayload {
  license_type?: 'trial' | 'standard' | 'professional' | 'enterprise'
  max_users?: number
  features?: string[]
  expires_at?: string | null
  is_active?: boolean
  notes?: string | null
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useLicense() {
  return useQuery({
    queryKey: ['license'],
    queryFn: async () => {
      const { data } = await apiClient.get<License | null>('/license')
      return data
    },
  })
}

export function useLicenseStatus() {
  return useQuery({
    queryKey: ['license', 'status'],
    queryFn: async () => {
      const { data } = await apiClient.get<LicenseStatus>('/license/status')
      return data
    },
  })
}

export function useActivateLicense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: LicenseActivatePayload) => {
      const { data } = await apiClient.post<License>('/license', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['license'] })
    },
  })
}

export function useUpdateLicense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: LicenseUpdatePayload & { id: string }) => {
      const { data } = await apiClient.put<License>(`/license/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['license'] })
    },
  })
}
