/**
 * Performance API client — infrastructure monitoring (slow queries, DB pool, Redis cache stats).
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/perf`.
 *
 * Key exports:
 *   - useSlowQueries()   — top slow SQL queries from pg_stat_statements (mean/total ms)
 *   - useDbPoolStats()   — SQLAlchemy connection pool utilisation (checked-in/out, overflow)
 *   - useCacheStats()    — Redis memory usage, hit/miss ratio, and connected clients
 */
import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlowQuery {
  query: string
  calls: number
  mean_ms: number
  total_ms: number
  stddev_ms: number
  rows: number
}

export interface DbPoolStats {
  pool_size: number
  checked_in: number
  checked_out: number
  overflow: number
  invalid: number
}

export interface CacheStats {
  used_memory_human: string
  used_memory_peak_human: string
  connected_clients: number
  keyspace_hits: number
  keyspace_misses: number
  total_commands_processed: number
  redis_version: string
  error?: string
}

export interface EndpointTiming {
  method: string
  path: string
  count: number
  p50_ms: number
  p95_ms: number
  p99_ms: number
  max_ms: number
}

export interface WebVitalSummary {
  name: string
  count: number
  avg: number
  p75: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchDbStats(limit = 20): Promise<{ data: SlowQuery[] }> {
  const res = await apiClient.get('/perf/db-stats', { params: { limit } })
  return res.data
}

export async function fetchDbPool(): Promise<DbPoolStats> {
  const res = await apiClient.get('/perf/db-pool')
  return res.data
}

export async function fetchCacheStats(): Promise<CacheStats> {
  const res = await apiClient.get('/perf/cache-stats')
  return res.data
}

export async function fetchEndpointTiming(): Promise<{ data: EndpointTiming[] }> {
  const res = await apiClient.get('/perf/endpoint-timing')
  return res.data
}

export async function fetchWebVitalsSummary(): Promise<{ data: WebVitalSummary[] }> {
  const res = await apiClient.get('/perf/web-vitals/summary')
  return res.data
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDbStats(limit = 20) {
  return useQuery({
    queryKey: ['perf', 'db-stats', limit],
    queryFn: () => fetchDbStats(limit),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useDbPool() {
  return useQuery({
    queryKey: ['perf', 'db-pool'],
    queryFn: fetchDbPool,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

export function useCacheStats() {
  return useQuery({
    queryKey: ['perf', 'cache-stats'],
    queryFn: fetchCacheStats,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useEndpointTiming() {
  return useQuery({
    queryKey: ['perf', 'endpoint-timing'],
    queryFn: fetchEndpointTiming,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useWebVitalsSummary() {
  return useQuery({
    queryKey: ['perf', 'web-vitals-summary'],
    queryFn: fetchWebVitalsSummary,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
