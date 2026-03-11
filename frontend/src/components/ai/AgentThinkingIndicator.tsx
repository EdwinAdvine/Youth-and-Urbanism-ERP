import { cn } from '../ui'

// ── Agent pipeline stages ──────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'orchestrator', label: 'Plan', shortLabel: 'Plan', color: 'bg-primary text-primary' },
  { key: 'researcher',   label: 'Research', shortLabel: 'Info', color: 'bg-info text-info' },
  { key: 'verifier',     label: 'Verify', shortLabel: 'Check', color: 'bg-warning text-warning' },
  { key: 'executor',     label: 'Execute', shortLabel: 'Run', color: 'bg-success text-success' },
]

const AGENT_MESSAGES: Record<string, string> = {
  orchestrator: 'Planning your request...',
  researcher: 'Gathering data...',
  verifier: 'Checking permissions...',
  executor: 'Executing action...',
}

const AGENT_DOT_COLORS: Record<string, string> = {
  orchestrator: 'bg-primary',
  researcher: 'bg-info',
  verifier: 'bg-warning',
  executor: 'bg-success',
}

const AGENT_TEXT_COLORS: Record<string, string> = {
  orchestrator: 'text-primary',
  researcher: 'text-info',
  verifier: 'text-warning',
  executor: 'text-success',
}

interface AgentThinkingIndicatorProps {
  agent: string
  message: string
}

export default function AgentThinkingIndicator({ agent, message }: AgentThinkingIndicatorProps) {
  const dotColor = AGENT_DOT_COLORS[agent] || 'bg-gray-400'
  const textColor = AGENT_TEXT_COLORS[agent] || 'text-gray-500 dark:text-gray-400'
  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.key === agent)

  return (
    <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-3 space-y-2.5">
      {/* Pipeline progress */}
      <div className="flex items-center gap-0">
        {PIPELINE_STAGES.map((stage, i) => {
          const isActive = stage.key === agent
          const isDone = currentStageIndex > i
          const isNext = currentStageIndex < i

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              {/* Stage node */}
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center transition-all duration-300 text-[9px] font-bold',
                    isActive
                      ? `${stage.color.split(' ')[0]} text-white ring-2 ring-offset-1 ${stage.color.split(' ')[0].replace('bg-', 'ring-')}/30`
                      : isDone
                        ? `${stage.color.split(' ')[0]} text-white opacity-60`
                        : 'bg-gray-100 dark:bg-gray-900 text-gray-300 dark:text-gray-600',
                  )}
                >
                  {isDone ? '✓' : i + 1}
                </div>
                <span
                  className={cn(
                    'text-[9px] font-medium truncate w-full text-center',
                    isActive ? stage.color.split(' ')[1] : isNext ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400',
                  )}
                >
                  {stage.shortLabel}
                </span>
              </div>

              {/* Connector line (between stages) */}
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  className={cn(
                    'h-px flex-1 max-w-[20px] transition-colors duration-300',
                    isDone ? stage.color.split(' ')[0].replace('bg-', 'bg-') + ' opacity-40' : 'bg-gray-200 dark:bg-gray-700',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Active agent status */}
      <div className="flex items-center gap-2">
        {/* Animated thinking dots */}
        <div className="flex items-center gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn('h-1.5 w-1.5 rounded-full', dotColor)}
              style={{
                animation: `bounce 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
        <span className={cn('text-xs font-medium truncate', textColor)}>
          {message || AGENT_MESSAGES[agent] || 'Working...'}
        </span>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
