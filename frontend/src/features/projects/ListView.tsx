import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTasks, useProjects, type Task } from '@/api/projects'
import { useBulkUpdateTasks } from '@/api/projects_enhanced'
import TaskDetailPanel from './TaskDetailPanel'

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

type SortKey = 'title' | 'status' | 'priority' | 'due_date' | 'assignee_id'

export default function ListView() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: projects } = useProjects()
  const { data: tasks, isLoading } = useTasks(projectId || '')
  const bulkUpdate = useBulkUpdateTasks()

  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [bulkStatus, setBulkStatus] = useState('')

  const project = projects?.find((p) => p.id === projectId)

  const filteredTasks = useMemo(() => {
    let result = tasks || []
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) => t.title.toLowerCase().includes(q) || t.tags?.some((tag) => tag.toLowerCase().includes(q)))
    }
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey] || ''
      const bVal = b[sortKey] || ''
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [tasks, search, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filteredTasks.length) setSelected(new Set())
    else setSelected(new Set(filteredTasks.map((t) => t.id)))
  }

  const handleBulkAction = () => {
    if (!bulkStatus || selected.size === 0 || !projectId) return
    bulkUpdate.mutate(
      { project_id: projectId, task_ids: Array.from(selected), status: bulkStatus },
      { onSuccess: () => { setSelected(new Set()); setBulkStatus('') } }
    )
  }

  const SortIcon = ({ field }: { field: SortKey }) => (
    <span className="ml-1 text-xs">
      {sortKey === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          {project?.name || 'Project'} — List View
        </h1>
      </div>

      {/* Search + Bulk actions */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="text-sm border border-gray-300 rounded-[10px] px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        />
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">{selected.size} selected</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
            >
              <option value="">Move to...</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              onClick={handleBulkAction}
              disabled={!bulkStatus || bulkUpdate.isPending}
              className="text-sm px-3 py-1 bg-[#51459d] text-white rounded-lg disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading tasks...</div>
      ) : (
        <div className="border border-gray-200 rounded-[10px] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size === filteredTasks.length && filteredTasks.length > 0} onChange={selectAll} className="rounded" />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('title')}>
                  Title <SortIcon field="title" />
                </th>
                <th className="px-4 py-3 cursor-pointer w-28" onClick={() => toggleSort('status')}>
                  Status <SortIcon field="status" />
                </th>
                <th className="px-4 py-3 cursor-pointer w-24" onClick={() => toggleSort('priority')}>
                  Priority <SortIcon field="priority" />
                </th>
                <th className="px-4 py-3 cursor-pointer w-32" onClick={() => toggleSort('due_date')}>
                  Due Date <SortIcon field="due_date" />
                </th>
                <th className="px-4 py-3 w-24">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected.has(task.id) ? 'bg-[#51459d]/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggleSelect(task.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700" onClick={() => setSelectedTask(task)}>
                    {task.title}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {statusLabels[task.status] || task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[task.priority] || 'bg-gray-100'}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {task.tags?.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-[#51459d]/10 text-[#51459d] rounded">
                          {tag}
                        </span>
                      ))}
                      {(task.tags?.length || 0) > 2 && (
                        <span className="text-xs text-gray-400">+{task.tags!.length - 2}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {search ? 'No tasks match your search' : 'No tasks in this project'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedTask && projectId && (
        <TaskDetailPanel
          task={selectedTask}
          projectId={projectId}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
