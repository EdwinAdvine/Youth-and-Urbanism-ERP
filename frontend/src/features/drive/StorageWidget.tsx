import { Card, Spinner } from '../../components/ui'
import { useStorageUsage } from '../../api/drive_ext'

interface Props {
  className?: string
}

const TYPE_COLORS: Record<string, string> = {
  image: '#3b82f6',
  video: '#8b5cf6',
  pdf: '#ef4444',
  docx: '#2563eb',
  xlsx: '#16a34a',
  pptx: '#ea580c',
  zip: '#eab308',
  other: '#94a3b8',
}

export default function StorageWidget({ className }: Props) {
  const { data: usage, isLoading } = useStorageUsage()

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      </Card>
    )
  }

  if (!usage) {
    return (
      <Card className={className}>
        <p className="text-sm text-gray-400 text-center py-4">Storage data unavailable</p>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Storage</h3>

      {/* Usage bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-500">
            {usage.used_formatted} of {usage.total_formatted} used
          </span>
          <span className="text-sm font-semibold text-gray-700">{usage.percentage}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${
              usage.percentage > 90 ? 'bg-red-500' : usage.percentage > 70 ? 'bg-orange-500' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(usage.percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Breakdown by type */}
      {usage.by_type.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase">By File Type</h4>
          {usage.by_type.map((t) => {
            const color = TYPE_COLORS[t.type] ?? TYPE_COLORS.other
            const pct = usage.used_bytes > 0 ? Math.round((t.size / usage.used_bytes) * 100) : 0
            return (
              <div key={t.type} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600 capitalize">{t.type}</span>
                    <span className="text-xs text-gray-400">{t.count} files</span>
                  </div>
                  <div className="w-full bg-gray-50 rounded-full h-1 mt-1">
                    <div className="rounded-full h-1" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-14 text-right">{formatBytes(t.size)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}
