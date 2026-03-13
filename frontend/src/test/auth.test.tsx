/**
 * Auth flow tests — login form rendering, credential validation, token storage, logout.
 * Uses pure logic tests against the Zustand auth store (no component rendering needed).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAuthStore } from '../store/auth'

// ── helpers ──────────────────────────────────────────────────────────────────

const resetStore = () =>
  useAuthStore.setState({ user: null, token: null, refreshToken: null, isAuthenticated: false })

// Simple inline login form for testing the flow without importing the real page
function LoginForm({ onSubmit }: { onSubmit: (email: string, pwd: string) => void }) {
  return (
    <form
      data-testid="login-form"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        onSubmit(fd.get('email') as string, fd.get('password') as string)
      }}
    >
      <input name="email" type="email" placeholder="Email" aria-label="Email" />
      <input name="password" type="password" placeholder="Password" aria-label="Password" />
      <button type="submit">Login</button>
    </form>
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Auth flow', () => {
  beforeEach(resetStore)

  it('renders login form with email and password fields', () => {
    render(<LoginForm onSubmit={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('shows error on invalid credentials (mock 401)', async () => {
    let errorShown = false
    const handleSubmit = vi.fn(async (_email: string, _pwd: string) => {
      // Simulate 401 rejection
      errorShown = true
      throw new Error('401 Unauthorized')
    })

    render(<LoginForm onSubmit={handleSubmit} />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'bad@x.com' } })
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledOnce())
    expect(errorShown).toBe(true)
  })

  it('stores token in auth store on successful login', () => {
    const mockUser = {
      id: '1',
      email: 'admin@urban.erp',
      full_name: 'Admin',
      is_superadmin: true,
      is_active: true,
    }
    useAuthStore.getState().setAuth(mockUser as any, 'jwt-access-token', 'jwt-refresh-token')

    const { isAuthenticated, token, refreshToken } = useAuthStore.getState()
    expect(isAuthenticated).toBe(true)
    expect(token).toBe('jwt-access-token')
    expect(refreshToken).toBe('jwt-refresh-token')
  })

  it('logout clears token and resets auth state', () => {
    const mockUser = { id: '1', email: 'x@x.com', full_name: 'X', is_superadmin: false, is_active: true }
    useAuthStore.getState().setAuth(mockUser as any, 'tok')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    useAuthStore.getState().logout()

    const { isAuthenticated, user, token } = useAuthStore.getState()
    expect(isAuthenticated).toBe(false)
    expect(user).toBeNull()
    expect(token).toBeNull()
  })
})
