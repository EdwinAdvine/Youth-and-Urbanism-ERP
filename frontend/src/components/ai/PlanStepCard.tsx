import { useState } from 'react'
import { Check, X, Clock, Play, AlertTriangle, SkipForward, ChevronRight } from 'lucide-react'
import { cn } from '../ui'
import type { AgentStep } from '../../hooks/useAgentWebSocket'

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string; Icon: React.ElementType }> = {
  pending:           { bg: 'bg-gray-100',       text: 'text-gray-500',   border: 'border-gray-200',   label: 'Pending',    Icon: Clock },
  running:           { bg: 'bg-primary/10',      text: 'text-primary',    border: 'border-primary/20', label: 'Running',    Icon: Play },
  completed:         { bg: 'bg-success/10',      text: 'text-success',    border: 'border-success/20', label: 'Done',       Icon: Check },
  failed:            { bg: 'bg-danger/10',       text: 'text-danger',     border: 'border-danger/20',  label: 'Failed',     Icon: X },
  skipped:           { bg: 'bg-gray-100',        text: 'text-gray-400',   border: 'border-gray-200',   label: 'Skipped',    Icon: SkipForward },
  awaiting_approval: { bg: 'bg-warning/10',      text: 'text-warning',    border: 'border-warning/30', label: 'Approval',   Icon: AlertTriangle },
  approved:          { bg: 'bg-success/10',      text: 'text-success',    border: 'border-success/20', label: 'Approved',   Icon: Check },
  rejected:          { bg: 'bg-danger/10',       text: 'text-danger',     border: 'border-danger/20',  label: 'Rejected',   Icon: X },
}

function StepStatusIcon({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending

  if (status === 'running') {
    return (
      <span className={cn('flex items-center justify-center h-4 w-4 rounded-full shrink-0', config.bg)}>
        <svg className={cn('h-2.5 w-2.5 animate-spin', config.text)} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
    )
  }

  const { Icon } = config
  return (
    <span className={cn('flex items-center justify-center h-4 w-4 rounded-full shrink-0', config.bg)}>
      <Icon className={cn('h-2.5 w-2.5', config.text)} strokeWidth={2.5} />
    </span>
  )
}

function StepBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0', config.bg, config.text, config.border)}>
      {config.label}
    </span>
  )
}

// ── Result display ─────────────────────────────────────────────────────────

function ResultDisplay({ result }: { result: Record<string, unknown> }) {
  // Try to extract a human-readable summary from common result shapes
  const summary = (() => {
    if (typeof result.message === 'string') return result.message
    if (typeof result.summary === 'string') return result.summary
    if (typeof result.name === 'string') return `Created: ${result.name}`
    if (typeof result.id === 'string' || typeof result.id === 'number') return `ID: ${result.id}`
    return null
  })()

  return (
    <div className="mt-2">
      {summary && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">{summary}</p>
      )}
      <pre className="p-2 bg-gray-900 text-green-400 rounded-lg text-[10px] overflow-x-auto max-h-28 font-mono leading-relaxed">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  )
}

// ── PlanStepCard ───────────────────────────────────────────────────────────

interface PlanStepCardProps {
  step: AgentStep
  stepNumber?: number
  onApprove?: () => void
  onReject?: () => void
}

export default function PlanStepCard({ step, stepNumber, onApprove, onReject }: PlanStepCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isAwaitingApproval = step.status === 'awaiting_approval'
  const isCompleted = step.status === 'completed'
  const isFailed = step.status === 'failed'

  const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending

  return (
    <div
      className={cn(
        'rounded-[10px] border bg-white dark:bg-gray-800 text-xs transition-all duration-200',
        isAwaitingApproval ? 'border-warning/40 shadow-sm shadow-warning/10' : 'border-gray-100 dark:border-gray-800',
        isFailed && 'border-danger/30',
      )}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-2 text-left"
      >
        {/* Step number */}
        {stepNumber !== undefined && (
          <span
            className={cn(
              'h-4 w-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0',
              isCompleted ? 'bg-success/15 text-success' : isFailed ? 'bg-danger/15 text-danger' : 'bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400',
            )}
          >
            {isCompleted ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : stepNumber}
          </span>
        )}

        {/* Status icon */}
        <StepStatusIcon status={step.status} />

        {/* Action name */}
        <span className={cn('font-medium flex-1 truncate', config.text === 'text-primary' || config.text === 'text-success' ? 'text-gray-700 dark:text-gray-300' : config.text)}>
          {step.action.replace(/_/g, ' ')}
        </span>

        <StepBadge status={step.status} />

        <ChevronRight
          className={cn('h-3 w-3 text-gray-300 dark:text-gray-600 transition-transform shrink-0', expanded && 'rotate-90')}
        />
      </button>

      {/* Rationale */}
      {step.rationale && (
        <p className="text-gray-400 text-[11px] px-2.5 pb-1.5 leading-snug" style={{ paddingLeft: stepNumber !== undefined ? '2.75rem' : '1rem' }}>
          {step.rationale}
        </p>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-gray-50 dark:border-gray-900 pt-2" style={{ paddingLeft: stepNumber !== undefined ? '2.75rem' : '0.625rem' }}>
          {step.args && Object.keys(step.args).length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Arguments</p>
              <pre className="p-2 bg-gray-50 dark:bg-gray-950 rounded-lg text-[10px] text-gray-600 dark:text-gray-400 overflow-x-auto max-h-24 font-mono">
                {JSON.stringify(step.args, null, 2)}
              </pre>
            </div>
          )}
          {step.result && <ResultDisplay result={step.result} />}
        </div>
      )}

      {/* Approval section */}
      {isAwaitingApproval && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-warning/20 pt-2" style={{ paddingLeft: '0.625rem' }}>
          {step.description && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-warning leading-snug">{step.description}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className="flex-1 px-3 py-1.5 rounded-lg bg-success text-white text-[11px] font-semibold hover:bg-success/90 transition-colors active:scale-95"
            >
              Approve
            </button>
            <button
              onClick={onReject}
              className="flex-1 px-3 py-1.5 rounded-lg bg-danger/10 text-danger text-[11px] font-semibold hover:bg-danger/20 transition-colors active:scale-95"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
