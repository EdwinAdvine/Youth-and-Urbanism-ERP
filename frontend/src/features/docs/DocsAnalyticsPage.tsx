import { useDocAnalyticsOverview, useDocAnalyticsUsage, useDocAnalyticsTopDocs, useDocAnalyticsStorage, useDocAnalyticsCollab } from '../../api/docs'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 p-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DocsAnalyticsPage() {
  const { data: overview, isLoading } = useDocAnalyticsOverview()
  const { data: usageData } = useDocAnalyticsUsage()
  const { data: topDocs } = useDocAnalyticsTopDocs()
  const { data: storageData } = useDocAnalyticsStorage()
  const { data: collabData } = useDocAnalyticsCollab()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-400">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-sm">Loading analytics...</span>
        </div>
      </div>
    )
  }

  const usage = (usageData?.usage || []) as { content_type: string; count: number; total_size_bytes: number }[]
  const top = (topDocs?.documents || []) as { file_id: string; name: string; access_count: number; last_accessed: string }[]
  const storage = (storageData?.trend || []) as { date: string; new_files: number; new_bytes: number }[]
  const collab = collabData as { shared_documents?: number; comments_last_7d?: number; unique_commenters_7d?: number } || {}

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Document Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Usage, storage, and collaboration insights</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Documents" value={overview?.total_documents ?? 0} />
        <StatCard label="Storage Used" value={`${overview?.total_storage_mb ?? 0} MB`} />
        <StatCard label="Active Docs (7d)" value={overview?.active_documents_7d ?? 0} />
        <StatCard label="Active Users (7d)" value={overview?.active_users_7d ?? 0} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Shared Documents" value={collab.shared_documents ?? 0} />
        <StatCard label="Comments (7d)" value={collab.comments_last_7d ?? 0} />
        <StatCard label="Commenters (7d)" value={collab.unique_commenters_7d ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Documents by Type</h3>
          <div className="space-y-2">
            {usage.map((item, i) => {
              const maxCount = Math.max(...usage.map((u) => u.count), 1)
              const pct = (item.count / maxCount) * 100
              const ext = item.content_type.split('/').pop() || item.content_type
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 w-28 truncate">{ext}</span>
                  <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-[4px] overflow-hidden">
                    <div className="h-full bg-[#51459d] rounded-[4px]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{item.count}</span>
                </div>
              )
            })}
            {usage.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No data</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Most Accessed Documents</h3>
          <div className="space-y-2">
            {top.map((doc, i) => (
              <div key={doc.file_id} className="flex items-center gap-3 p-2 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-900">
                <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{doc.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {doc.access_count} accesses
                    {doc.last_accessed ? ` | Last: ${new Date(doc.last_accessed).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
            ))}
            {top.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No data</p>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Storage Trend (30 days)</h3>
        <div className="flex items-end gap-1 h-32">
          {storage.length > 0 ? (
            (() => {
              const maxBytes = Math.max(...storage.map((s) => s.new_bytes), 1)
              return storage.map((s, i) => {
                const pct = (s.new_bytes / maxBytes) * 100
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div
                      className="w-full bg-[#3ec9d6] rounded-t-[3px] min-h-[2px] transition-all hover:bg-[#51459d]"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <div className="absolute -top-8 bg-gray-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                      {s.date}: {s.new_files} files
                    </div>
                  </div>
                )
              })
            })()
          ) : (
            <p className="text-xs text-gray-400 text-center w-full py-8">No storage data</p>
          )}
        </div>
      </div>
    </div>
  )
}
