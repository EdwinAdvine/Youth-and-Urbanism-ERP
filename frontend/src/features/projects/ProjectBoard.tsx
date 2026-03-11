import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useProject,
  useBoard,
  useMilestones,
  useCreateTask,
  useBatchReorder,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type BoardView,
  type ReorderItem,
} from '../../api/projects'
import TaskCard from './TaskCard'
import TaskDetail from './TaskDetail'

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo', label: 'To Do', color: 'bg-gray-400' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { key: 'in_review', label: 'In Review', color: 'bg-yellow-500' },
  { key: 'done', label: 'Done', color: 'bg-green-500' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function ProjectBoard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projectId = id ?? ''

  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: board, isLoading: boardLoading } = useBoard(projectId)
  const { data: milestones } = useMilestones(projectId)

  const createTask = useCreateTask()
  const batchReorder = useBatchReorder()

  // Task detail modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Add task modal
  const [addTaskColumn, setAddTaskColumn] = useState<TaskStatus | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium')
  const [newDueDate, setNewDueDate] = useState('')

  // Drag state for visual feedback
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)

  if (projectLoading || boardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-500">Project not found</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    )
  }

  const boardData: BoardView = board ?? { todo: [], in_progress: [], in_review: [], done: [] }

  // Milestones progress
  const totalMilestones = milestones?.length ?? 0
  const completedMilestones = milestones?.filter((m) => m.is_completed).length ?? 0
  const milestonePercent = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0

  function handleTaskClick(task: Task) {
    setSelectedTask(task)
    setDetailOpen(true)
  }

  function handleDragOver(e: React.DragEvent, column: TaskStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(column)
  }

  function handleDragLeave() {
    setDragOverColumn(null)
  }

  async function handleDrop(e: React.DragEvent, targetStatus: TaskStatus) {
    e.preventDefault()
    setDragOverColumn(null)

    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return
      const { taskId, fromStatus } = JSON.parse(raw)
      if (fromStatus === targetStatus) return

      // Build reorder payload: move task to target column, append at end
      const targetTasks = [...(boardData[targetStatus] ?? [])]
      const reorderItems: ReorderItem[] = targetTasks.map((t, i) => ({
        task_id: t.id,
        status: targetStatus,
        order: i,
      }))
      // Add the moved task at the end
      reorderItems.push({ task_id: taskId, status: targetStatus, order: targetTasks.length })

      await batchReorder.mutateAsync({ project_id: projectId, tasks: reorderItems })
    } catch {
      toast('error', 'Failed to move task')
    }
  }

  function openAddTask(column: TaskStatus) {
    setAddTaskColumn(column)
    setNewTitle('')
    setNewDescription('')
    setNewPriority('medium')
    setNewDueDate('')
  }

  async function handleCreateTask() {
    if (!newTitle.trim()) {
      toast('warning', 'Title is required')
      return
    }
    try {
      await createTask.mutateAsync({
        project_id: projectId,
        title: newTitle.trim(),
        description: newDescription,
        status: addTaskColumn!,
        priority: newPriority,
        due_date: newDueDate || null,
      })
      toast('success', 'Task created')
      setAddTaskColumn(null)
    } catch {
      toast('error', 'Failed to create task')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Project Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate('/projects')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {project.color && (
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
          )}
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          <Badge variant={project.status === 'active' ? 'success' : 'default'}>{project.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/time-report`)} className="ml-auto">
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Time Report
          </Button>
        </div>

        {project.description && (
          <p className="text-sm text-gray-500 ml-8 mb-2">{project.description}</p>
        )}

        {/* Milestones progress */}
        {totalMilestones > 0 && (
          <div className="ml-8 flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500">
              Milestones: {completedMilestones}/{totalMilestones}
            </span>
            <div className="flex-1 max-w-xs h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${milestonePercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500">{milestonePercent}%</span>
          </div>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((col) => {
            const tasks = boardData[col.key] ?? []
            return (
              <div
                key={col.key}
                className={cn(
                  'flex flex-col w-72 rounded-[10px] bg-gray-50 shrink-0',
                  dragOverColumn === col.key && 'ring-2 ring-primary/40'
                )}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', col.color)} />
                    <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                    <span className="text-xs font-medium text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                      {tasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => openAddTask(col.key)}
                    className="text-gray-400 hover:text-primary transition-colors"
                    title="Add task"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onClick={handleTaskClick} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Task Detail Modal */}
      <TaskDetail
        task={selectedTask}
        projectId={projectId}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setSelectedTask(null)
        }}
      />

      {/* Add Task Modal */}
      <Modal
        open={addTaskColumn !== null}
        onClose={() => setAddTaskColumn(null)}
        title={`Add Task — ${COLUMNS.find((c) => c.key === addTaskColumn)?.label ?? ''}`}
      >
        <div className="space-y-4">
          <Input label="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title" autoFocus />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Priority" options={PRIORITY_OPTIONS} value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority)} />
            <Input label="Due Date" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setAddTaskColumn(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateTask} loading={createTask.isPending}>
              Create Task
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
