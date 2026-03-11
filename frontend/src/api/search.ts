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
