import { useState } from 'react'
import { Card, Button, Input, Select, Badge, Modal, Spinner, toast } from '@/components/ui'
import {
  useOnboardingTasks,
  useEmployeeOnboardingTasks,
  useUpdateTaskStatus,
  useOnboardingDashboard,
  useBuddyAssignments,
  useCreateBuddyAssignment,
  useDeactivateBuddy,
  type OnboardingTask,
} from '@/api/hr_engagement'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOverdue(task: OnboardingTask): boolean {
  if (!task.due_date || task.status === 'completed' || task.status === 'skipped') return false
  return new Date(task.due_date) < new Date()
}

function isUpcomingWeek(task: OnboardingTask): boolean {
  if (!task.due_date || task.status === 'completed' || task.status === 'skipped') return false
  const now  = Date.now()
  const due  = new Date(task.due_date).getTime()
  const week = 7 * 24 * 60 * 60 * 1000
  return due > now && due <= now + week
}

const CATEGORY_LABELS: Record<string, string> = {
  it_setup:  'IT Setup',
  paperwork: 'Paperwork',
  training:  'Training',
  access:    'Access',
  equipment: 'Equipment',
}

// ─── Circular Progress ────────────────────────────────────────────────────────

function CircularProgress({ pct, size = 64 }: { pct: number; size?: number }) {
  const r     = (size - 8) / 2
  const circ  = 2 * Math.PI * r
  const dash  = (pct / 100) * circ
  const color = pct >= 100 ? '#6fd943' : pct >= 50 ? '#51459d' : '#ffa21d'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-gray-100 dark:stroke-gray-700" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={6}
          stroke={color}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{pct}%</span>
      </div>
    </div>
  )
}

// ─── Task Checkbox Row ────────────────────────────────────────────────────────

function TaskCheckboxRow({
  task,
  onStatusChange,
  isUpdating,
}: {
  task: OnboardingTask
  onStatusChange: (id: string, status: OnboardingTask['status']) => void
  isUpdating: boolean
}) {
  const overdue   = isOverdue(task)
  const upcoming  = isUpcomingWeek(task)
  const done      = task.status === 'completed'

  return (
    <div
      className={`flex items-center gap-3 rounded-[10px] border p-3 transition-colors ${
        overdue  ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800' :
        upcoming ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800' :
        done     ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800' :
                   'border-gray-100 dark:border-gray-700'
      }`}
    >
      <input
        type="checkbox"
        checked={done}
        disabled={isUpdating}
        onChange={() =>
          onStatusChange(task.id, done ? 'pending' : 'completed')
        }
        className="h-4 w-4 flex-shrink-0 rounded accent-primary cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          {task.category && (
            <span className="text-xs text-gray-400">{CATEGORY_LABELS[task.category] ?? task.category}</span>
          )}
          {task.due_date && (
            <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              Due: {new Date(task.due_date).toLocaleDateString()}
              {overdue && ' — OVERDUE'}
            </span>
          )}
          {upcoming && !overdue && (
            <span className="text-xs text-yellow-600 font-medium">Due soon</span>
          )}
        </div>
      </div>
      {task.assigned_to && (
        <span className="flex-shrink-0 text-xs text-gray-400">{task.assigned_to}</span>
      )}
    </div>
  )
}

// ─── Employee Group (expandable) ──────────────────────────────────────────────

interface EmployeeGroupData {
  employee_id: string
  employee_name: string
  hire_date: string
  completion_pct: number
  total_tasks: number
  completed_tasks: number
  overdue_tasks: number
  buddy?: string
}

