import { useState } from 'react'
import {
  useMailSuggestions,
  useAcceptMailSuggestion,
  type MailSuggestion,
} from '../../api/calendar_ext'

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const cls =
    value >= 0.7
      ? 'bg-[#6fd943]/15 text-green-700 dark:text-green-400'
      : value >= 0.4
      ? 'bg-[#ffa21d]/15 text-orange-700 dark:text-orange-400'
      : 'bg-[#ff3a6e]/15 text-red-700 dark:text-red-400'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${cls}`}>
      {pct}% match
    </span>
  )
}

// ─── Single suggestion card ───────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onDismiss,
}: {
  suggestion: MailSuggestion
  onDismiss: (id: string) => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [overrides, setOverrides] = useState({
    title: suggestion.suggested_event.title ?? '',
    start_time: '',
    end_time: '',
    location: suggestion.suggested_event.location ?? '',
  })

  const acceptMutation = useAcceptMailSuggestion()

  const handleCreate = () => {
    acceptMutation.mutate(
      { suggestionId: suggestion.suggestion_id },
      { onSuccess: () => onDismiss(suggestion.suggestion_id) }
    )
  }

  const handleEditCreate = () => {
    const payload: Parameters<typeof acceptMutation.mutate>[0] = {
      suggestionId: suggestion.suggestion_id,
      overrides: {
        title: overrides.title || undefined,
        start_time: overrides.start_time || undefined,
        end_time: overrides.end_time || undefined,
        location: overrides.location || undefined,
      },
    }
    acceptMutation.mutate(payload, {
      onSuccess: () => onDismiss(suggestion.suggestion_id),
    })
  }

  const ev = suggestion.suggested_event

  // Build a human-readable time string
  const timeLabel = (() => {
    if (!ev.date) return 'Date not specified'
    const parts = [ev.date]
    if (ev.time) parts.push(`at ${ev.time}`)
    if (ev.duration_minutes) parts.push(`(${ev.duration_minutes} min)`)
    return parts.join(' ')
  })()

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {ev.title || 'Untitled Event'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{timeLabel}</p>
        </div>
        <ConfidenceBadge value={suggestion.confidence} />
      </div>

      {/* Metadata */}
      <div className="space-y-1">
        {ev.location && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="truncate">{ev.location}</span>
          </div>
        )}
        {ev.attendees.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span className="line-clamp-2">{ev.attendees.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <input
            type="text"
            placeholder="Title"
            value={overrides.title}
            onChange={e => setOverrides(p => ({ ...p, title: e.target.value }))}
            className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">Start</label>
              <input
                type="datetime-local"
                value={overrides.start_time}
                onChange={e => setOverrides(p => ({ ...p, start_time: e.target.value }))}
                className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">End</label>
              <input
                type="datetime-local"
                value={overrides.end_time}
                onChange={e => setOverrides(p => ({ ...p, end_time: e.target.value }))}
                className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
              />
            </div>
          </div>
          <input
            type="text"
            placeholder="Location"
            value={overrides.location}
            onChange={e => setOverrides(p => ({ ...p, location: e.target.value }))}
            className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {editMode ? (
          <>
            <button
              onClick={handleEditCreate}
              disabled={acceptMutation.isPending}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-[#51459d] text-white hover:bg-[#51459d]/90 disabled:opacity-60 transition-colors"
            >
              {acceptMutation.isPending ? 'Creating…' : 'Create Event'}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="py-1.5 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleCreate}
              disabled={acceptMutation.isPending}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-[#51459d] text-white hover:bg-[#51459d]/90 disabled:opacity-60 transition-colors"
            >
              {acceptMutation.isPending ? 'Creating…' : 'Create Event'}
            </button>
            <button
              onClick={() => setEditMode(true)}
              className="py-1.5 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDismiss(suggestion.suggestion_id)}
              className="py-1.5 px-2 text-xs rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              title="Dismiss"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function MailScannerPanel() {
  const [scanning, setScanning] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  // Normal fetch (no scan); scan param added only on manual refresh
  const { data: suggestions = [], isLoading } = useMailSuggestions()
  const { refetch: refetchWithScan } = useMailSuggestions({ scan: true })

  const visible = suggestions.filter(s => !dismissed.has(s.suggestion_id))

  const handleRefresh = async () => {
    setScanning(true)
    try {
      await refetchWithScan()
    } finally {
      setScanning(false)
    }
  }

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]))
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Mail Scheduling Suggestions
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            AI-detected scheduling intent from your recent emails
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={scanning || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[8px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          {scanning ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[#51459d] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && visible.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No suggestions found</p>
          <p className="text-xs text-gray-400 mt-1">
            Click Refresh to scan recent emails for scheduling intent
          </p>
        </div>
      )}

      {/* Suggestion cards */}
      {!isLoading && visible.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
            {visible.length} suggestion{visible.length !== 1 ? 's' : ''}
          </p>
          {visible.map(s => (
            <SuggestionCard key={s.suggestion_id} suggestion={s} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  )
}
