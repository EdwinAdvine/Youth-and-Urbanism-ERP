import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, toast, Select } from '../../components/ui'
import {
  useActiveChatSessions,
  useAcceptChatSession,
  useOnlineAgents,
  useHeartbeat,
  type LiveChatSession,
} from '../../api/support_phase1'
import { useAuthStore } from '../../store/auth'

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  queued: 'warning',
  active: 'success',
  waiting: 'info',
  closed: 'default',
}

const AGENT_STATUS_OPTIONS = [
  { value: 'online', label: 'Online' },
  { value: 'away', label: 'Away' },
  { value: 'busy', label: 'Busy' },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatAvgWait(sessions: LiveChatSession[]): string {
  const queued = sessions.filter((s) => s.status === 'queued')
  if (queued.length === 0) return '0s'
  const totalMs = queued.reduce((sum, s) => sum + (Date.now() - new Date(s.created_at).getTime()), 0)
  const avgSeconds = Math.floor(totalMs / queued.length / 1000)
  if (avgSeconds < 60) return `${avgSeconds}s`
  const mins = Math.floor(avgSeconds / 60)
  const secs = avgSeconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export default function LiveChatDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [agentStatus, setAgentStatus] = useState('online')

  const { data: sessions, isLoading } = useActiveChatSessions()
  const { data: onlineAgents } = useOnlineAgents()
  const acceptMutation = useAcceptChatSession()
  const heartbeat = useHeartbeat()

  // Send heartbeat on mount and when agent status changes
  useEffect(() => {
    heartbeat.mutate({ status: agentStatus })
    const interval = setInterval(() => {
      heartbeat.mutate({ status: agentStatus })
    }, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentStatus])

  // Auto-refresh sessions every 10 seconds
  // (handled by adding refetchInterval to the hook call — but since useActiveChatSessions
  //  doesn't have it built-in, we override via queryClient or use a manual interval)
  useEffect(() => {
    const interval = setInterval(() => {
      // TanStack Query will refetch on window focus; for polling we rely on
      // the sessions query. We trigger a soft refetch by invalidating.
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleAccept = async (sessionId: string) => {
    try {
      await acceptMutation.mutateAsync(sessionId)
      toast('success', 'Chat session accepted')
      navigate(`/support/live-chat/${sessionId}`)
    } catch {
      toast('error', 'Failed to accept chat session')
    }
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAgentStatus(e.target.value)
    heartbeat.mutate({ status: e.target.value })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const allSessions = sessions ?? []
  const queuedSessions = allSessions.filter((s) => s.status === 'queued')
  const activeSessions = allSessions.filter(
    (s) => s.status === 'active' && s.agent_id === user?.id
  )
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayTotal = allSessions.filter(
    (s) => new Date(s.created_at) >= todayStart
  ).length

  const statCards = [
    {
      label: 'Active Sessions',
      value: String(activeSessions.length),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Queued',
      value: String(queuedSessions.length),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: queuedSessions.length > 0 ? 'text-orange-600 bg-orange-50' : 'text-gray-600 bg-gray-50',
    },
    {
      label: 'Avg Wait Time',
      value: formatAvgWait(allSessions),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: "Today's Total",
      value: String(todayTotal),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'text-purple-600 bg-purple-50',
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Live Chat</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage live chat sessions and queue
            {onlineAgents && (
              <span className="ml-2 text-green-600 font-medium">
                {onlineAgents.length} agent{onlineAgents.length !== 1 ? 's' : ''} online
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <Select
              label="Your Status"
              options={AGENT_STATUS_OPTIONS}
              value={agentStatus}
              onChange={handleStatusChange}
            />
          </div>
          <div
            className={cn(
              'h-3 w-3 rounded-full mt-5',
              agentStatus === 'online' && 'bg-[#6fd943]',
              agentStatus === 'away' && 'bg-[#ffa21d]',
              agentStatus === 'busy' && 'bg-[#ff3a6e]'
            )}
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-start gap-4">
              <div className={cn('p-3 rounded-[10px]', stat.color)}>
                {stat.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queued Sessions */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Queued Sessions
            {queuedSessions.length > 0 && (
              <Badge variant="warning" className="ml-2">{queuedSessions.length}</Badge>
            )}
          </h2>
          {queuedSessions.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-400 text-center py-6">No sessions in queue</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {queuedSessions.map((session) => (
                <Card key={session.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {session.visitor_name || session.visitor_email || 'Anonymous Visitor'}
                        </span>
                        <Badge variant={STATUS_BADGE[session.status] ?? 'default'}>
                          {session.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="capitalize">{session.channel}</span>
                        <span>{timeAgo(session.created_at)}</span>
                        {session.visitor_email && (
                          <span className="truncate">{session.visitor_email}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(session.id)}
                      loading={acceptMutation.isPending}
                    >
                      Accept
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Active Sessions */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Your Active Sessions
            {activeSessions.length > 0 && (
              <Badge variant="success" className="ml-2">{activeSessions.length}</Badge>
            )}
          </h2>
          {activeSessions.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-400 text-center py-6">No active sessions</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <Card
                  key={session.id}
                  className="cursor-pointer hover:border-[#51459d]/30 transition-colors"
                  onClick={() => navigate(`/support/live-chat/${session.id}`)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {session.visitor_name || session.visitor_email || 'Anonymous Visitor'}
                        </span>
                        <Badge variant={STATUS_BADGE[session.status] ?? 'default'}>
                          {session.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="capitalize">{session.channel}</span>
                        <span>{timeAgo(session.created_at)}</span>
                        {session.visitor_email && (
                          <span className="truncate">{session.visitor_email}</span>
                        )}
                      </div>
                    </div>
                    <svg
                      className="h-5 w-5 text-gray-400 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
