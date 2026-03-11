import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import { useAuthStore } from '../store/auth'
import type { User, AuthTokens } from '../types'

interface LoginCredentials {
  email: string
  password: string
}

export async function loginRequest(credentials: LoginCredentials): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/login', {
    email: credentials.email,
    password: credentials.password,
  })
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
    mutationFn: async (credentials: LoginCredentials) => {
      const tokens = await loginRequest(credentials)
      // Temporarily store token to fetch user
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
