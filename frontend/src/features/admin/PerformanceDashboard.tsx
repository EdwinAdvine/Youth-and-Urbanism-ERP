import { useState } from 'react'
import { useDbStats, useDbPool, useCacheStats, useEndpointTiming, useWebVitalsSummary } from '@/api/perf'
import type { SlowQuery, EndpointTiming, WebVitalSummary } from '@/api/perf'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratingColor(rating: string) {
  if (rating === 'good') return 'text-success'
  if (rating === 'needs-improvement') return 'text-warning'
  return 'text-danger'
}

function ratingBg(rating: string) {
  if (rating === 'good') return 'bg-success/10 text-success'
  if (rating === 'needs-improvement') return 'bg-warning/10 text-warning'
  return 'bg-danger/10 text-danger'
}

function msColor(ms: number, thresholds: [number, number]) {
  if (ms <= thresholds[0]) return 'text-success'
  if (ms <= thresholds[1]) return 'text-warning'
  return 'text-danger'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-[10px] border border-gray-100 dark:border-gray-800 p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  )
}

function LoadingRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

// ─── Connection Pool Panel ─────────────────────────────────────────────────────

function PoolPanel() {
  const { data, isLoading } = useDbPool()
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-[10px] animate-pulse" />
        ))}
      </div>
    )
  }
  if (!data) return null

  const utilPct = data.pool_size > 0
    ? Math.round((data.checked_out / (data.pool_size + data.overflow)) * 100)
    : 0

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Pool Size" value={data.pool_size} />
        <StatCard label="Checked In" value={data.checked_in} sub="idle connections" />
        <StatCard label="Checked Out" value={data.checked_out} sub="active connections" />
        <StatCard label="Overflow" value={data.overflow} sub="burst connections" />
        <StatCard label="Utilization" value={`${utilPct}%`} sub={utilPct > 80 ? '⚠ High' : 'Normal'} />
      </div>
      <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${utilPct > 80 ? 'bg-danger' : utilPct > 50 ? 'bg-warning' : 'bg-success'}`}
          style={{ width: `${utilPct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Redis Cache Panel ─────────────────────────────────────────────────────────

function CachePanel() {
  const { data, isLoading } = useCacheStats()
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-[10px] animate-pulse" />
        ))}
      </div>
    )
  }
  if (!data) return null
  if (data.error) return <p className="text-sm text-danger">{data.error}</p>

  const total = (data.keyspace_hits ?? 0) + (data.keyspace_misses ?? 0)
  const hitRate = total > 0 ? Math.round((data.keyspace_hits / total) * 100) : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard label="Memory Used" value={data.used_memory_human ?? '—'} sub={`Peak: ${data.used_memory_peak_human ?? '—'}`} />
      <StatCard label="Clients" value={data.connected_clients ?? 0} sub="connected clients" />
      <StatCard label="Hit Rate" value={`${hitRate}%`} sub={`${data.keyspace_hits?.toLocaleString() ?? 0} hits`} />
      <StatCard label="Redis" value={`v${data.redis_version ?? '?'}`} sub="version" />
    </div>
  )
}

// ─── Web Vitals Panel ──────────────────────────────────────────────────────────

const VITAL_THRESHOLDS: Record<string, { unit: string; good: number; poor: number }> = {
  LCP:  { unit: 'ms', good: 2500, poor: 4000 },
  FID:  { unit: 'ms', good: 100,  poor: 300  },
  CLS:  { unit: '',   good: 0.1,  poor: 0.25 },
  TTFB: { unit: 'ms', good: 800,  poor: 1800 },
  INP:  { unit: 'ms', good: 200,  poor: 500  },
}

