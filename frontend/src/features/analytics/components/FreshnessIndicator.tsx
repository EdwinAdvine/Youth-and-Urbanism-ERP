/**
 * FreshnessIndicator — shows data freshness with color-coded staleness badge.
 * Auto-updates every 30 seconds to keep "X ago" text current.
 */
import { useState, useEffect } from 'react'

interface FreshnessIndicatorProps {
  lastUpdated: Date | string | null
  isRefreshing?: boolean
  className?: string
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

type StalenessLevel = 'live' | 'fresh' | 'stale' | 'old' | 'none'

function getStaleness(date: Date): StalenessLevel {
  const diffMs = Date.now() - date.getTime()
  const diffMin = diffMs / 60000
  if (diffMin < 1) return 'live'
  if (diffMin < 5) return 'fresh'
  if (diffMin < 15) return 'stale'
  return 'old'
}

const stalenessConfig: Record<StalenessLevel, { dotClass: string; textClass: string; label: string }> = {
  live: { dotClass: 'bg-[#6fd943]', textClass: 'text-[#6fd943]', label: 'Live' },
  fresh: { dotClass: 'bg-[#6fd943]', textClass: 'text-[#6fd943]', label: '' },
  stale: { dotClass: 'bg-[#ffa21d]', textClass: 'text-[#ffa21d]', label: '' },
  old: { dotClass: 'bg-[#ff3a6e]', textClass: 'text-[#ff3a6e]', label: 'Stale' },
  none: { dotClass: 'bg-gray-300', textClass: 'text-gray-400', label: 'No data' },
}

export default function FreshnessIndicator({ lastUpdated, isRefreshing = false, className = '' }: FreshnessIndicatorProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  if (!lastUpdated) {
    const config = stalenessConfig.none
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${config.textClass} ${className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
        {config.label}
      </span>
    )
  }

  const date = lastUpdated instanceof Date ? lastUpdated : new Date(lastUpdated)
  const staleness = getStaleness(date)
  const config = stalenessConfig[staleness]
  const relativeTime = formatRelativeTime(date)
  const displayText = staleness === 'live' ? config.label : (config.label ? `${config.label} · ${relativeTime}` : relativeTime)

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${config.textClass} ${className}`}>
      {isRefreshing ? (
        <svg
          className="w-1.5 h-1.5 animate-spin"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="6"
            cy="6"
            r="4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="14"
            strokeDashoffset="5"
          />
        </svg>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      )}
      {displayText}
    </span>
  )
}
