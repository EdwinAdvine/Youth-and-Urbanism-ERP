import { useState } from 'react'
import { Card, Button, Spinner, Badge } from '../../components/ui'
import { formatFileSize } from '../../api/drive'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// ─── API hooks ────────────────────────────────────────────────────────────────

function useUsersStorage() {
  return useQuery({
    queryKey: ['drive', 'admin', 'users-storage'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/drive/admin/drive/users-storage?limit=50')
      return res.data as { users: UserStorageRow[]; total: number }
    },
  })
}

function useAnomalyAlerts(unresolvedOnly = false) {
  return useQuery({
    queryKey: ['drive', 'admin', 'anomaly-alerts', unresolvedOnly],
    queryFn: async () => {
      const res = await axios.get(
        `/api/v1/drive/admin/drive/anomaly-alerts?days=30&unresolved_only=${unresolvedOnly}`
      )
      return res.data as { alerts: AnomalyAlert[]; total: number }
    },
  })
}

function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (alertId: string) =>
      axios.post(`/api/v1/drive/admin/drive/anomaly-alerts/${alertId}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive', 'admin', 'anomaly-alerts'] }),
  })
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserStorageRow {
  user_id: string
  email: string
  full_name: string
  file_count: number
  total_size: number
  last_upload: string | null
}

interface AnomalyAlert {
  id: string
  user_id: string
  user_email: string
  alert_type: string
  severity: string
  details: Record<string, unknown>
  is_resolved: boolean
  detected_at: string
}

// ─── Severity badge ───────────────────────────────────────────────────────────

const SEVERITY_VARIANTS: Record<string, 'danger' | 'warning' | 'default' | 'success'> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
}

// ─── Component ────────────────────────────────────────────────────────────────

type AdminTab = 'storage' | 'alerts'

export default function DriveAdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('storage')
  const [unresolvedOnly, setUnresolvedOnly] = useState(true)

  const { data: storageData, isLoading: storageLoading } = useUsersStorage()
  const { data: alertsData, isLoading: alertsLoading } = useAnomalyAlerts(unresolvedOnly)
  const resolveAlert = useResolveAlert()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Drive Administration</h2>
        <p className="text-sm text-gray-500 mt-0.5">User storage breakdown, anomaly detection & compliance</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border border-gray-200 dark:border-gray-700 rounded-[8px] overflow-hidden text-xs">
        {([['storage', '💾 Storage'], ['alerts', '🚨 Anomaly Alerts']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 font-medium transition-colors ${
              activeTab === id ? 'bg-[#51459d] text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {label}
            {id === 'alerts' && alertsData && alertsData.alerts.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {alertsData.alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Storage Tab */}
      {activeTab === 'storage' && (
        <div className="space-y-3">
          {storageLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !storageData?.users.length ? (
            <Card>
              <p className="text-sm text-gray-400 text-center py-8">No storage data available.</p>
            </Card>
          ) : (
            <>
              {/* Summary */}
              <Card>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Total Users</p>
                    <p className="text-2xl font-bold text-[#51459d]">{storageData.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Storage Used</p>
                    <p className="text-2xl font-bold text-[#3ec9d6]">
                      {formatFileSize(storageData.users.reduce((a, u) => a + u.total_size, 0))}
                    </p>
                  </div>
                </div>
              </Card>

              <Card padding={false}>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {storageData.users.map((user, i) => {
                    const pct = Math.min((user.total_size / (10 * 1024 * 1024 * 1024)) * 100, 100) // 10GB default
                    const isWarning = pct > 80
                    return (
                      <div key={user.user_id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-[#51459d]/10 flex items-center justify-center text-sm font-semibold text-[#51459d] shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {user.full_name || user.email}
                            </p>
                            {isWarning && (
                              <Badge variant="warning" className="shrink-0">Near Limit</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{user.email}</p>
                          <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isWarning ? 'bg-[#ffa21d]' : 'bg-[#51459d]'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {formatFileSize(user.total_size)}
                          </p>
                          <p className="text-[11px] text-gray-400">{user.file_count.toLocaleString()} files</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Anomaly Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={unresolvedOnly}
                onChange={(e) => setUnresolvedOnly(e.target.checked)}
                className="rounded"
              />
              Unresolved only
            </label>
          </div>

          {alertsLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !alertsData?.alerts.length ? (
            <Card>
              <div className="text-center py-10">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No anomalies detected</p>
                <p className="text-xs text-gray-400 mt-1">Behavioral analysis runs weekly</p>
              </div>
            </Card>
          ) : (
            <Card padding={false}>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {alertsData.alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-[8px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-lg shrink-0">
                      🚨
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {alert.alert_type.replace(/_/g, ' ')}
                        </p>
                        <Badge variant={SEVERITY_VARIANTS[alert.severity] || 'default'}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">{alert.user_email}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(alert.detected_at).toLocaleString()}
                      </p>
                    </div>
                    {!alert.is_resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveAlert.mutate(alert.id)}
                        loading={resolveAlert.isPending}
                      >
                        Resolve
                      </Button>
                    )}
                    {alert.is_resolved && (
                      <span className="text-xs text-green-600 font-medium">✓ Resolved</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-[10px] p-4">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Behavioral Anomaly Detection</p>
            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>Weekly baseline computation from 30-day activity history</li>
              <li>Alerts when: bulk downloads, off-hours access, mass deletes, new IP</li>
              <li>Each user gets personalised thresholds based on their normal usage</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
