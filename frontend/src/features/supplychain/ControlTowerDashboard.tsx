import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Spinner,
} from '../../components/ui'
import {
  useControlTowerDashboard,
  type SCAlert, type ControlTowerEvent,
} from '../../api/supplychain_ops'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })
}

const SEVERITY_BADGE: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ff3a6e',
  high: '#ffa21d',
  medium: '#3ec9d6',
  low: '#9ca3af',
}

export default function ControlTowerDashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useControlTowerDashboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const health = data?.health
  const alerts = data?.recent_alerts ?? []
  const events = data?.events ?? []

  const kpiCards = [
    {
      label: 'Health Score',
      value: health?.health_score != null ? `${Math.round(health.health_score)}%` : '-',
      color: '#6fd943',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Open Alerts',
      value: health?.open_alerts != null ? String(health.open_alerts) : '-',
      color: health?.open_alerts && health.open_alerts > 5 ? '#ff3a6e' : '#ffa21d',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
    },
    {
      label: 'OTIF Rate',
      value: health?.otif_rate != null ? `${Math.round(health.otif_rate * 100)}%` : '-',
      color: '#51459d',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: 'Avg Lead Time',
      value: health?.avg_lead_time_days != null ? `${health.avg_lead_time_days}d` : '-',
      color: '#3ec9d6',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Pending Shipments',
      value: health?.pending_shipments != null ? String(health.pending_shipments) : '-',
      color: '#ffa21d',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      label: 'Delayed Shipments',
      value: health?.delayed_shipments != null ? String(health.delayed_shipments) : '-',
      color: health?.delayed_shipments && health.delayed_shipments > 0 ? '#ff3a6e' : '#6fd943',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Control Tower</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time supply chain visibility</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button variant="outline" onClick={() => navigate('/supply-chain/alerts')}>
            View All Alerts
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <div className="flex items-center gap-3">
              <div
                className="flex-shrink-0 p-2 rounded-[10px]"
                style={{ backgroundColor: kpi.color + '15', color: kpi.color }}
              >
                {kpi.icon}
              </div>
              <div>
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Feed */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Alerts</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/supply-chain/alerts')}>
              View All
            </Button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500">No recent alerts</p>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 10).map((alert: SCAlert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-[10px] bg-gray-50 dark:bg-gray-800"
                >
                  <div
                    className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                    style={{ backgroundColor: SEVERITY_COLOR[alert.severity] ?? '#9ca3af' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={SEVERITY_BADGE[alert.severity] ?? 'default'} >
                        {alert.severity}
                      </Badge>
                      <span className="text-xs text-gray-500">{alert.alert_type}</span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">{alert.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(alert.created_at)} {formatTime(alert.created_at)}</p>
                  </div>
                  <Badge variant={alert.status === 'resolved' ? 'success' : alert.status === 'acknowledged' ? 'info' : 'default'}>
                    {alert.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Event Timeline */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Event Timeline</h2>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">No recent events</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-4">
                {events.slice(0, 15).map((event: ControlTowerEvent) => (
                  <div key={event.id} className="flex items-start gap-3 relative">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                      style={{
                        backgroundColor: (SEVERITY_COLOR[event.severity] ?? '#9ca3af') + '20',
                        borderColor: SEVERITY_COLOR[event.severity] ?? '#9ca3af',
                        borderWidth: '2px',
                      }}
                    />
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.title}</span>
                        <Badge variant={SEVERITY_BADGE[event.severity] ?? 'default'}>
                          {event.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{event.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(event.timestamp)} {formatTime(event.timestamp)}
                        {event.module && <span className="ml-2 text-[#51459d]">{event.module}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
