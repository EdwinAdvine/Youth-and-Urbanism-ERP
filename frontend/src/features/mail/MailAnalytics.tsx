/**
 * Mail Analytics Dashboard — personal email insights, response times, top contacts, heatmap.
 */
import { useMailAnalytics, useTopContacts, useHourlyHeatmap } from '../../api/mail'

interface MailAnalyticsProps {
  onClose: () => void
}

export default function MailAnalytics({ onClose }: MailAnalyticsProps) {
  const { data: overview } = useMailAnalytics(30)
  const { data: topContacts } = useTopContacts()
  const { data: heatmap } = useHourlyHeatmap()

  const maxHeatmapCount = Math.max(...(heatmap ?? []).map((h) => h.count), 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[640px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-semibold">Mail Analytics</h3>
            <p className="text-xs text-gray-400">Last 30 days</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Overview cards */}
          {overview && (
            <div className="grid grid-cols-4 gap-3">
              <StatCard label="Received" value={overview.received_count} color="#51459d" />
              <StatCard label="Sent" value={overview.sent_count} color="#3ec9d6" />
              <StatCard label="Unread" value={overview.unread_count} color="#ffa21d" />
              <StatCard
                label="Avg Reply"
                value={
                  overview.avg_response_time_minutes != null
                    ? `${Math.round(overview.avg_response_time_minutes)}m`
                    : '--'
                }
                color="#6fd943"
              />
            </div>
          )}

          {/* Hourly Heatmap */}
          {heatmap && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Activity by Hour</h4>
              <div className="flex gap-0.5">
                {heatmap.map((h) => {
                  const intensity = h.count / maxHeatmapCount
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className="w-full h-8 rounded-sm transition"
                        style={{
                          backgroundColor: `rgba(81, 69, 157, ${Math.max(0.05, intensity)})`,
                        }}
                        title={`${h.hour}:00 — ${h.count} emails`}
                      />
                      <span className="text-[8px] text-gray-400">
                        {h.hour % 6 === 0 ? `${h.hour}` : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-[8px] text-gray-400 mt-1">
                <span>12am</span>
                <span>6am</span>
                <span>12pm</span>
                <span>6pm</span>
                <span>12am</span>
              </div>
            </div>
          )}

          {/* Top Contacts */}
          {topContacts && topContacts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Top Contacts</h4>
              <div className="space-y-1.5">
                {topContacts.map((c, i) => {
                  const maxCount = topContacts[0].count
                  const barWidth = (c.count / maxCount) * 100
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#51459d]/10 flex items-center justify-center text-[10px] font-bold text-[#51459d]">
                        {(c.name || c.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                            {c.name || c.email}
                          </p>
                          <span className="text-xs text-gray-400">{c.count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-0.5">
                          <div
                            className="h-full bg-[#51459d] rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-700">
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-gray-400 uppercase mt-0.5">{label}</p>
    </div>
  )
}
