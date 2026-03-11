const AGENT_COLORS: Record<string, string> = {
  orchestrator: 'border-primary text-primary',
  researcher: 'border-info text-info',
  verifier: 'border-warning text-warning',
  executor: 'border-success text-success',
}

const AGENT_LABELS: Record<string, string> = {
  orchestrator: 'Orchestrator',
  researcher: 'Researcher',
  verifier: 'Verifier',
  executor: 'Executor',
}

interface AgentThinkingIndicatorProps {
  agent: string
  message: string
}

export default function AgentThinkingIndicator({ agent, message }: AgentThinkingIndicatorProps) {
  const colorClass = AGENT_COLORS[agent] || 'border-gray-400 text-gray-600'
  const label = AGENT_LABELS[agent] || agent

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-[10px] border-l-3 ${colorClass} bg-white`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
        <span className="text-xs font-semibold shrink-0">{label}</span>
        <span className="text-xs text-gray-500 truncate">{message}</span>
      </div>
    </div>
  )
}
