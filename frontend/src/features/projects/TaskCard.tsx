import React from 'react'
import { cn } from '../../components/ui'
import type { Task } from '../../api/projects'

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'Low', color: 'bg-green-100 text-green-700' },
}

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, fromStatus: task.status }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const initials = task.assignee_name
    ? task.assignee_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick(task)}
      className={cn(
        'bg-white rounded-[10px] border border-gray-100 p-3 cursor-pointer',
        'shadow-sm hover:shadow-md transition-shadow',
        'active:opacity-80 select-none'
      )}
    >
      {/* Title */}
      <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</p>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-[10px] text-gray-400">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Bottom row: priority, assignee, due date */}
      <div className="flex items-center justify-between mt-3 gap-2">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', priority.color)}>
          {priority.label}
        </span>

        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={cn('text-[10px] font-medium', isOverdue ? 'text-red-500' : 'text-gray-400')}>
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}

          {initials && (
            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
              {initials}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
