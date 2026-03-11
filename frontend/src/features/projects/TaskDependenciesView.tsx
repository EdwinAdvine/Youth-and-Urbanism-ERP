import { useState } from 'react'
import { cn, Button, Badge, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import type { Task, TaskStatus } from '../../api/projects'
import { useTasks } from '../../api/projects'

// ─── Local dependency storage (until backend supports it) ────────────────────
// Dependencies are stored per-task in localStorage as JSON
// { [taskId]: { predecessors: string[], successors: string[] } }

interface DependencyMap {
  [taskId: string]: { predecessors: string[]; successors: string[] }
}

function loadDeps(projectId: string): DependencyMap {
  try {
    const raw = localStorage.getItem(`project_deps_${projectId}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveDeps(projectId: string, deps: DependencyMap) {
  localStorage.setItem(`project_deps_${projectId}`, JSON.stringify(deps))
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  in_review: 'bg-yellow-500',
  done: 'bg-green-500',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

interface TaskDependenciesViewProps {
  task: Task
  projectId: string
}

export default function TaskDependenciesView({ task, projectId }: TaskDependenciesViewProps) {
  const { data: allTasks } = useTasks(projectId)
  const [deps, setDeps] = useState<DependencyMap>(() => loadDeps(projectId))
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addType, setAddType] = useState<'predecessor' | 'successor'>('predecessor')
  const [searchQuery, setSearchQuery] = useState('')

  const taskDeps = deps[task.id] ?? { predecessors: [], successors: [] }
  const predecessors = (allTasks ?? []).filter((t) => taskDeps.predecessors.includes(t.id))
  const successors = (allTasks ?? []).filter((t) => taskDeps.successors.includes(t.id))

  // Tasks available to add (not self, not already linked)
  const linkedIds = new Set([task.id, ...taskDeps.predecessors, ...taskDeps.successors])
  const availableTasks = (allTasks ?? []).filter(
    (t) => !linkedIds.has(t.id) && t.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if predecessors are blocking (not done)
  const blockedBy = predecessors.filter((t) => t.status !== 'done')
  const isBlocked = blockedBy.length > 0

  function addDependency(targetTaskId: string) {
    const updated = { ...deps }
    // Add to current task
    if (!updated[task.id]) updated[task.id] = { predecessors: [], successors: [] }
    if (addType === 'predecessor') {
      if (!updated[task.id].predecessors.includes(targetTaskId)) {
        updated[task.id].predecessors.push(targetTaskId)
      }
      // Add reverse link
      if (!updated[targetTaskId]) updated[targetTaskId] = { predecessors: [], successors: [] }
      if (!updated[targetTaskId].successors.includes(task.id)) {
        updated[targetTaskId].successors.push(task.id)
      }
    } else {
      if (!updated[task.id].successors.includes(targetTaskId)) {
        updated[task.id].successors.push(targetTaskId)
      }
      if (!updated[targetTaskId]) updated[targetTaskId] = { predecessors: [], successors: [] }
      if (!updated[targetTaskId].predecessors.includes(task.id)) {
        updated[targetTaskId].predecessors.push(task.id)
      }
    }
    setDeps(updated)
    saveDeps(projectId, updated)
    toast('success', `Dependency added`)
    setAddModalOpen(false)
    setSearchQuery('')
  }

  function removeDependency(targetTaskId: string, type: 'predecessor' | 'successor') {
    const updated = { ...deps }
    if (!updated[task.id]) return
    if (type === 'predecessor') {
      updated[task.id].predecessors = updated[task.id].predecessors.filter((id) => id !== targetTaskId)
      if (updated[targetTaskId]) {
        updated[targetTaskId].successors = updated[targetTaskId].successors.filter((id) => id !== task.id)
      }
    } else {
      updated[task.id].successors = updated[task.id].successors.filter((id) => id !== targetTaskId)
      if (updated[targetTaskId]) {
        updated[targetTaskId].predecessors = updated[targetTaskId].predecessors.filter((id) => id !== task.id)
      }
    }
    setDeps(updated)
    saveDeps(projectId, updated)
    toast('success', 'Dependency removed')
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dependencies</h3>
        {isBlocked && (
          <Badge variant="warning">Blocked by {blockedBy.length} task{blockedBy.length > 1 ? 's' : ''}</Badge>
        )}
      </div>

      {/* Predecessors (blocks this task) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Predecessors (must finish first)
          </span>
          <button
            onClick={() => { setAddType('predecessor'); setAddModalOpen(true) }}
            className="text-xs text-primary hover:underline"
          >
            + Add
          </button>
        </div>
        {predecessors.length > 0 ? (
          <div className="space-y-1.5">
            {predecessors.map((t) => (
              <DependencyRow
                key={t.id}
                task={t}
                direction="predecessor"
                onRemove={() => removeDependency(t.id, 'predecessor')}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No predecessors</p>
        )}
      </div>

      {/* Arrow visualization */}
      {(predecessors.length > 0 || successors.length > 0) && (
        <div className="flex items-center justify-center my-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {predecessors.length > 0 && (
              <>
                <span className="text-gray-500">{predecessors.length} task{predecessors.length !== 1 ? 's' : ''}</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium text-white',
              STATUS_COLORS[task.status]
            )}>
              This Task
            </span>
            {successors.length > 0 && (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="text-gray-500">{successors.length} task{successors.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Successors (this task blocks) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Successors (waiting on this task)
          </span>
          <button
            onClick={() => { setAddType('successor'); setAddModalOpen(true) }}
            className="text-xs text-primary hover:underline"
          >
            + Add
          </button>
        </div>
        {successors.length > 0 ? (
          <div className="space-y-1.5">
            {successors.map((t) => (
              <DependencyRow
                key={t.id}
                task={t}
                direction="successor"
                onRemove={() => removeDependency(t.id, 'successor')}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No successors</p>
        )}
      </div>

      {/* Add Dependency Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => { setAddModalOpen(false); setSearchQuery('') }}
        title={`Add ${addType === 'predecessor' ? 'Predecessor' : 'Successor'}`}
        size="md"
      >
        <div className="space-y-3">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {availableTasks.length > 0 ? (
              availableTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => addDependency(t.id)}
                  className="w-full text-left px-3 py-2 rounded-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <div className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLORS[t.status])} />
                  <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-gray-400">{STATUS_LABELS[t.status]}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No available tasks to link</p>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setAddModalOpen(false); setSearchQuery('') }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── DependencyRow ──────────────────────────────────────────────────────────

function DependencyRow({
  task,
  direction,
  onRemove,
}: {
  task: Task
  direction: 'predecessor' | 'successor'
  onRemove: () => void
}) {
  const isDone = task.status === 'done'
  const isBlocking = direction === 'predecessor' && !isDone

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] border text-xs',
        isBlocking ? 'border-orange-200 bg-orange-50' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950'
      )}
    >
      {/* Direction arrow */}
      {direction === 'predecessor' ? (
        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      )}

      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_COLORS[task.status])} />
      <span className="flex-1 truncate text-gray-700 dark:text-gray-300 font-medium">{task.title}</span>

      {isBlocking && (
        <Badge variant="warning" className="text-[9px] py-0">Blocking</Badge>
      )}
      {isDone && (
        <svg className="h-3.5 w-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}

      <button
        onClick={onRemove}
        className="text-gray-300 hover:text-danger transition-colors shrink-0"
        title="Remove dependency"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
