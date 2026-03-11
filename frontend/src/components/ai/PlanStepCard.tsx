import { useState } from 'react'
import type { AgentStep } from '../../hooks/useAgentWebSocket'

function StepBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-500',
    running: 'bg-primary/10 text-primary',
    completed: 'bg-success/10 text-success',
    failed: 'bg-danger/10 text-danger',
    skipped: 'bg-gray-100 text-gray-400',
    awaiting_approval: 'bg-warning/10 text-warning',
    approved: 'bg-success/10 text-success',
    rejected: 'bg-danger/10 text-danger',
  }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${styles[status] || styles.pending}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

interface PlanStepCardProps {
  step: AgentStep
  onApprove?: () => void
  onReject?: () => void
}

export default function PlanStepCard({ step, onApprove, onReject }: PlanStepCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isAwaitingApproval = step.status === 'awaiting_approval'

  return (
    <div className="rounded-[10px] border border-gray-100 bg-white p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 min-w-0 text-left"
        >
          <svg className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-700 truncate">{step.action}</span>
        </button>
        <StepBadge status={step.status} />
      </div>

      {step.rationale && (
        <p className="mt-1 text-gray-400 text-[11px] pl-4.5">{step.rationale}</p>
      )}

      {expanded && step.result && (
        <pre className="mt-2 p-2 bg-gray-50 rounded-lg text-[10px] text-gray-600 overflow-x-auto max-h-32">
          {JSON.stringify(step.result, null, 2)}
        </pre>
      )}

      {isAwaitingApproval && (
        <div className="mt-2 flex gap-2 pl-4.5">
          {step.description && (
            <p className="text-[11px] text-warning mb-1.5 w-full">{step.description}</p>
          )}
          <button
            onClick={onApprove}
            className="px-3 py-1 rounded-lg bg-success/10 text-success text-[11px] font-semibold hover:bg-success/20 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1 rounded-lg bg-danger/10 text-danger text-[11px] font-semibold hover:bg-danger/20 transition-colors"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
