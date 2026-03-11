import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProjects } from '@/api/projects'
import {
  useSprints,
  useBacklog,
  useCreateSprint,
  useUpdateSprint,
  useAssignTaskToSprint,
  type Sprint,
} from '@/api/projects_enhanced'

const sprintStatusColors: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-600',
  active: 'bg-[#3ec9d6]/10 text-[#3ec9d6]',
  completed: 'bg-[#6fd943]/10 text-[#6fd943]',
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

interface BacklogTask {
  id: string
  title: string
  status: string
  priority: string
  assignee_id: string | null
  due_date: string | null
  tags: string[]
  order: number
}

export default function BacklogView() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  const { data: sprints, isLoading: sprintsLoading } = useSprints(projectId || '')
  const { data: backlogData, isLoading: backlogLoading } = useBacklog(projectId || '')
  const createSprint = useCreateSprint()
  const updateSprint = useUpdateSprint()
  const assignTask = useAssignTaskToSprint()

  const [showNewSprint, setShowNewSprint] = useState(false)
  const [newSprintName, setNewSprintName] = useState('')
  const [newSprintGoal, setNewSprintGoal] = useState('')

  const handleCreateSprint = () => {
    if (!newSprintName.trim() || !projectId) return
    createSprint.mutate(
      { project_id: projectId, name: newSprintName.trim(), goal: newSprintGoal.trim() || undefined },
      { onSuccess: () => { setNewSprintName(''); setNewSprintGoal(''); setShowNewSprint(false) } }
    )
  }

  const handleMoveToSprint = (taskId: string, sprintId: string | null) => {
    if (!projectId) return
    assignTask.mutate({ project_id: projectId, task_id: taskId, sprint_id: sprintId })
  }

  const handleStartSprint = (sprint: Sprint) => {
    if (!projectId) return
    updateSprint.mutate({ project_id: projectId, sprint_id: sprint.id, status: 'active' })
  }

  const handleCompleteSprint = (sprint: Sprint) => {
    if (!projectId) return
    updateSprint.mutate({ project_id: projectId, sprint_id: sprint.id, status: 'completed' })
  }

  const backlogTasks = (backlogData?.tasks || []) as BacklogTask[]
  const isLoading = sprintsLoading || backlogLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          {project?.name || 'Project'} — Backlog
        </h1>
        <button
          onClick={() => setShowNewSprint(true)}
          className="text-sm px-4 py-2 bg-[#51459d] text-white rounded-[10px] hover:bg-[#51459d]/90"
        >
          + New Sprint
        </button>
      </div>

      {showNewSprint && (
        <div className="bg-gray-50 border border-gray-200 rounded-[10px] p-4 space-y-3">
          <input
            type="text"
            value={newSprintName}
            onChange={(e) => setNewSprintName(e.target.value)}
            placeholder="Sprint name..."
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            autoFocus
          />
          <input
            type="text"
            value={newSprintGoal}
            onChange={(e) => setNewSprintGoal(e.target.value)}
            placeholder="Sprint goal (optional)..."
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
          />
          <div className="flex gap-2">
            <button onClick={handleCreateSprint} disabled={createSprint.isPending} className="text-sm px-4 py-2 bg-[#51459d] text-white rounded-lg disabled:opacity-50">
              Create Sprint
            </button>
            <button onClick={() => setShowNewSprint(false)} className="text-sm px-4 py-2 text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Active/Planning Sprints */}
          {sprints?.filter((s) => s.status !== 'completed').map((sprint) => (
            <div key={sprint.id} className="border border-gray-200 rounded-[10px] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">{sprint.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sprintStatusColors[sprint.status]}`}>
                    {sprint.status}
                  </span>
                  <span className="text-xs text-gray-400">{sprint.task_count} tasks</span>
                </div>
                <div className="flex items-center gap-2">
                  {sprint.status === 'planning' && (
                    <button
                      onClick={() => handleStartSprint(sprint)}
                      className="text-xs px-3 py-1 bg-[#3ec9d6] text-white rounded-lg hover:bg-[#3ec9d6]/90"
                    >
                      Start Sprint
                    </button>
                  )}
                  {sprint.status === 'active' && (
                    <button
                      onClick={() => handleCompleteSprint(sprint)}
                      className="text-xs px-3 py-1 bg-[#6fd943] text-white rounded-lg hover:bg-[#6fd943]/90"
                    >
                      Complete Sprint
                    </button>
                  )}
                </div>
              </div>
              {sprint.goal && (
                <div className="px-4 py-2 text-xs text-gray-500 bg-white border-b border-gray-100">
                  Goal: {sprint.goal}
                </div>
              )}
              <div className="px-4 py-2 text-xs text-gray-400">
                Drag tasks from backlog to add them to this sprint
              </div>
            </div>
          ))}

          {/* Backlog */}
          <div className="border border-gray-200 rounded-[10px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-700">Backlog</h3>
                <span className="text-xs text-gray-400">{backlogTasks.length} tasks</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {backlogTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700">{task.title}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                  {task.due_date && (
                    <span className="text-xs text-gray-400">
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  {sprints && sprints.filter((s) => s.status !== 'completed').length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => handleMoveToSprint(task.id, e.target.value || null)}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                    >
                      <option value="">Move to sprint...</option>
                      {sprints.filter((s) => s.status !== 'completed').map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              {backlogTasks.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  No tasks in backlog. Create tasks to add them here.
                </div>
              )}
            </div>
          </div>

          {/* Completed Sprints (collapsed) */}
          {sprints?.filter((s) => s.status === 'completed').length ? (
            <details className="border border-gray-200 rounded-[10px] overflow-hidden">
              <summary className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600 cursor-pointer">
                Completed Sprints ({sprints.filter((s) => s.status === 'completed').length})
              </summary>
              <div className="divide-y divide-gray-100">
                {sprints.filter((s) => s.status === 'completed').map((sprint) => (
                  <div key={sprint.id} className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-gray-500">{sprint.name}</span>
                    <span className="text-xs text-gray-400">{sprint.task_count} tasks</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  )
}
