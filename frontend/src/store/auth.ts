/**
 * Authentication Store — Zustand store for JWT-based auth state.
 *
 * Persists token, refreshToken, and user profile to localStorage under
 * the key 'urban-auth' so users remain logged in across page refreshes.
 *
 * Usage:
 *   const { user, token, isAuthenticated, setAuth, logout } = useAuthStore()
 *
 * TanStack Query handles server state (data fetching). This store handles
 * client-only auth state that needs to persist across requests.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string, refreshToken?: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user: User, token: string, refreshToken?: string) =>
        set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true }),

      setUser: (user: User) =>
        set({ user }),

      logout: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'urban-auth',
      partialize: (state) => ({ token: state.token, refreshToken: state.refreshToken, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.token && state?.user) {
          state.isAuthenticated = true
        }
      },
    }
  )
)
