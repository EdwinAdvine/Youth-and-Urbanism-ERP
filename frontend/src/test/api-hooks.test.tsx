/**
 * API hooks tests with TanStack Query — loading state, data state, mutation, error state.
 * Uses renderHook + QueryClientProvider wrapper; MSW intercepts HTTP calls via setup.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import React from 'react'

// ── wrapper factory ───────────────────────────────────────────────────────────

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const BASE = 'http://localhost:8000/api/v1'

// ── tests ─────────────────────────────────────────────────────────────────────

describe('API hooks with mock server', () => {
  it('useQuery hook returns loading state initially', () => {
    const { result } = renderHook(
      () => useQuery({ queryKey: ['invoices'], queryFn: () => axios.get(`${BASE}/finance/invoices`).then((r) => r.data) }),
      { wrapper: createWrapper() }
    )
    // On first render, before the promise resolves, status should be 'pending'
    expect(result.current.status).toBe('pending')
  })

  it('useQuery hook returns data after fetch resolves', async () => {
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['invoices-data'],
          queryFn: () => axios.get(`${BASE}/finance/invoices`).then((r) => r.data),
        }),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeDefined()
    expect(result.current.data).toHaveProperty('items')
  })

  it('useMutation hook calls API on execute and returns data', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: (payload: { username: string; password: string }) =>
            axios.post(`${BASE}/auth/login`, payload).then((r) => r.data),
        }),
      { wrapper: createWrapper() }
    )

    result.current.mutate({ username: 'admin@test.com', password: 'password' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveProperty('access_token')
  })

  it('error state is set on API failure (non-existent endpoint)', async () => {
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['bad-endpoint'],
          queryFn: () => axios.get(`${BASE}/does-not-exist`).then((r) => r.data),
          retry: false,
        }),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeDefined()
  })

  it('useQuery with custom fetcher function calls it with correct arguments', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({ items: [], total: 0 })

    const { result } = renderHook(
      () => useQuery({ queryKey: ['custom-fetch', 'arg1'], queryFn: () => mockFetcher('arg1') }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetcher).toHaveBeenCalledWith('arg1')
    expect(result.current.data).toEqual({ items: [], total: 0 })
  })
})
