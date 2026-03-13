import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  useSecurityOverview,
  useSecurityEvents,
  useResolveSecurityEvent,
  useBlockedIPs,
  useBlockIP,
  useUnblockIP,
  useEmergencyLockdown,
} from '../../api/security'
import { Button, Input } from '../../components/ui'

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export default function SecurityDashboard() {
  const { data: overview } = useSecurityOverview()
  const { data: events } = useSecurityEvents({ resolved: false })
  const { data: blockedIPs } = useBlockedIPs()
  const resolveEvent = useResolveSecurityEvent()
  const blockIPMutation = useBlockIP()
  const unblockIPMutation = useUnblockIP()
  const lockdown = useEmergencyLockdown()

  const [newBlockIP, setNewBlockIP] = useState('')
  const [showLockdownConfirm, setShowLockdownConfirm] = useState(false)
  const [lockdownResult, setLockdownResult] = useState<number | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  const handleLockdown = async () => {
    const result = await lockdown.mutateAsync()
    setLockdownResult(result.sessions_revoked)
    setShowLockdownConfirm(false)
  }

  const handleBlockIP = async () => {
    if (!newBlockIP.trim()) return
    await blockIPMutation.mutateAsync({ ip: newBlockIP.trim() })
    setNewBlockIP('')
  }

  const kpis = [
    { label: 'Active Sessions', value: overview?.active_sessions ?? '—', icon: '🔑', color: 'text-[#51459d]' },
    { label: 'Failed Logins (24h)', value: overview?.failed_logins_24h ?? '—', icon: '🚫', color: (overview?.failed_logins_24h ?? 0) > 50 ? 'text-[#ff3a6e]' : 'text-gray-900' },
    { label: 'Locked Accounts', value: overview?.locked_accounts ?? '—', icon: '🔒', color: (overview?.locked_accounts ?? 0) > 0 ? 'text-[#ffa21d]' : 'text-gray-900' },
    { label: 'Unresolved Events', value: overview?.unresolved_security_events ?? '—', icon: '⚠️', color: (overview?.unresolved_security_events ?? 0) > 0 ? 'text-[#ff3a6e]' : 'text-gray-900' },
  ]

  const filteredEvents = events?.filter(e => severityFilter === 'all' || e.severity === severityFilter) ?? []

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-8 px-3 sm:px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Security Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time security monitoring and incident response</p>
        </div>
        <Button
          variant="danger"
          onClick={() => setShowLockdownConfirm(true)}
          loading={lockdown.isPending}
          className="w-full sm:w-auto"
        >
          Emergency Lockdown
        </Button>
      </div>

      {/* Lockdown confirm */}
      {showLockdownConfirm && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-5">
          <h3 className="font-bold text-red-900">Confirm Emergency Lockdown</h3>
          <p className="text-sm text-red-800 mt-1">
            This will immediately revoke ALL active sessions for non-admin users. They will need to sign in again.
            Super admin sessions are preserved.
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="danger" onClick={handleLockdown} loading={lockdown.isPending}>
              Yes, Initiate Lockdown
            </Button>
            <Button variant="ghost" onClick={() => setShowLockdownConfirm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {lockdownResult !== null && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-medium text-green-800">
            Lockdown complete — {lockdownResult} sessions revoked.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setLockdownResult(null)} className="mt-1">Dismiss</Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className={`text-3xl font-bold ${kpi.color} dark:text-gray-100`}>{kpi.value}</div>
            <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Security Events */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active Security Events</h2>
          <div className="flex gap-1">
            {['all', 'critical', 'high', 'medium', 'low'].map(s => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  severityFilter === s
                    ? 'bg-[#51459d] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">✓</div>
            <p className="text-sm">No active security events</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEvents.map(event => (
              <div key={event.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 mt-0.5 ${SEVERITY_COLORS[event.severity]}`}>
                  {event.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.event_type}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {event.ip_address && <span>IP: {event.ip_address} · </span>}
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </p>
                  {event.details && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{JSON.stringify(event.details)}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {event.ip_address && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => blockIPMutation.mutate({ ip: event.ip_address! })}
                      loading={blockIPMutation.isPending}
                      className="text-xs"
                    >
                      Block IP
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resolveEvent.mutate(event.id)}
                    loading={resolveEvent.isPending}
                    className="text-xs text-[#6fd943]"
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* IP Blocklist */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">IP Blocklist</h2>

        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Enter IP address (e.g. 192.168.1.1)"
            value={newBlockIP}
            onChange={e => setNewBlockIP(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleBlockIP() }}
            className="flex-1"
          />
          <Button variant="danger" onClick={handleBlockIP} loading={blockIPMutation.isPending} disabled={!newBlockIP.trim()}>
            Block IP
          </Button>
        </div>

        {blockedIPs?.blocked_ips && blockedIPs.blocked_ips.length > 0 ? (
          <div className="space-y-1">
            {blockedIPs.blocked_ips.map(ip => (
              <div key={ip} className="flex items-center justify-between px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <code className="text-sm text-red-800 dark:text-red-300">{ip}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unblockIPMutation.mutate(ip)}
                  loading={unblockIPMutation.isPending}
                  className="text-xs text-gray-600"
                >
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No IPs currently blocked.</p>
        )}
      </section>
    </div>
  )
}
