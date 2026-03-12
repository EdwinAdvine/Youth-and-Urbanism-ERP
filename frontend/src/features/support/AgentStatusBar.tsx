import { cn } from '../../components/ui'
import {
  useOnlineAgents,
  useTicketViewers,
  useTypingIndicators,
  type AgentPresence,
} from '../../api/support_phase1'

const AVATAR_COLORS = [
  'bg-[#51459d]',
  'bg-[#3ec9d6]',
  'bg-[#ffa21d]',
  'bg-[#6fd943]',
  'bg-[#ff3a6e]',
]

function getAvatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitial(agent: AgentPresence): string {
  // user_id is always present; status may include a display name in some setups
  return (agent.status?.[0] ?? agent.user_id[0] ?? '?').toUpperCase()
}

export default function AgentStatusBar({ ticketId }: { ticketId?: string }) {
  const { data: onlineAgents } = useOnlineAgents()
  const { data: viewers } = useTicketViewers(ticketId ?? '')
  const { data: typingAgents } = useTypingIndicators(ticketId ?? '')

  const agentCount = onlineAgents?.length ?? 0
  const hasViewers = ticketId && viewers && viewers.length > 0
  const hasTyping = ticketId && typingAgents && typingAgents.length > 0

  return (
    <div className="space-y-2">
      {/* Main status bar */}
      <div className="flex items-center gap-3 rounded-[10px] bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 px-3 py-2">
        {/* Online indicator + count */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                agentCount > 0 ? 'animate-ping bg-[#6fd943]' : 'bg-gray-300'
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full h-2.5 w-2.5',
                agentCount > 0 ? 'bg-[#6fd943]' : 'bg-gray-300'
              )}
            />
          </span>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {agentCount} {agentCount === 1 ? 'agent' : 'agents'} online
          </span>
        </div>

        {/* Avatar circles */}
        {onlineAgents && onlineAgents.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {onlineAgents.slice(0, 8).map((agent) => (
              <div
                key={agent.user_id}
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-800',
                  getAvatarColor(agent.user_id)
                )}
                title={agent.user_id}
              >
                {getInitial(agent)}
              </div>
            ))}
            {onlineAgents.length > 8 && (
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500 bg-gray-200 dark:bg-gray-700 ring-2 ring-white dark:ring-gray-800">
                +{onlineAgents.length - 8}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collision banner: other agents viewing this ticket */}
      {hasViewers && (
        <div className="flex items-center gap-2 rounded-[10px] bg-[#ffa21d]/10 border border-[#ffa21d]/30 px-3 py-2">
          <svg className="h-4 w-4 text-[#ffa21d] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="text-xs font-medium text-[#ffa21d]">
            {viewers!.map((v) => v.user_id).join(', ')}{' '}
            {viewers!.length === 1 ? 'is' : 'are'} also viewing this ticket
          </span>
        </div>
      )}

      {/* Typing indicator */}
      {hasTyping && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#51459d] animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#51459d] animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#51459d] animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-xs text-gray-500 italic">
            {typingAgents!.map((a) => a.user_id).join(', ')}{' '}
            {typingAgents!.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}
    </div>
  )
}
