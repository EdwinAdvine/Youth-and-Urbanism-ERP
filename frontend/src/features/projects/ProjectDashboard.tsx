import { useState } from 'react'
import { Card, Spinner, Select, Badge } from '../../components/ui'
import { useProjects } from '../../api/projects'
import { useProjectReport } from '../../api/projects_ext'

export default function ProjectDashboard() {
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const [selectedProject, setSelectedProject] = useState('')
  const projectId = selectedProject || (projects?.[0]?.id ?? '')

  const { data: report, isLoading } = useProjectReport(projectId)

  if (loadingProjects) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Project Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of project progress and team performance</p>
        </div>
        <div className="w-64">
          <Select
            value={projectId}
            onChange={(e) => setSelectedProject(e.target.value)}
            options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Spinner /></div>
      ) : !report ? (
        <Card><div className="text-center py-12 text-gray-400">Select a project to view its dashboard</div></Card>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Tasks" value={report.total_tasks} icon={
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            } />
            <MetricCard label="Completed" value={report.completed_tasks} icon={
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            } />
            <MetricCard label="Hours Logged" value={report.total_hours_logged} suffix="hrs" icon={
              <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            } />
            <MetricCard label="Milestone Progress" value={report.milestone_progress} suffix="%" icon={
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            } />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tasks by Status */}
            <Card>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Tasks by Status</h2>
              {Object.entries(report.task_by_status).length === 0 ? (
                <p className="text-sm text-gray-400">No task data</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(report.task_by_status).map(([status, count]) => {
                    const pct = report.total_tasks > 0 ? Math.round((count / report.total_tasks) * 100) : 0
                    const colors: Record<string, string> = {
                      todo: 'bg-gray-400',
                      in_progress: 'bg-cyan-500',
                      in_review: 'bg-orange-400',
                      done: 'bg-green-500',
                    }
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{status.replace(/_/g, ' ')}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-2">
                          <div className={`${colors[status] ?? 'bg-primary'} rounded-full h-2 transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Tasks by Priority */}
            <Card>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Tasks by Priority</h2>
              {Object.entries(report.task_by_priority).length === 0 ? (
                <p className="text-sm text-gray-400">No task data</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(report.task_by_priority).map(([priority, count]) => {
                    const pct = report.total_tasks > 0 ? Math.round((count / report.total_tasks) * 100) : 0
                    const badgeVariant: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
                      low: 'default',
                      medium: 'success',
                      high: 'warning',
                      urgent: 'danger',
                    }
                    return (
                      <div key={priority} className="flex items-center gap-3">
                        <Badge variant={badgeVariant[priority] ?? 'default'} className="w-16 justify-center capitalize">
                          {priority}
                        </Badge>
                        <div className="flex-1">
                          <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-2">
                            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Team Workload */}
            <Card className="md:col-span-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Team Workload</h2>
              {report.team_workload.length === 0 ? (
                <p className="text-sm text-gray-400">No assigned tasks</p>
              ) : (
                <div className="space-y-4">
                  {report.team_workload.map((w) => (
                    <div key={w.user_id} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                        {w.user_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{w.user_name}</span>
                          <span className="text-xs text-gray-500">
                            {w.assigned_count} tasks | {w.completed_count} done | {w.hours_logged}h
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <div
                            className="bg-green-500 rounded-l h-2 transition-all"
                            style={{ width: `${w.assigned_count > 0 ? (w.completed_count / w.assigned_count) * 100 : 0}%` }}
                          />
                          <div
                            className="bg-gray-200 rounded-r h-2 transition-all"
                            style={{ width: `${w.assigned_count > 0 ? ((w.assigned_count - w.completed_count) / w.assigned_count) * 100 : 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Overdue alert */}
          {report.overdue_tasks > 0 && (
            <Card className="border-red-200 bg-red-50">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-700">{report.overdue_tasks} overdue task{report.overdue_tasks !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-red-600">Some tasks are past their due date and need attention.</p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value, suffix, icon }: { label: string; value: number; suffix?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {value}{suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
          </p>
        </div>
        <div className="w-10 h-10 rounded-[10px] bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </Card>
  )
}
