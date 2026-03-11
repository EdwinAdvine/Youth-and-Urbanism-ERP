import { Card, Spinner } from '../../components/ui'
import { useRecentDocs, type RecentDoc } from '../../api/docs_ext'

const TYPE_COLORS: Record<string, string> = {
  docx: 'text-blue-600 bg-blue-50',
  xlsx: 'text-green-600 bg-green-50',
  pptx: 'text-orange-600 bg-orange-50',
  pdf: 'text-red-600 bg-red-50',
}

const TYPE_LABELS: Record<string, string> = {
  docx: 'W',
  xlsx: 'X',
  pptx: 'P',
  pdf: 'PDF',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface Props {
  limit?: number
  className?: string
}

export default function RecentDocsWidget({ limit = 8, className }: Props) {
  const { data: docs, isLoading } = useRecentDocs(limit)

  return (
    <Card className={className}>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Documents</h3>
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      ) : !docs || docs.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No recent documents</p>
      ) : (
        <div className="space-y-1">
          {docs.map((doc) => {
            const ext = doc.extension.replace('.', '').toLowerCase()
            const color = TYPE_COLORS[ext] ?? 'text-gray-600 bg-gray-50'
            const label = TYPE_LABELS[ext] ?? ext.toUpperCase().slice(0, 3)
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-xs font-bold shrink-0`}>
                  {label}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-400">{timeAgo(doc.last_accessed || doc.updated_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
