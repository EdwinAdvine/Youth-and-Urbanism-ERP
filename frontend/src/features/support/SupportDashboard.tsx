import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table } from '../../components/ui'
import { useSupportStats, useTickets, type Ticket } from '../../api/support'
import { useActiveChatSessions, useOnlineAgents } from '../../api/support_phase1'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  open: 'info',
  in_progress: 'warning',
  waiting_on_customer: 'default',
  waiting_on_internal: 'default',
  resolved: 'success',
  closed: 'primary',
}

const PRIORITY_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

export default function SupportDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useSupportStats()
  const { data: recentTickets, isLoading: ticketsLoading } = useTickets({ limit: 10 })
  const { data: chatSessions } = useActiveChatSessions()
  const { data: onlineAgents } = useOnlineAgents()

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Open Tickets',
      value: String(stats?.open_tickets ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      ),
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'In Progress',
      value: String(stats?.in_progress_tickets ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-orange-600 bg-orange-50',
    },
    {
      label: 'Resolved',
      value: String(stats?.resolved_tickets ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'SLA Breached',
      value: String(stats?.sla_breached ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: (stats?.sla_breached ?? 0) > 0 ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50',
    },
  ]

  const priorityData = stats?.tickets_by_priority ?? {}
  const categoryData = stats?.tickets_by_category ?? []

  const ticketColumns = [
    {
      key: 'ticket_number',
      label: 'Ticket',
      render: (row: Ticket) => (
        <button
          className="text-primary font-medium hover:underline"
          onClick={() => navigate(`/support/tickets/${row.id}`)}
        >
          {row.ticket_number}
        </button>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (row: Ticket) => (
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[240px] block">{row.subject}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Ticket) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row: Ticket) => (
        <Badge variant={PRIORITY_BADGE[row.priority] ?? 'default'}>{row.priority}</Badge>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: Ticket) => <span className="text-gray-600 dark:text-gray-400">{row.customer_name || row.customer_email || '-'}</span>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: Ticket) => <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>,
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customer Center</h1>
          <p className="text-sm text-gray-500 mt-1">Support tickets, knowledge base, and SLA management</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/support/tickets?create=1')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'Tickets', path: '/support/tickets' },
          { label: 'Live Chat', path: '/support/live-chat' },
          { label: 'Knowledge Base', path: '/support/kb' },
          { label: 'Categories', path: '/support/categories' },
          { label: 'SLA Policies', path: '/support/sla' },
          { label: 'Views', path: '/support/views' },
          { label: 'Templates', path: '/support/templates' },
          { label: 'Inbound Email', path: '/support/inbound-email' },
          { label: 'Automations', path: '/support/automations' },
          { label: 'Forum', path: '/support/forum' },
          { label: 'Omnichannel', path: '/support/omnichannel' },
          { label: 'Analytics', path: '/support/analytics' },
          { label: 'Voice Calls', path: '/support/voice' },
          { label: 'Proactive Rules', path: '/support/proactive-rules' },
          { label: 'Agent Skills', path: '/support/agent-skills' },
          { label: 'Schedule', path: '/support/agent-schedule' },
          { label: 'Sandboxes', path: '/support/sandboxes' },
          { label: 'Customer Health', path: '/support/customer-health' },
        ].map((item) => (
          <Button key={item.path} variant="outline" size="sm" onClick={() => navigate(item.path)}>
            {item.label}
          </Button>
        ))}
      </div>

      {/* Live Chat & Agents Online Bar */}
      <div className="flex items-center gap-4 mb-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-[10px]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {onlineAgents?.length ?? 0} agents online
          </span>
        </div>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {(chatSessions ?? []).filter((s: { status: string }) => s.status === 'queued').length} chats queued
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {(chatSessions ?? []).filter((s: { status: string }) => s.status === 'active').length} active
          </span>
        </div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate('/support/live-chat')}>
            Open Live Chat
          </Button>
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

      {/* Two-column: Priority breakdown + Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Priority breakdown */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Tickets by Priority</h2>
          <div className="space-y-3">
            {Object.entries(priorityData).map(([priority, count]) => {
              const total = stats?.total_tickets || 1
              const pct = Math.round((count / total) * 100)
              const colors: Record<string, string> = {
                urgent: 'bg-red-500',
                high: 'bg-orange-500',
                medium: 'bg-blue-500',
                low: 'bg-gray-400',
              }
              return (
                <div key={priority}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{priority}</span>
                    <span className="text-sm text-gray-500">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', colors[priority] || 'bg-gray-400')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {Object.keys(priorityData).length === 0 && (
              <p className="text-sm text-gray-400">No ticket data yet</p>
            )}
          </div>
        </Card>

        {/* Category breakdown */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Tickets by Category</h2>
          <div className="space-y-3">
            {categoryData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                <Badge variant="primary">{cat.count}</Badge>
              </div>
            ))}
            {categoryData.length === 0 && (
              <p className="text-sm text-gray-400">No categories yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* Avg response time */}
      {stats?.avg_response_hours !== null && stats?.avg_response_hours !== undefined && (
        <div className="mb-8">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-[10px] text-primary bg-primary/10">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg. First Response Time</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.avg_response_hours} hours</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Recent Tickets */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Tickets</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/support/tickets')}>
            View All
          </Button>
        </div>
        <Table<Ticket>
          columns={ticketColumns}
          data={recentTickets?.tickets ?? []}
          loading={ticketsLoading}
          emptyText="No tickets yet"
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  )
}
