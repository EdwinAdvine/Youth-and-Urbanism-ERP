import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useGoals,
  useGoal,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useGoalUpdates,
  useAddGoalUpdate,
  useGoalTree,
  useGoalDashboard,
  type Goal,
  type GoalCreatePayload,
  type GoalUpdatePayload,
  type GoalUpdate,
} from '../../api/hr_phase1'
import { useEmployees } from '../../api/hr'

const statusVariant: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  not_started: 'default',
  in_progress: 'info',
  at_risk: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

const defaultForm: GoalCreatePayload = {
  title: '',
  description: '',
  goal_type: 'individual',
  owner_type: 'employee',
  owner_id: '',
  parent_id: '',
  metric_type: 'percentage',
  target_value: 100,
  start_date: '',
  due_date: '',
  weight: 1,
  review_period: '',
}

export default function GoalsPage() {
  const [view, setView] = useState<'list' | 'tree'>('list')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')

  const { data: goals, isLoading } = useGoals({
    goal_type: typeFilter || undefined,
    status: statusFilter || undefined,
    review_period: periodFilter || undefined,
  })
  const { data: empData } = useEmployees({ limit: 500 })
  const { data: goalTree, isLoading: treeLoading } = useGoalTree()
  const { data: dashboard } = useGoalDashboard()
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [form, setForm] = useState<GoalCreatePayload>(defaultForm)

  // Detail panel
  const [detailGoalId, setDetailGoalId] = useState('')
  const { data: detailGoal } = useGoal(detailGoalId)
  const { data: goalUpdates } = useGoalUpdates(detailGoalId)
  const addUpdate = useAddGoalUpdate(detailGoalId)
  const [updateValue, setUpdateValue] = useState<number>(0)
  const [updateComment, setUpdateComment] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(goal: Goal) {
    setEditing(goal)
    setForm({
      title: goal.title,
      description: goal.description ?? '',
      goal_type: goal.goal_type,
      owner_type: goal.owner_type,
      owner_id: goal.owner_id,
      parent_id: goal.parent_id ?? '',
      metric_type: goal.metric_type,
      target_value: goal.target_value ?? 100,
      start_date: goal.start_date.slice(0, 10),
      due_date: goal.due_date.slice(0, 10),
      weight: goal.weight,
      review_period: goal.review_period ?? '',
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      parent_id: form.parent_id || undefined,
      review_period: form.review_period || undefined,
    }
    if (editing) {
      const updateData: GoalUpdatePayload = {
        title: form.title,
        description: form.description,
        target_value: form.target_value,
        due_date: form.due_date,
        weight: form.weight,
      }
      updateGoal.mutate(
        { goalId: editing.id, data: updateData },
        {
          onSuccess: () => { toast('success', 'Goal updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update goal'),
        }
      )
    } else {
      createGoal.mutate(payload, {
        onSuccess: () => { toast('success', 'Goal created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create goal'),
      })
    }
  }

  function handleDeleteGoal(goal: Goal) {
    if (!confirm(`Delete goal "${goal.title}"?`)) return
    deleteGoal.mutate(goal.id, {
      onSuccess: () => toast('success', 'Goal deleted'),
      onError: () => toast('error', 'Failed to delete goal'),
    })
  }

  function handleAddUpdate(e: React.FormEvent) {
    e.preventDefault()
    addUpdate.mutate(
      { new_value: updateValue, comment: updateComment || undefined },
      {
        onSuccess: () => { toast('success', 'Progress updated'); setUpdateValue(0); setUpdateComment('') },
        onError: () => toast('error', 'Failed to add update'),
      }
    )
  }

  function progressPercent(goal: Goal): number {
    if (!goal.target_value || goal.target_value === 0) return 0
    return Math.min(Math.round((goal.current_value / goal.target_value) * 100), 100)
  }

  // Tree node renderer
  function GoalTreeNode({ goal, depth = 0 }: { goal: Goal; depth?: number }) {
    const pct = progressPercent(goal)
    return (
      <div style={{ marginLeft: depth * 24 }}>
        <div
          className="flex items-center gap-3 p-3 rounded-[10px] border border-gray-100 dark:border-gray-700 mb-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          onClick={() => setDetailGoalId(goal.id)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{goal.title}</p>
              <Badge variant={statusVariant[goal.status] ?? 'default'}>{goal.status.replace('_', ' ')}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[200px]">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{pct}%</span>
            </div>
          </div>
        </div>
        {goal.children?.map((child) => (
          <GoalTreeNode key={child.id} goal={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (g: Goal) => (
        <button
          className="text-left font-medium text-gray-900 dark:text-gray-100 hover:text-primary transition-colors"
          onClick={() => setDetailGoalId(g.id)}
        >
          {g.title}
        </button>
      ),
    },
    {
      key: 'goal_type',
      label: 'Type',
      render: (g: Goal) => (
        <Badge variant="info">{g.goal_type.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'owner_id',
      label: 'Owner',
      render: (g: Goal) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{g.owner_id}</span>
      ),
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (g: Goal) => {
        const pct = progressPercent(g)
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (g: Goal) => (
        <Badge variant={statusVariant[g.status] ?? 'default'}>{g.status.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (g: Goal) => new Date(g.due_date).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (g: Goal) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteGoal(g)}>Delete</Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Goals & OKR</h1>
          <p className="text-sm text-gray-500 mt-1">Set and track organizational, team, and individual goals</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'list' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              onClick={() => setView('list')}
            >
              List View
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'tree' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              onClick={() => setView('tree')}
            >
              Tree View
            </button>
          </div>
          <Button onClick={openCreate}>Create Goal</Button>
        </div>
      </div>

      {/* Dashboard summary */}
      {dashboard && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Goals', value: (dashboard as Record<string, number>).total ?? 0, color: 'text-gray-900 dark:text-gray-100' },
            { label: 'In Progress', value: (dashboard as Record<string, number>).in_progress ?? 0, color: 'text-blue-600' },
            { label: 'At Risk', value: (dashboard as Record<string, number>).at_risk ?? 0, color: 'text-yellow-600' },
            { label: 'Completed', value: (dashboard as Record<string, number>).completed ?? 0, color: 'text-green-600' },
          ].map((stat) => (
            <Card key={stat.label}>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </Card>
          ))}
        </div>
      )}

      {view === 'list' ? (
        <>
          <div className="flex gap-3">
            <Select
              options={[
                { value: '', label: 'All Types' },
                { value: 'company', label: 'Company' },
                { value: 'team', label: 'Team' },
                { value: 'individual', label: 'Individual' },
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-40"
            />
            <Select
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'not_started', label: 'Not Started' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'at_risk', label: 'At Risk' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40"
            />
            <Input
              placeholder="Review period (e.g., Q1 2026)"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="w-52"
            />
          </div>
          <Card padding={false}>
            <Table
              columns={columns}
              data={(goals as Goal[]) ?? []}
              keyExtractor={(g) => g.id}
              emptyText="No goals found."
            />
          </Card>
        </>
      ) : (
        <Card>
          {treeLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : goalTree && Array.isArray(goalTree) && (goalTree as Goal[]).length > 0 ? (
            <div className="space-y-1">
              {(goalTree as Goal[]).map((goal) => (
                <GoalTreeNode key={goal.id} goal={goal} />
              ))}
            </div>
          ) : (
            <p className="text-center py-12 text-gray-400 text-sm">No goals found. Create your first goal to get started.</p>
          )}
        </Card>
      )}

      {/* Goal Detail Modal */}
      <Modal open={!!detailGoalId} onClose={() => setDetailGoalId('')} title="Goal Details" size="lg">
        {detailGoal ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{(detailGoal as Goal).title}</h3>
              {(detailGoal as Goal).description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{(detailGoal as Goal).description}</p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={statusVariant[(detailGoal as Goal).status] ?? 'default'}>
                  {(detailGoal as Goal).status.replace('_', ' ')}
                </Badge>
                <Badge variant="info">{(detailGoal as Goal).goal_type}</Badge>
                <span className="text-xs text-gray-500">
                  Due: {new Date((detailGoal as Goal).due_date).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 max-w-[300px]">
                  <div
                    className="bg-primary rounded-full h-3 transition-all"
                    style={{ width: `${progressPercent(detailGoal as Goal)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {(detailGoal as Goal).current_value} / {(detailGoal as Goal).target_value ?? '?'}
                </span>
              </div>
            </div>

            {/* Add Update */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add Progress Update</h4>
              <form onSubmit={handleAddUpdate} className="flex gap-3">
                <Input
                  type="number"
                  placeholder="New value"
                  value={updateValue}
                  onChange={(e) => setUpdateValue(Number(e.target.value))}
                  className="w-28"
                />
                <Input
                  placeholder="Comment (optional)"
                  value={updateComment}
                  onChange={(e) => setUpdateComment(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" loading={addUpdate.isPending}>Update</Button>
              </form>
            </div>

            {/* Progress History */}
            {goalUpdates && (goalUpdates as GoalUpdate[]).length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Progress History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(goalUpdates as GoalUpdate[]).map((u) => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-[10px] bg-gray-50 dark:bg-gray-800">
                      <div>
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {u.previous_value} &rarr; {u.new_value}
                        </span>
                        {u.comment && <p className="text-xs text-gray-500 mt-0.5">{u.comment}</p>}
                      </div>
                      <span className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Child Goals */}
            {(detailGoal as Goal).children && (detailGoal as Goal).children!.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Child Goals</h4>
                <div className="space-y-2">
                  {(detailGoal as Goal).children!.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between px-3 py-2 rounded-[10px] border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => setDetailGoalId(child.id)}
                    >
                      <span className="text-sm text-gray-900 dark:text-gray-100">{child.title}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant[child.status] ?? 'default'}>{child.status.replace('_', ' ')}</Badge>
                        <span className="text-xs text-gray-500">{progressPercent(child)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        )}
      </Modal>

      {/* Create / Edit Goal Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Goal' : 'Create Goal'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Goal Type"
              required
              options={[
                { value: 'company', label: 'Company' },
                { value: 'team', label: 'Team' },
                { value: 'individual', label: 'Individual' },
              ]}
              value={form.goal_type}
              onChange={(e) => setForm((p) => ({ ...p, goal_type: e.target.value }))}
            />
            <Select
              label="Owner Type"
              required
              options={[
                { value: 'employee', label: 'Employee' },
                { value: 'team', label: 'Team' },
                { value: 'department', label: 'Department' },
                { value: 'company', label: 'Company' },
              ]}
              value={form.owner_type}
              onChange={(e) => setForm((p) => ({ ...p, owner_type: e.target.value }))}
            />
          </div>
          <Select
            label="Owner"
            required
            options={[
              { value: '', label: 'Select owner...' },
              ...(empData?.items?.map((e: { id: string; first_name: string; last_name: string }) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
            ]}
            value={form.owner_id}
            onChange={(e) => setForm((p) => ({ ...p, owner_id: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Metric Type"
              options={[
                { value: 'percentage', label: 'Percentage' },
                { value: 'number', label: 'Number' },
                { value: 'currency', label: 'Currency' },
                { value: 'boolean', label: 'Boolean' },
              ]}
              value={form.metric_type ?? 'percentage'}
              onChange={(e) => setForm((p) => ({ ...p, metric_type: e.target.value }))}
            />
            <Input
              label="Target Value"
              type="number"
              value={form.target_value ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, target_value: e.target.value ? Number(e.target.value) : undefined }))}
            />
            <Input
              label="Weight"
              type="number"
              step="0.1"
              value={form.weight ?? 1}
              onChange={(e) => setForm((p) => ({ ...p, weight: Number(e.target.value) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
            <Input
              label="Due Date"
              type="date"
              required
              value={form.due_date}
              onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
            />
          </div>
          <Input
            label="Review Period"
            placeholder="e.g., Q1 2026"
            value={form.review_period ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, review_period: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createGoal.isPending || updateGoal.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