function WebVitalsPanel() {
  const { data, isLoading } = useWebVitalsSummary()
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-[10px] animate-pulse" />
        ))}
      </div>
    )
  }

  const vitals = data?.data ?? []
  if (vitals.length === 0) {
    return <p className="text-sm text-gray-400">No Core Web Vitals data yet. Data is collected from active user sessions.</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {vitals.map((v: WebVitalSummary) => {
        const meta = VITAL_THRESHOLDS[v.name]
        const displayValue = meta?.unit === '' ? v.p75.toFixed(3) : v.p75.toFixed(0)
        const ratingClass = ratingColor(v.rating)
        return (
          <div key={v.name} className="bg-white dark:bg-gray-900 rounded-[10px] border border-gray-100 dark:border-gray-800 p-4 text-center">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{v.name}</p>
            <p className={`mt-2 text-2xl font-bold ${ratingClass}`}>
              {displayValue}{meta?.unit}
            </p>
            <p className="mt-1 text-xs text-gray-400">p75</p>
            <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${ratingBg(v.rating)}`}>
              {v.rating.replace('-', ' ')}
            </span>
            <p className="mt-1 text-xs text-gray-400">{v.count.toLocaleString()} samples</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Endpoint Timing Table ─────────────────────────────────────────────────────

function EndpointTimingTable() {
  const { data, isLoading } = useEndpointTiming()
  const [search, setSearch] = useState('')

  const rows = (data?.data ?? []).filter((r: EndpointTiming) =>
    !search || r.path.toLowerCase().includes(search.toLowerCase()) || r.method.includes(search.toUpperCase())
  )

  return (
    <div>
      <div className="mb-3">
        <input
          type="text"
          placeholder="Filter by path or method..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-1.5 text-sm rounded-[8px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-gray-100 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-left">Path</th>
              <th className="px-4 py-3 text-right">Calls</th>
              <th className="px-4 py-3 text-right">p50</th>
              <th className="px-4 py-3 text-right">p95</th>
              <th className="px-4 py-3 text-right">p99</th>
              <th className="px-4 py-3 text-right">Max</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <LoadingRow key={i} cols={7} />)
              : rows.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                      {search ? 'No endpoints match the filter.' : 'No timing data yet. Data accumulates as endpoints are called.'}
                    </td>
                  </tr>
                )
                : rows.map((row: EndpointTiming, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${
                        row.method === 'GET' ? 'bg-info/10 text-info'
                        : row.method === 'POST' ? 'bg-success/10 text-success'
                        : row.method === 'PUT' || row.method === 'PATCH' ? 'bg-warning/10 text-warning'
                        : 'bg-danger/10 text-danger'
                      }`}>
                        {row.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 max-w-[280px] truncate">{row.path}</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{row.count.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-medium ${msColor(row.p50_ms, [200, 500])}`}>{row.p50_ms}ms</td>
                    <td className={`px-4 py-3 text-right font-medium ${msColor(row.p95_ms, [500, 1000])}`}>{row.p95_ms}ms</td>
                    <td className={`px-4 py-3 text-right font-medium ${msColor(row.p99_ms, [1000, 2000])}`}>{row.p99_ms}ms</td>
                    <td className={`px-4 py-3 text-right font-medium ${msColor(row.max_ms, [1000, 3000])}`}>{row.max_ms}ms</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Slow Queries Table ────────────────────────────────────────────────────────

function SlowQueriesTable() {
  const { data, isLoading } = useDbStats(20)
  const [expanded, setExpanded] = useState<number | null>(null)

  const rows = data?.data ?? []

  return (
    <div>
      {data?.error && (
        <div className="mb-3 px-4 py-3 bg-warning/10 rounded-[8px] text-sm text-warning">
          pg_stat_statements not available. Add <code className="font-mono">shared_preload_libraries=pg_stat_statements</code> to PostgreSQL config and restart.
        </div>
      )}
      <div className="overflow-x-auto rounded-[10px] border border-gray-100 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 text-left w-16">#</th>
              <th className="px-4 py-3 text-left">Query</th>
              <th className="px-4 py-3 text-right">Calls</th>
              <th className="px-4 py-3 text-right">Mean</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Rows/call</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <LoadingRow key={i} cols={6} />)
              : rows.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                      No query data available.
                    </td>
                  </tr>
                )
                : rows.map((row: SlowQuery, i: number) => (
                  <>
                    <tr
                      key={i}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                    >
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 max-w-[400px]">
                        <span className="line-clamp-1">{row.query}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{row.calls.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right font-medium ${msColor(row.mean_ms, [50, 200])}`}>{row.mean_ms}ms</td>
                      <td className="px-4 py-3 text-right text-gray-500">{(row.total_ms / 1000).toFixed(1)}s</td>
                      <td className="px-4 py-3 text-right text-gray-500">{row.calls > 0 ? Math.round(row.rows / row.calls) : 0}</td>
                    </tr>
                    {expanded === i && (
                      <tr key={`${i}-expanded`} className="bg-gray-50 dark:bg-gray-800/30">
                        <td colSpan={6} className="px-4 py-3">
                          <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                            {row.query}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))
            }
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">Click a row to expand the full query. Sorted by mean execution time descending.</p>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PerformanceDashboard() {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Performance Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Real-time system health and performance metrics</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          Live
        </span>
      </div>

      {/* Connection Pool */}
      <section>
        <SectionHeader title="Database Connection Pool" subtitle="PostgreSQL pool utilization — refreshes every 15s" />
        <PoolPanel />
      </section>

      {/* Redis Cache */}
      <section>
        <SectionHeader title="Redis Cache" subtitle="Memory usage and keyspace hit rate — refreshes every 30s" />
        <CachePanel />
      </section>

      {/* Core Web Vitals */}
      <section>
        <SectionHeader title="Core Web Vitals" subtitle="p75 values from real user sessions in the last 24 hours" />
        <WebVitalsPanel />
      </section>

      {/* Endpoint Response Times */}
      <section>
        <SectionHeader title="API Response Times" subtitle="p50 / p95 / p99 per endpoint from the last hour — refreshes every 60s" />
        <EndpointTimingTable />
      </section>

      {/* Slow Queries */}
      <section>
        <SectionHeader title="Slow Queries" subtitle="Top 20 slowest queries by mean execution time from pg_stat_statements" />
        <SlowQueriesTable />
      </section>
    </div>
  )
}
