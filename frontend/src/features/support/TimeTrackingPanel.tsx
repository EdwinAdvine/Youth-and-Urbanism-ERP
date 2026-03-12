import { useState, useEffect, useCallback } from 'react'
import { Button, Spinner, Badge, Card, toast } from '../../components/ui'
import {
  useTicketTimeEntries,
  useStartTimer,
  useStopTimer,
  useDeleteTimeEntry,
  type TimeEntry,
} from '../../api/support_phase1'

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TimeTrackingPanel({ ticketId }: { ticketId: string }) {
  const { data: entries, isLoading } = useTicketTimeEntries(ticketId)
  const startTimerMut = useStartTimer()
  const stopTimerMut = useStopTimer()
  const deleteEntryMut = useDeleteTimeEntry()

  // Find the running entry (one with no ended_at)
  const runningEntry = entries?.find((e: TimeEntry) => !e.ended_at) ?? null

  // Live elapsed timer
  const [elapsed, setElapsed] = useState(0)

  const computeElapsed = useCallback(() => {
    if (!runningEntry) return 0
    return Math.floor((Date.now() - new Date(runningEntry.started_at).getTime()) / 1000)
  }, [runningEntry])

  useEffect(() => {
    if (!runningEntry) {
      setElapsed(0)
      return
    }
    setElapsed(computeElapsed())
    const interval = setInterval(() => {
      setElapsed(computeElapsed())
    }, 1000)
    return () => clearInterval(interval)
  }, [runningEntry, computeElapsed])

  const handleStart = async () => {
    try {
      await startTimerMut.mutateAsync(ticketId)
      toast('success', 'Timer started')
    } catch {
      toast('error', 'Failed to start timer')
    }
  }

  const handleStop = async () => {
    try {
      await stopTimerMut.mutateAsync(ticketId)
      toast('success', 'Timer stopped')
    } catch {
      toast('error', 'Failed to stop timer')
    }
  }

  const handleDelete = async (entryId: string) => {
    if (!window.confirm('Delete this time entry?')) return
    try {
      await deleteEntryMut.mutateAsync(entryId)
      toast('success', 'Time entry deleted')
    } catch {
      toast('error', 'Failed to delete time entry')
    }
  }

  // Completed entries (have ended_at)
  const completedEntries = entries?.filter((e: TimeEntry) => !!e.ended_at) ?? []
  const totalSeconds = completedEntries.reduce(
    (sum: number, e: TimeEntry) => sum + (e.duration_seconds ?? 0),
    0
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Time Tracking</h3>

      {/* Start / Stop Button */}
      <div className="mb-4">
        {runningEntry ? (
          <div className="space-y-3">
            {/* Running timer display */}
            <div className="flex items-center gap-3 rounded-[10px] bg-[#51459d]/5 border border-[#51459d]/20 px-4 py-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff3a6e] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff3a6e]" />
              </span>
              <span className="text-lg font-mono font-bold text-[#51459d]">
                {formatDuration(elapsed)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-[#ff3a6e] text-[#ff3a6e] hover:bg-[#ff3a6e]/5"
              onClick={handleStop}
              loading={stopTimerMut.isPending}
            >
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop Timer
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full"
            onClick={handleStart}
            loading={startTimerMut.isPending}
          >
            <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="6,4 20,12 6,20" />
            </svg>
            Start Timer
          </Button>
        )}
      </div>

      {/* Completed entries list */}
      {completedEntries.length > 0 ? (
        <div className="space-y-2 mb-4">
          {completedEntries.map((entry: TimeEntry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-[10px] bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                    {formatDuration(entry.duration_seconds ?? 0)}
                  </span>
                  {entry.is_billable && (
                    <Badge variant="success" className="text-[10px]">Billable</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{formatDate(entry.started_at)}</span>
                  {entry.agent_name && (
                    <span className="text-xs text-gray-400">by {entry.agent_name}</span>
                  )}
                </div>
                {entry.note && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{entry.note}</p>
                )}
              </div>
              <button
                className="text-xs text-[#ff3a6e] hover:underline ml-2 flex-shrink-0"
                onClick={() => handleDelete(entry.id)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-4">No time entries yet</p>
      )}

      {/* Total time */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Time</span>
        <span className="text-sm font-mono font-bold text-gray-900 dark:text-gray-100">
          {formatDuration(totalSeconds)}
        </span>
      </div>
    </Card>
  )
}
