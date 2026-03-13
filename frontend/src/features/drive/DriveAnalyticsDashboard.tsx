import { useState } from 'react'
import { Card, Spinner } from '../../components/ui'
import {
  useStorageTrends,
  useUserActivityAnalytics,
  useFileLifecycleAnalytics,
  useSharingAnalytics,
} from '../../api/drive_phase2'
import { formatFileSize } from '../../api/drive'

const ACTION_LABELS: Record<string, string> = {
  upload: 'Uploads',
  download: 'Downloads',
  share: 'Shares',
  view: 'Views',
  delete: 'Deletes',
  edit: 'Edits',
}

const ACTION_COLORS: Record<string, string> = {
  upload: 'bg-[#51459d]',
  download: 'bg-[#3ec9d6]',
  share: 'bg-[#6fd943]',
  view: 'bg-[#ffa21d]',
  delete: 'bg-[#ff3a6e]',
  edit: 'bg-purple-500',
}

export default function DriveAnalyticsDashboard() {
  const [days, setDays] = useState(30)

  const { data: trends, isLoading: trendsLoading } = useStorageTrends(days)
  const { data: activity, isLoading: activityLoading } = useUserActivityAnalytics(days)
  const { data: lifecycle, isLoading: lifecycleLoading } = useFileLifecycleAnalytics()
  const { data: sharing, isLoading: sharingLoading } = useSharingAnalytics(days)

  const totalActivity = Object.values(activity?.activity ?? {}).reduce((a, b) => a + b, 0)
  const maxActivity = Math.max(...Object.values(activity?.activity ?? {}), 1)

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Drive Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Usage insights for your files and storage</p>
        </div>
        <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-[8px] text-xs overflow-hidden">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 transition-colors ${days === d ? 'bg-[#51459d] text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Sharing overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Shares', value: sharing?.total_shares ?? '—', color: 'text-[#51459d]' },
          { label: 'Active Links', value: sharing?.active_links ?? '—', color: 'text-[#3ec9d6]' },
          { label: 'Downloads', value: sharing?.total_downloads ?? '—', color: 'text-[#6fd943]' },
          { label: 'External Shares', value: sharing?.external_shares ?? '—', color: 'text-[#ffa21d]' },
        ].map((stat) => (
          <Card key={stat.label}>
            {sharingLoading ? (
              <div className="flex justify-center py-2"><Spinner /></div>
            ) : (
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Activity breakdown */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Activity Breakdown</h3>
          {activityLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Action</span>
                <span>Count</span>
              </div>
              {Object.entries(activity?.activity ?? {})
                .sort(([, a], [, b]) => b - a)
                .map(([action, count]) => (
                  <div key={action} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{ACTION_LABELS[action] || action}</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ACTION_COLORS[action] || 'bg-gray-400'}`}
                        style={{ width: `${(count / maxActivity) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              {totalActivity > 0 && (
                <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                  {totalActivity.toLocaleString()} total operations in the last {days} days
                </p>
              )}
            </div>
          )}
        </Card>

        {/* File lifecycle */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">File Lifecycle</h3>
          {lifecycleLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : lifecycle ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-[8px] p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{lifecycle.total_files.toLocaleString()}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Total Files</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-[8px] p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{lifecycle.stale_files_90d.toLocaleString()}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Stale (90d+)</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Storage by Type</p>
                <div className="space-y-2">
                  {lifecycle.by_type.slice(0, 5).map((t) => (
                    <div key={t.content_type} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400 truncate max-w-[140px]">
                        {t.content_type.split('/').pop() || t.content_type}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">{t.count} files</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300 w-16 text-right">
                          {formatFileSize(t.total_size)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Storage trends */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Storage Growth</h3>
        {trendsLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !trends?.trends.length ? (
          <p className="text-xs text-gray-400 text-center py-8">
            Storage snapshots are captured daily. Check back after the first snapshot runs.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-1 h-20">
              {trends.trends.slice(-30).map((point, i) => {
                const maxSize = Math.max(...trends.trends.map(t => t.total_size), 1)
                const height = Math.max((point.total_size / maxSize) * 100, 4)
                return (
                  <div
                    key={i}
                    title={`${new Date(point.date).toLocaleDateString()} — ${formatFileSize(point.total_size)}`}
                    className="flex-1 bg-[#51459d] rounded-t hover:bg-[#3d3480] transition-colors cursor-default"
                    style={{ height: `${height}%` }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{new Date(trends.trends[0]?.date).toLocaleDateString()}</span>
              <span>{new Date(trends.trends[trends.trends.length - 1]?.date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-2">
              <span>Earliest: {formatFileSize(trends.trends[0]?.total_size ?? 0)}</span>
              <span>Latest: {formatFileSize(trends.trends[trends.trends.length - 1]?.total_size ?? 0)}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
