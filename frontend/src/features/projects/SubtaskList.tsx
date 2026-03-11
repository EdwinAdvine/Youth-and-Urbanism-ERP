import { useState } from 'react'
import { useSubtasks, useCreateSubtask, type Subtask } from '@/api/projects_enhanced'

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

interface SubtaskListProps {
  projectId: string
  taskId: string
  onTaskClick?: (subtask: Subtask) => void
}

export default function SubtaskList({ projectId, taskId, onTaskClick }: SubtaskListProps) {
  const { data, isLoading } = useSubtasks(projectId, taskId)
  const createSubtask = useCreateSubtask()
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const handleAdd = () => {
    if (!newTitle.trim()) return
    createSubtask.mutate(
      { project_id: projectId, task_id: taskId, title: newTitle.trim() },
      {
        onSuccess: () => {
          setNewTitle('')
          setShowAdd(false)
        },
      }
    )
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-2">Loading subtasks...</div>
  }

  const subtasks = data?.subtasks || []
  const completed = subtasks.filter((s) => s.status === 'done').length

  return (
    <div className="space-y-2">
      {subtasks.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{completed}/{subtasks.length} completed</span>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6fd943] rounded-full transition-all"
              style={{ width: `${subtasks.length ? (completed / subtasks.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
            onClick={() => onTaskClick?.(subtask)}
          >
            <div
              className={`w-2 h-2 rounded-full ${subtask.status === 'done' ? 'bg-[#6fd943]' : subtask.status === 'in_progress' ? 'bg-[#3ec9d6]' : 'bg-gray-300'}`}
            />
            <span className={`text-sm flex-1 ${subtask.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {subtask.title}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColors[subtask.priority] || 'bg-gray-100'}`}>
              {subtask.priority}
            </span>
            <span className="text-xs text-gray-400">
              {statusLabels[subtask.status] || subtask.status}
            </span>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Subtask title..."
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={createSubtask.isPending}
            className="text-sm px-3 py-1.5 bg-[#51459d] text-white rounded-lg hover:bg-[#51459d]/90 disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewTitle('') }}
            className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm text-[#51459d] hover:text-[#51459d]/80 font-medium"
        >
          + Add subtask
        </button>
      )}
    </div>
  )
}
