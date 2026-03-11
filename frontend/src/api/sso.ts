import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface SSOProvider {
  id: string
  name: string
  provider_type: 'google' | 'microsoft' | 'github' | 'custom_oidc'
  client_id: string
  authorization_url: string
  token_url: string
  userinfo_url: string
  redirect_uri: string
  scopes: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SSOProviderCreate {
  name: string
  provider_type: 'google' | 'microsoft' | 'github' | 'custom_oidc'
  client_id: string
  client_secret: string
  authorization_url: string
  token_url: string
  userinfo_url: string
  redirect_uri: string
  scopes?: string
  is_active?: boolean
}

export interface SSOProviderUpdate {
  name?: string
  provider_type?: 'google' | 'microsoft' | 'github' | 'custom_oidc'
  client_id?: string
  client_secret?: string
  authorization_url?: string
  token_url?: string
  userinfo_url?: string
  redirect_uri?: string
  scopes?: string
  is_active?: boolean
}

export function useSSOProviders() {
  return useQuery({
    queryKey: ['sso', 'providers'],
    queryFn: async () => {
      const { data } = await apiClient.get<SSOProvider[]>('/sso/providers')
      return data
    },
  })
}

export function useCreateSSOProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SSOProviderCreate) => {
      const { data } = await apiClient.post<SSOProvider>('/sso/providers', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sso', 'providers'] }),
  })
}

export function useUpdateSSOProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: SSOProviderUpdate & { id: string }) => {
      const { data } = await apiClient.put<SSOProvider>(`/sso/providers/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sso', 'providers'] }),
  })
}

export function useDeleteSSOProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/sso/providers/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sso', 'providers'] }),
  })
}