function EmployeeGroup({
  employee,
}: {
  employee: EmployeeGroupData
}) {
  const [expanded, setExpanded] = useState(false)
  const updateStatus = useUpdateTaskStatus()

  const { data: tasks, isLoading: tasksLoading } = useEmployeeOnboardingTasks(
    expanded ? employee.employee_id : ''
  )

  function handleStatusChange(id: string, status: OnboardingTask['status']) {
    updateStatus.mutate(
      { id, status },
      {
        onError: () => toast('error', 'Failed to update task'),
      }
    )
  }

  const initials = employee.employee_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" padding={false}>
      {/* Card Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        {/* Avatar */}
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: '#51459d' }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {employee.employee_name}
            </span>
            {employee.overdue_tasks > 0 && (
              <Badge variant="danger">{employee.overdue_tasks} overdue</Badge>
            )}
            {employee.buddy && (
              <span className="text-xs text-gray-400">Buddy: {employee.buddy}</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Hired: {new Date(employee.hire_date).toLocaleDateString()} ·{' '}
            {employee.completed_tasks}/{employee.total_tasks} tasks done
          </div>
        </div>

        {/* Circular progress */}
        <CircularProgress pct={employee.completion_pct} />

        {/* Chevron */}
        <svg
          className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Task List */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-5">
          {tasksLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No tasks assigned</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskCheckboxRow
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  isUpdating={updateStatus.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Assign Buddy Modal ───────────────────────────────────────────────────────

function AssignBuddyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createBuddy = useCreateBuddyAssignment()
  const [newEmpId, setNewEmpId]   = useState('')
  const [buddyId, setBuddyId]     = useState('')
  const [startDate, setStartDate] = useState('')

  async function handleSubmit() {
    if (!newEmpId.trim() || !buddyId.trim() || !startDate) {
      toast('error', 'All fields are required')
      return
    }
    try {
      await createBuddy.mutateAsync({
        new_employee_id:   newEmpId.trim(),
        buddy_employee_id: buddyId.trim(),
        start_date:        startDate,
        end_date:          null,
      })
      toast('success', 'Buddy assigned successfully')
      setNewEmpId('')
      setBuddyId('')
      setStartDate('')
      onClose()
    } catch {
      toast('error', 'Failed to assign buddy')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Buddy" size="sm">
      <div className="space-y-4">
        <Input
          label="New Employee ID"
          placeholder="emp-001"
          value={newEmpId}
          onChange={(e) => setNewEmpId(e.target.value)}
        />
        <Input
          label="Buddy Employee ID"
          placeholder="emp-002"
          value={buddyId}
          onChange={(e) => setBuddyId(e.target.value)}
        />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Start Date
          </label>
          <input
            type="date"
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={createBuddy.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createBuddy.isPending}>
            Assign Buddy
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const { data: dashData, isLoading } = useOnboardingDashboard()

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    )
  }

  const stats = (dashData as Record<string, number>) ?? {}

  const items = [
    { label: 'Employees Onboarding',  value: stats.employees_onboarding ?? 0,  color: '#51459d' },
    { label: 'Avg Completion',        value: `${stats.avg_completion ?? 0}%`,   color: '#3ec9d6' },
    { label: 'Overdue Tasks',         value: stats.overdue_tasks ?? 0,          color: '#ff3a6e' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map(({ label, value, color }) => (
        <Card key={label} className="text-center">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>
            {value}
          </p>
        </Card>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingTrackerPage() {
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState('')
  const [buddyModalOpen, setBuddy]  = useState(false)

  const { data: buddies, isLoading: buddiesLoading } = useBuddyAssignments()
  const deactivateBuddy = useDeactivateBuddy()

  // We derive employee groups from the tasks API (grouped by employee)
  const { data: tasksData, isLoading: tasksLoading } = useOnboardingTasks({
    status: (status as OnboardingTask['status']) || undefined,
    limit: 100,
  })

  // Build employee groups from tasks
  const employeeMap = new Map<string, EmployeeGroupData>()
  ;(tasksData?.items ?? []).forEach((task) => {
    if (!task.employee_id) return
    const existing = employeeMap.get(task.employee_id)
    if (!existing) {
      employeeMap.set(task.employee_id, {
        employee_id:    task.employee_id,
        employee_name:  `Employee ${task.employee_id}`, // would come from employee relation
        hire_date:      new Date().toISOString(),
        completion_pct: 0,
        total_tasks:    1,
        completed_tasks: task.status === 'completed' ? 1 : 0,
        overdue_tasks:  isOverdue(task) ? 1 : 0,
      })
    } else {
      existing.total_tasks += 1
      if (task.status === 'completed') existing.completed_tasks += 1
      if (isOverdue(task)) existing.overdue_tasks += 1
      existing.completion_pct = Math.round(
        (existing.completed_tasks / existing.total_tasks) * 100
      )
    }
  })

  const employeeGroups = Array.from(employeeMap.values()).filter((e) =>
    search
      ? e.employee_name.toLowerCase().includes(search.toLowerCase()) ||
        e.employee_id.toLowerCase().includes(search.toLowerCase())
      : true
  )

  function handleDeactivateBuddy(id: string) {
    deactivateBuddy.mutate(id, {
      onSuccess: () => toast('success', 'Buddy assignment removed'),
      onError:   () => toast('error', 'Failed to remove buddy'),
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Onboarding Tracker
          </h1>
          <p className="text-sm text-gray-500">
            Track employee onboarding progress and task completion
          </p>
        </div>
        <Button size="sm" onClick={() => setBuddy(true)}>
          Assign Buddy
        </Button>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          className="max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: '',            label: 'All Statuses' },
            { value: 'pending',     label: 'Pending' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed',   label: 'Completed' },
          ]}
          className="max-w-48"
        />
      </div>

      {/* Employee List */}
      {tasksLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : employeeGroups.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="mb-3 h-12 w-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500">
              {search || status ? 'No employees match your filters' : 'No onboarding tasks found'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {employeeGroups.map((emp) => (
            <EmployeeGroup key={emp.employee_id} employee={emp} />
          ))}
        </div>
      )}

      {/* Buddy Assignments */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Active Buddy Assignments
          </h2>
          <Button size="sm" variant="outline" onClick={() => setBuddy(true)}>
            + Assign Buddy
          </Button>
        </div>

        {buddiesLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : !buddies || buddies.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No active buddy assignments</p>
        ) : (
          <div className="space-y-2">
            {buddies
              .filter((b) => b.is_active)
              .map((buddy) => (
                <div
                  key={buddy.id}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-gray-100 dark:border-gray-700 p-3"
                >
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">New Employee</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {buddy.new_employee_id}
                      </p>
                    </div>
                    <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div>
                      <p className="text-gray-500 text-xs">Buddy</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {buddy.buddy_employee_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Since</p>
                      <p className="text-gray-700 dark:text-gray-300">
                        {new Date(buddy.start_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeactivateBuddy(buddy.id)}
                    className="text-danger hover:text-danger"
                    disabled={deactivateBuddy.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Assign Buddy Modal */}
      <AssignBuddyModal open={buddyModalOpen} onClose={() => setBuddy(false)} />
    </div>
  )
}
