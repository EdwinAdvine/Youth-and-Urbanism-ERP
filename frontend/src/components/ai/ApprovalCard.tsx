interface ApprovalCardProps {
  action: string
  description: string
  riskLevel: string
  onApprove: () => void
  onReject: () => void
}

const RISK_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  warn: { bg: 'bg-warning/5', text: 'text-warning', border: 'border-warning/30' },
  require_approval: { bg: 'bg-danger/5', text: 'text-danger', border: 'border-danger/30' },
}

export default function ApprovalCard({ action, description, riskLevel, onApprove, onReject }: ApprovalCardProps) {
  const style = RISK_STYLES[riskLevel] || RISK_STYLES.warn

  return (
    <div className={`rounded-[10px] border ${style.border} ${style.bg} p-3 text-xs`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-700">{action}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
          {riskLevel === 'require_approval' ? 'High Risk' : 'Review'}
        </span>
      </div>
      <p className="text-gray-500 text-[11px] mb-3">{description}</p>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 px-3 py-1.5 rounded-lg bg-success text-white text-[11px] font-semibold hover:bg-success/90 transition-colors"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          className="flex-1 px-3 py-1.5 rounded-lg bg-danger text-white text-[11px] font-semibold hover:bg-danger/90 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
