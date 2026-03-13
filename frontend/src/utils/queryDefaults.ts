/**
 * TanStack Query cache presets for Urban Vibes Dynamics.
 *
 * Apply the appropriate preset to each useQuery call based on how
 * frequently the data changes and how stale it can safely be.
 *
 * Usage:
 *   import { QUERY_PRESETS } from '@/utils/queryDefaults'
 *
 *   export function useInvoices(params) {
 *     return useQuery({
 *       queryKey: ['finance', 'invoices', params],
 *       queryFn: () => api.getInvoices(params),
 *       ...QUERY_PRESETS.list,
 *     })
 *   }
 */

/** Reference data: changes rarely (GL accounts, tax rates, currencies, employees list).
 *  Cache for 5 minutes; don't refetch on window focus. */
export const REFERENCE_PRESET = {
  staleTime: 5 * 60_000,       // 5 minutes
  gcTime: 30 * 60_000,         // 30 minutes in memory
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const

/** Dashboard stats: need to feel fresh but tolerate 30s lag. */
export const DASHBOARD_PRESET = {
  staleTime: 30_000,            // 30 seconds
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
  refetchInterval: 60_000,      // Background refetch every 60s
} as const

/** List data: invoices, contacts, tasks, tickets, etc. */
export const LIST_PRESET = {
  staleTime: 15_000,            // 15 seconds (SSE push handles freshness)
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
} as const

/** Detail / single-record views. */
export const DETAIL_PRESET = {
  staleTime: 15_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
} as const

/** Real-time data: chat, KDS, notifications. Never consider cached. */
export const REALTIME_PRESET = {
  staleTime: 0,
  gcTime: 2 * 60_000,
  refetchOnWindowFocus: true,
} as const

/** Form schemas and builder configs: very stable, long-lived cache. */
export const SCHEMA_PRESET = {
  staleTime: 10 * 60_000,      // 10 minutes
  gcTime: 60 * 60_000,         // 1 hour
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const

/** Convenience object for spread usage. */
export const QUERY_PRESETS = {
  reference: REFERENCE_PRESET,
  dashboard: DASHBOARD_PRESET,
  list: LIST_PRESET,
  detail: DETAIL_PRESET,
  realtime: REALTIME_PRESET,
  schema: SCHEMA_PRESET,
} as const

export type QueryPresetName = keyof typeof QUERY_PRESETS
