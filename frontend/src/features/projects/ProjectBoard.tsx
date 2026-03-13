import { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useProject,
  useBoard,
  useMilestones,
  useCreateTask,
  useBatchReorder,
  useTasks,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type BoardView,
  type ReorderItem,
} from '../../api/projects'
import TaskCard from './TaskCard'
import TaskDetail from './TaskDetail'
import BoardCustomization, { useBoardColumns, type BoardColumn } from './BoardCustomization'
import BulkTaskOperations, { TaskSelectionCheckbox } from './BulkTaskOperations'
import QuickTaskFAB from './QuickTaskFAB'
import { GuestInviteDialog } from './GuestInviteDialog'

type SwimlaneMode = 'none' | 'assignee' | 'priority' | 'sprint'

const SWIMLANE_OPTIONS: { value: SwimlaneMode; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'assignee', label: 'Group by Assignee' },
  { value: 'priority', label: 'Group by Priority' },
  { value: 'sprint', label: 'Group by Sprint' },
]

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low']

const DEFAULT_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
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
  const { data: allTasks } = useTasks(projectId)

  const createTask = useCreateTask()
  const batchReorder = useBatchReorder()

  // Board customization
  const savedColumns = useBoardColumns(projectId)
  const [columns, setColumns] = useState<BoardColumn[]>(savedColumns)
  const [customizeOpen, setCustomizeOpen] = useState(false)

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

  // Bulk selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())

  // Swimlanes
  const [swimlane, setSwimlane] = useState<SwimlaneMode>('none')

  // Guest access dialog
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedTaskIds(new Set()), [])

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

  // Map columns to use custom labels/colors, fallback to board data
  const COLUMNS = columns.length > 0 ? columns.map((c) => ({
    key: c.key as TaskStatus,
    label: c.label,
    color: `bg-[${c.color}]`,
    rawColor: c.color,
  })) : DEFAULT_COLUMNS.map((c) => ({ ...c, rawColor: '' }))

  // Swimlane grouping — build list of { laneKey, laneLabel, tasks } pairs
  const swimlaneGroups = useMemo(() => {
    if (swimlane === 'none') return null

    const allBoardTasks: Task[] = COLUMNS.flatMap(c => boardData[c.key as TaskStatus] ?? [])
    const groups = new Map<string, Task[]>()
    const labelMap = new Map<string, string>()

    allBoardTasks.forEach(task => {
      let key = ''
      let label = ''
      if (swimlane === 'assignee') {
        key = task.assignee_id ?? '__unassigned__'
        label = task.assignee_name ?? (task.assignee_id ? task.assignee_id.slice(0, 8) : 'Unassigned')
      } else if (swimlane === 'priority') {
        key = task.priority
        label = task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
      } else if (swimlane === 'sprint') {
        key = task.sprint_id ?? '__no_sprint__'
        label = task.sprint_id ? `Sprint ${task.sprint_id.slice(0, 8)}` : 'No Sprint'
      }
      if (!groups.has(key)) { groups.set(key, []); labelMap.set(key, label) }
      groups.get(key)!.push(task)
    })

    // Sort groups for priority
    let keys = [...groups.keys()]
    if (swimlane === 'priority') {
      keys.sort((a, b) => PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b))
    }

    return keys.map(key => ({
      laneKey: key,
      laneLabel: labelMap.get(key) ?? key,
      tasks: groups.get(key)!,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swimlane, boardData])

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
      <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
          <button onClick={() => navigate('/projects')} className="text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center sm:min-h-0 sm:min-w-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {project.color && (
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
          )}
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h1>
          <Badge variant={project.status === 'active' ? 'success' : 'default'}>{project.status}</Badge>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Swimlane selector */}
            <select
              value={swimlane}
              onChange={e => setSwimlane(e.target.value as SwimlaneMode)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 bg-white"
              title="Swimlane grouping"
            >
              {SWIMLANE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <Button variant="ghost" size="sm" onClick={() => setCustomizeOpen(true)} title="Customize board columns">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/time-report`)}>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time Report
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/integrations`)}>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Files &amp; Links
            </Button>
            <Button variant="outline" size="sm" onClick={() => setGuestDialogOpen(true)}>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Share
            </Button>
          </div>
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
            <div className="flex-1 max-w-xs h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
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
      <div className="flex-1 overflow-x-auto p-4 sm:p-6">
        {swimlaneGroups ? (
          /* ── Swimlane mode ─────────────────────────────────────────── */
          <div className="space-y-6 min-w-max">
            {/* Column headers row */}
            <div className="flex gap-4 pl-36">
              {COLUMNS.map(col => (
                <div key={col.key} className="w-72 shrink-0 flex items-center gap-2 px-3">
                  <div className="w-2 h-2 rounded-full" style={col.rawColor ? { backgroundColor: col.rawColor } : undefined} />
                  <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                </div>
              ))}
            </div>

            {/* Swimlane rows */}
            {swimlaneGroups.map(lane => (
              <div key={lane.laneKey} className="flex gap-4">
                {/* Lane label */}
                <div className="w-32 shrink-0 flex items-start pt-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate" title={lane.laneLabel}>
                    {lane.laneLabel}
                  </span>
                  <span className="ml-1.5 text-xs text-gray-400">({lane.tasks.length})</span>
                </div>

                {/* Columns within this lane */}
                {COLUMNS.map(col => {
                  const laneTasks = lane.tasks.filter(t => t.status === col.key)
                  return (
                    <div
                      key={col.key}
                      className={cn(
                        'flex flex-col w-72 min-h-[80px] rounded-[10px] bg-gray-50 shrink-0',
                        dragOverColumn === col.key && 'ring-2 ring-primary/40'
                      )}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, col.key)}
                    >
                      <div className="px-3 pb-3 pt-2 space-y-2">
                        {laneTasks.map(task => (
                          <div key={task.id} className="flex items-start gap-1.5">
                            <div className="pt-3">
                              <TaskSelectionCheckbox taskId={task.id} selected={selectedTaskIds.has(task.id)} onToggle={toggleTaskSelection} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <TaskCard task={task} onClick={handleTaskClick} />
                            </div>
                          </div>
                        ))}
                        {laneTasks.length === 0 && (
                          <p className="text-xs text-gray-300 text-center py-3">—</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ) : (
          /* ── Normal board mode ─────────────────────────────────────── */
          <div className="flex flex-col sm:flex-row gap-4 h-full sm:min-w-max">
            {COLUMNS.map((col) => {
              const tasks = boardData[col.key] ?? []
              return (
                <div
                  key={col.key}
                  className={cn(
                    'flex flex-col w-full sm:w-72 rounded-[10px] bg-gray-50 sm:shrink-0',
                    dragOverColumn === col.key && 'ring-2 ring-primary/40'
                  )}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.key)}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={col.rawColor ? { backgroundColor: col.rawColor } : undefined} />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{col.label}</span>
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
                      <div key={task.id} className="flex items-start gap-1.5">
                        <div className="pt-3">
                          <TaskSelectionCheckbox
                            taskId={task.id}
                            selected={selectedTaskIds.has(task.id)}
                            onToggle={toggleTaskSelection}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <TaskCard task={task} onClick={handleTaskClick} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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

      {/* Board Customization Modal */}
      <BoardCustomization
        projectId={projectId}
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        onColumnsChange={(newCols) => setColumns(newCols)}
      />

      {/* Bulk Task Operations Toolbar */}
      <BulkTaskOperations
        projectId={projectId}
        selectedTaskIds={selectedTaskIds}
        tasks={allTasks ?? []}
        onClearSelection={clearSelection}
      />

      {/* Quick Task FAB (mobile) */}
      <QuickTaskFAB projectId={projectId} />

      {/* Guest Invite Dialog */}
      <GuestInviteDialog
        projectId={projectId}
        open={guestDialogOpen}
        onClose={() => setGuestDialogOpen(false)}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional description..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
