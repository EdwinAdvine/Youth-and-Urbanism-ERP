import { useState } from 'react'
import { Shield, AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../ui'

interface ApprovalCardProps {
  action: string
  description: string
  riskLevel: string
  args?: Record<string, unknown>
  onApprove: () => void
  onReject: () => void
}

const RISK_CONFIG = {
  warn: {
    bg: 'bg-warning/5',
    border: 'border-warning/40',
    text: 'text-warning',
    badgeBg: 'bg-warning/10',
    label: 'Needs Review',
    Icon: AlertTriangle,
    iconBg: 'bg-warning/10',
  },
  require_approval: {
    bg: 'bg-danger/5',
    border: 'border-danger/40',
    text: 'text-danger',
    badgeBg: 'bg-danger/10',
    label: 'High Risk',
    Icon: Shield,
    iconBg: 'bg-danger/10',
  },
}

export default function ApprovalCard({ action, description, riskLevel, args, onApprove, onReject }: ApprovalCardProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [showArgs, setShowArgs] = useState(false)
  const config = RISK_CONFIG[riskLevel as keyof typeof RISK_CONFIG] || RISK_CONFIG.warn
  const { Icon } = config

  const hasArgs = args && Object.keys(args).length > 0

  const handleApprove = async () => {
    setLoading('approve')
    try {
      onApprove()
    } finally {
      // keep loading until parent unmounts this card
    }
  }

  const handleReject = async () => {
    setLoading('reject')
    try {
      onReject()
    } finally {
      // keep loading until parent unmounts this card
    }
  }

  return (
    <div className={cn('rounded-[10px] border p-3 text-xs space-y-2.5', config.bg, config.border)}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', config.iconBg)}>
          <Icon className={cn('h-4 w-4', config.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
              {action.replace(/_/g, ' ')}
            </span>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', config.badgeBg, config.text)}>
              {config.label}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5 leading-snug">{description}</p>
        </div>
      </div>

      {/* Args preview toggle */}
      {hasArgs && (
        <div>
          <button
            onClick={() => setShowArgs(!showArgs)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showArgs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showArgs ? 'Hide' : 'Show'} arguments
          </button>
          {showArgs && (
            <pre className="mt-1.5 p-2 bg-gray-900 text-green-400 rounded-lg text-[10px] overflow-x-auto max-h-24 font-mono leading-relaxed">
              {JSON.stringify(args, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] bg-success text-white text-[11px] font-semibold hover:bg-success/90 disabled:opacity-60 transition-all active:scale-95"
        >
          {loading === 'approve' ? (
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <Check className="h-3 w-3" strokeWidth={2.5} />
          )}
          Approve
        </button>
        <button
          onClick={handleReject}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] bg-white dark:bg-gray-800 border border-danger/30 text-danger text-[11px] font-semibold hover:bg-danger/5 disabled:opacity-60 transition-all active:scale-95"
        >
          {loading === 'reject' ? (
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <X className="h-3 w-3" strokeWidth={2.5} />
          )}
          Reject
        </button>
      </div>
    </div>
  )
}
