/**
 * Core Web Vitals collection and reporting.
 *
 * Captures LCP, FID, CLS, TTFB, INP using the web-vitals library and
 * batches them for upload to the backend every 60 seconds.
 *
 * Initialize once at app startup in main.tsx:
 *   import { initWebVitals } from '@/utils/webVitals'
 *   initWebVitals()
 */

interface VitalMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  url: string
}

const BATCH_INTERVAL = 60_000  // 60 seconds
const ENDPOINT = '/api/v1/perf/web-vitals'

let metricsQueue: VitalMetric[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  // Thresholds per https://web.dev/vitals/
  const thresholds: Record<string, [number, number]> = {
    LCP:  [2500, 4000],
    FID:  [100,  300],
    CLS:  [0.1,  0.25],
    TTFB: [800,  1800],
    INP:  [200,  500],
  }
  const t = thresholds[name]
  if (!t) return 'good'
  if (value <= t[0]) return 'good'
  if (value <= t[1]) return 'needs-improvement'
  return 'poor'
}

function queueMetric(name: string, value: number) {
  const rating = getRating(name, value)
  metricsQueue.push({ name, value: Math.round(value), rating, url: window.location.pathname })

  if (!flushTimer) {
    flushTimer = setTimeout(flush, BATCH_INTERVAL)
  }
}

async function flush() {
  flushTimer = null
  if (metricsQueue.length === 0) return

  const batch = metricsQueue.splice(0)

  try {
    // Get token from localStorage (Zustand persisted auth store)
    const authRaw = localStorage.getItem('urban-auth')
    const token = authRaw ? JSON.parse(authRaw)?.state?.token : null
    if (!token) return

    await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ metrics: batch }),
    })
  } catch {
    // Re-queue on failure (fire-and-forget — never block the app)
    metricsQueue.unshift(...batch)
  }
}

export function initWebVitals() {
  // Dynamically import to avoid adding web-vitals to the critical path
  import('web-vitals').then(({ onLCP, onFID, onCLS, onTTFB, onINP }) => {
    onLCP(({ value }) => queueMetric('LCP', value))
    onFID(({ value }) => queueMetric('FID', value))
    onCLS(({ value }) => queueMetric('CLS', value))
    onTTFB(({ value }) => queueMetric('TTFB', value))
    onINP(({ value }) => queueMetric('INP', value))
  }).catch(() => {
    // web-vitals not installed — silently skip
  })

  // Flush remaining metrics on page unload
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush()
    }
  })
}
