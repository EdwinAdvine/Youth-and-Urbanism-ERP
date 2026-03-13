/**
 * Auth API client — authentication (login, logout, MFA, token refresh, password reset).
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/auth`.
 *
 * Key exports:
 *   - loginRequest()         — POST credentials, returns tokens or MFA challenge
 *   - isMFARequired()        — type guard to distinguish MFA response from token response
 *   - useVerifyMFA()         — submit TOTP code to complete MFA login
 *   - useLogout()            — invalidate session and clear Zustand auth store
 *   - useRefreshToken()      — exchange refresh token for a new access token
 *   - useRequestPasswordReset() — send a password-reset email
 *   - useResetPassword()     — set a new password using a reset token
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import { useAuthStore } from '../store/auth'
import type { User, AuthTokens } from '../types'

interface LoginCredentials {
  email: string
  password: string
  device_fingerprint?: string
}

export interface MFARequiredResponse {
  mfa_required: true
  mfa_token: string
}

export type LoginResponse = AuthTokens | MFARequiredResponse

export function isMFARequired(r: LoginResponse): r is MFARequiredResponse {
  return (r as MFARequiredResponse).mfa_required === true
}

export async function loginRequest(credentials: LoginCredentials): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', {
    email: credentials.email,
    password: credentials.password,
    device_fingerprint: credentials.device_fingerprint,
  })
  return data
}

export async function verifyMFARequest(mfa_token: string, code: string): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/mfa/verify', { mfa_token, code })
  return data
}

export async function meRequest(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/auth/logout').catch(() => {/* ignore */})
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<{ user: User } | MFARequiredResponse> => {
      const response = await loginRequest(credentials)
      if (isMFARequired(response)) {
        return response
      }
      // Normal login — fetch user and complete auth
      useAuthStore.setState({ token: response.access_token })
      const user = await meRequest()
      setAuth(user, response.access_token, response.refresh_token)
      qc.invalidateQueries({ queryKey: ['me'] })
      return { user }
    },
  })
}

export function useVerifyMFA() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ mfa_token, code }: { mfa_token: string; code: string }) => {
      const tokens = await verifyMFARequest(mfa_token, code)
      useAuthStore.setState({ token: tokens.access_token })
      const user = await meRequest()
      setAuth(user, tokens.access_token, tokens.refresh_token)
      qc.invalidateQueries({ queryKey: ['me'] })
      return user
    },
  })
}

// MFA management (settings page)
export async function setupMFARequest() {
  const { data } = await apiClient.post<{ totp_uri: string; secret: string }>('/auth/mfa/setup')
  return data
}

export async function verifyMFASetupRequest(code: string) {
  const { data } = await apiClient.post('/auth/mfa/verify-setup', { code })
  return data
}

export async function disableMFARequest(code: string) {
  await apiClient.delete('/auth/mfa/disable', { data: { code } })
}

export async function generateBackupCodesRequest(code: string) {
  const { data } = await apiClient.post<{ backup_codes: string[] }>('/auth/mfa/backup-codes', { code })
  return data
}

export function useMFASetup() {
  return useMutation({ mutationFn: setupMFARequest })
}

export function useMFAVerifySetup() {
  return useMutation({ mutationFn: (code: string) => verifyMFASetupRequest(code) })
}

export function useMFADisable() {
  return useMutation({ mutationFn: (code: string) => disableMFARequest(code) })
}

export function useGenerateBackupCodes() {
  return useMutation({ mutationFn: (code: string) => generateBackupCodesRequest(code) })
}

export function useMe() {
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await meRequest()
      setUser(user)
      return user
    },
    enabled: !!token,
    staleTime: 60_000,
  })
}

export async function registerRequest(payload: {
  email: string
  password: string
  full_name: string
}): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/register', payload)
  return data
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { email: string; password: string; full_name: string }) => {
      const tokens = await registerRequest(payload)
      useAuthStore.setState({ token: tokens.access_token })
      const user = await meRequest()
      setAuth(user, tokens.access_token, tokens.refresh_token)
      return user
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      logout()
      qc.clear()
      window.location.href = '/login'
    },
  })
}
