import { useTaskActivity, type ActivityItem } from '@/api/projects_enhanced'

interface TaskActivityFeedProps {
  projectId: string
  taskId: string
}

const actionLabels: Record<string, string> = {
  created: 'created this task',
  updated: 'updated this task',
  status_changed: 'changed status',
  assigned: 'changed assignee',
  commented: 'commented',
  checklist_toggled: 'updated checklist',
  deleted: 'deleted',
}

const actionColors: Record<string, string> = {
  created: 'bg-[#6fd943]',
  updated: 'bg-[#3ec9d6]',
  status_changed: 'bg-[#51459d]',
  assigned: 'bg-[#ffa21d]',
  commented: 'bg-blue-400',
  checklist_toggled: 'bg-gray-400',
}

function ActivityItemRow({ item }: { item: ActivityItem }) {
  const isComment = item.type === 'comment'

  return (
    <div className="flex gap-3 py-2">
      <div className="flex flex-col items-center">
        <div className={`w-2 h-2 rounded-full mt-2 ${isComment ? 'bg-blue-400' : actionColors[item.action || ''] || 'bg-gray-300'}`} />
        <div className="w-px flex-1 bg-gray-200" />
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">
            {item.user_id ? `${item.user_id.slice(0, 8)}...` : 'System'}
          </span>
          {isComment ? (
            <span className="text-xs text-gray-400">commented</span>
          ) : (
            <span className="text-xs text-gray-400">
              {actionLabels[item.action || ''] || item.action}
            </span>
          )}
          <span className="text-xs text-gray-300 ml-auto">
            {new Date(item.created_at).toLocaleString()}
          </span>
        </div>

        {isComment && item.content && (
          <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
            {item.content}
          </p>
        )}

        {!isComment && item.changes && (
          <div className="mt-1 space-y-0.5">
            {Object.entries(item.changes).map(([field, change]) => (
              <div key={field} className="text-xs text-gray-500">
                <span className="font-medium">{field}</span>:{' '}
                {change.old && <span className="line-through text-gray-400">{change.old}</span>}
                {change.old && ' → '}
                <span className="text-gray-700">{change.new}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TaskActivityFeed({ projectId, taskId }: TaskActivityFeedProps) {
  const { data, isLoading } = useTaskActivity(projectId, taskId)

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-4 text-center">Loading activity...</div>
  }

  const activities = data?.activities || []

  if (activities.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
  }

  return (
    <div className="space-y-0">
      {activities.map((item) => (
        <ActivityItemRow key={item.id} item={item} />
      ))}
    </div>
  )
}
