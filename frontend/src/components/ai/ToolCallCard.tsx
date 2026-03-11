import { useState } from 'react'
import { cn } from '../ui'

export interface ToolCallCardProps {
  /** Name of the tool that was invoked */
  toolName: string
  /** Arguments passed to the tool */
  args: Record<string, any>
  /** Result returned by the tool (undefined while running) */
  result?: any
  /** Current execution status */
  status: 'running' | 'complete' | 'error'
}

/** Friendly labels for known tool names. Falls back to the raw name. */
const TOOL_LABELS: Record<string, string> = {
  create_calendar_event: 'Create Calendar Event',
  send_email: 'Send Email',
  search_files: 'Search Files',
  create_note: 'Create Note',
  create_project_task: 'Create Task',
  lookup_inventory: 'Lookup Inventory',
  check_stock_level: 'Check Stock Level',
  create_purchase_order: 'Create Purchase Order',
}

function friendlyName(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ')
}

/**
 * Collapsible card that visualises an AI tool invocation.
 *
 * - While running: shows a spinner next to the tool name.
 * - On completion: shows a success indicator and a preview of the result.
 * - On error: uses a red accent.
 * - Click the header to expand / collapse the full args and result JSON.
 */
export default function ToolCallCard({ toolName, args, result, status }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  const statusColors = {
    running: 'border-[#51459d]/30 bg-[#51459d]/5',
    complete: 'border-[#6fd943]/40 bg-[#6fd943]/5',
    error: 'border-[#ff3a6e]/40 bg-[#ff3a6e]/5',
  }

  const iconColor = {
    running: 'text-[#51459d]',
    complete: 'text-[#6fd943]',
    error: 'text-[#ff3a6e]',
  }

  return (
    <div className={cn('rounded-[10px] border text-sm my-2 overflow-hidden transition-colors', statusColors[status])}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-black/[0.03] transition-colors"
      >
        {/* Tool icon */}
        <span className={cn('shrink-0', iconColor[status])}>
          {status === 'running' ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : status === 'complete' ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
          )}
        </span>

        {/* Tool name */}
        <span className="font-medium text-gray-800 truncate flex-1">
          {friendlyName(toolName)}
        </span>

        {/* Status badge */}
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full',
          status === 'running' && 'bg-[#51459d]/10 text-[#51459d]',
          status === 'complete' && 'bg-[#6fd943]/15 text-[#438a2a]',
          status === 'error' && 'bg-[#ff3a6e]/10 text-[#ff3a6e]',
        )}>
          {status}
        </span>

        {/* Chevron */}
        <svg
          className={cn('h-4 w-4 text-gray-400 transition-transform shrink-0', expanded && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Result preview (always visible when complete) */}
      {!expanded && status === 'complete' && result !== undefined && (
        <div className="px-3 pb-2 text-xs text-gray-500 truncate">
          {typeof result === 'string' ? result.slice(0, 120) : JSON.stringify(result).slice(0, 120)}
          {(typeof result === 'string' ? result.length : JSON.stringify(result).length) > 120 && '...'}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-200/50 px-3 py-2 space-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Arguments</p>
            <pre className="text-xs bg-white/60 rounded-md p-2 overflow-x-auto max-h-40 text-gray-700">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Result</p>
              <pre className={cn(
                'text-xs rounded-md p-2 overflow-x-auto max-h-40',
                status === 'error' ? 'bg-[#ff3a6e]/5 text-[#ff3a6e]' : 'bg-white/60 text-gray-700'
              )}>
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
