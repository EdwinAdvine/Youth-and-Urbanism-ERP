import { useParams, useNavigate } from 'react-router-dom'
import { Button, Card, Spinner, Badge } from '../../components/ui'
import { useProject, useTimeReport } from '../../api/projects'

const STATUS_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  todo: 'default',
  in_progress: 'info',
  in_review: 'warning',
  done: 'success',
}

export default function TimeLogReport() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projectId = id ?? ''

  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: report, isLoading: reportLoading } = useTimeReport(projectId)

  if (projectLoading || reportLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!project || !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-500">Project not found</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/projects/${projectId}`)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name} - Time Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Total: <span className="font-semibold text-primary">{report.grand_total_hours.toFixed(1)}h</span> logged
          </p>
        </div>
      </div>

      {/* Grand total card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium uppercase">Total Hours</p>
            <p className="text-3xl font-bold text-primary mt-1">{report.grand_total_hours.toFixed(1)}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium uppercase">Tasks Tracked</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{report.by_task.filter(t => t.total_hours > 0).length}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium uppercase">Contributors</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{report.by_user.length}</p>
          </div>
        </Card>
      </div>

      {/* By Task */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Hours by Task</h2>
        </div>
        {report.by_task.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No time logged yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {report.by_task.map((row) => {
              const pct = report.grand_total_hours > 0
                ? Math.round((row.total_hours / report.grand_total_hours) * 100)
                : 0
              return (
                <div key={row.task_id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{row.task_title}</span>
                      <Badge variant={STATUS_BADGE[row.task_status] ?? 'default'}>{row.task_status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{row.log_count} entries</span>
                      <span className="text-sm font-semibold text-gray-900">{row.total_hours.toFixed(1)}h</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* By User */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Hours by Team Member</h2>
        </div>
        {report.by_user.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No time logged yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {report.by_user.map((row) => {
              const pct = report.grand_total_hours > 0
                ? Math.round((row.total_hours / report.grand_total_hours) * 100)
                : 0
              return (
                <div key={row.user_id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">User {row.user_id.slice(0, 8)}...</span>
                    <span className="text-sm font-semibold text-gray-900">{row.total_hours.toFixed(1)}h</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-info rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
