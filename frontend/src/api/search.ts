/**
 * Search API client — global cross-module full-text search.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/search`.
 *
 * Key exports:
 *   - useGlobalSearch() — query all modules at once; returns results grouped by module,
 *                         each item with a title, subtitle, and deep-link URL.
 *                         Debounced; only fires when query length >= 1.
 */
import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export interface SearchResultItem {
  id: string
  title: string
  subtitle: string
  link: string
}

export interface SearchResultGroup {
  module: string
  label: string
  items: SearchResultItem[]
}

export interface SearchResponse {
  query: string
  results: SearchResultGroup[]
}

export function useGlobalSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const { data } = await apiClient.get<SearchResponse>('/search', { params: { q: query } })
      return data
    },
    enabled: enabled && query.trim().length >= 1,
    staleTime: 30_000,
  })
}
