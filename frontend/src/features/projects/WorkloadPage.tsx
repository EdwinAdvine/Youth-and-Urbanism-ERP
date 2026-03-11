import { useState, useMemo } from 'react'
import { Card, Spinner, Select, Badge } from '../../components/ui'
import { useProjects } from '../../api/projects'
import { useProjectReport } from '../../api/projects_ext'

export default function WorkloadPage() {
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const [selectedProject, setSelectedProject] = useState('')
  const projectId = selectedProject || (projects?.[0]?.id ?? '')

  const { data: report, isLoading } = useProjectReport(projectId)
  const workload = report?.team_workload ?? []

  const maxAssigned = useMemo(() => Math.max(...workload.map((w) => w.assigned_count), 1), [workload])

  if (loadingProjects) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Team Workload</h1>
          <p className="text-sm text-gray-500 mt-1">View task distribution across team members</p>
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
      ) : workload.length === 0 ? (
        <Card>
          <div className="text-center py-16 text-gray-400">
            No task assignments found. Assign tasks to team members to see workload distribution.
          </div>
        </Card>
      ) : (
        <>
          {/* Bar Chart */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-6">Task Distribution</h2>
            <div className="space-y-4">
              {workload.map((w) => {
                const assignedPct = (w.assigned_count / maxAssigned) * 100
                const completedPct = w.assigned_count > 0 ? (w.completed_count / w.assigned_count) * 100 : 0
                return (
                  <div key={w.user_id} className="flex items-center gap-4">
                    <div className="w-32 shrink-0 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {w.user_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{w.user_name}</span>
                    </div>
                    <div className="flex-1">
                      <div className="relative h-8 bg-gray-100 dark:bg-gray-900 rounded-[10px] overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-primary/20 rounded-[10px] transition-all"
                          style={{ width: `${assignedPct}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 bg-primary rounded-[10px] transition-all"
                          style={{ width: `${(w.completed_count / maxAssigned) * 100}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {w.completed_count} / {w.assigned_count} tasks
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{w.hours_logged}h</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Summary Table */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Detailed Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Team Member</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Assigned</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Completed</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Completion Rate</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Hours Logged</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.map((w) => {
                    const rate = w.assigned_count > 0 ? Math.round((w.completed_count / w.assigned_count) * 100) : 0
                    const statusVariant = rate >= 75 ? 'success' : rate >= 50 ? 'warning' : 'danger'
                    const statusLabel = rate >= 75 ? 'On Track' : rate >= 50 ? 'At Risk' : 'Behind'
                    return (
                      <tr key={w.user_id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {w.user_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{w.user_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{w.assigned_count}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{w.completed_count}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 dark:bg-gray-900 rounded-full h-1.5">
                              <div className="bg-primary rounded-full h-1.5" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-gray-600 dark:text-gray-400">{rate}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{w.hours_logged}h</td>
                        <td className="py-3 px-4">
                          <Badge variant={statusVariant}>{statusLabel}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
