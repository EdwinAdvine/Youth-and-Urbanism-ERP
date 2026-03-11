import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge, Input } from '../../../components/ui'
import { toast } from '../../../components/ui'
import {
  useWorkflows,
  useToggleWorkflow,
  useTriggerWorkflow,
  useDeleteWorkflow,
  useDuplicateWorkflow,
  type Workflow,
  type WorkflowTriggerType,
} from '../../../api/hr_phase3'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerBadge(type: WorkflowTriggerType) {
  const map: Record<WorkflowTriggerType, { variant: 'info' | 'warning' | 'success' | 'primary' | 'default'; label: string }> = {
    employee_created: { variant: 'success', label: 'Employee Created' },
    status_changed: { variant: 'warning', label: 'Status Changed' },
    date_based: { variant: 'info', label: 'Date Based' },
    manual: { variant: 'default', label: 'Manual' },
    goal_completed: { variant: 'primary', label: 'Goal Completed' },
    review_submitted: { variant: 'info', label: 'Review Submitted' },
  }
  const { variant, label } = map[type] ?? { variant: 'default' as const, label: type }
  return <Badge variant={variant}>{label}</Badge>
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-[#51459d]' : 'bg-gray-200 dark:bg-gray-700',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WorkflowCardSkeleton() {
  return (
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="flex justify-between">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="flex gap-2 pt-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-[10px]" />
          ))}
        </div>
      </div>
    </Card>
  )
}

// ─── Workflow Card ─────────────────────────────────────────────────────────────

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const navigate = useNavigate()
  const toggle = useToggleWorkflow()
  const trigger = useTriggerWorkflow()
  const deleteWf = useDeleteWorkflow()
  const duplicate = useDuplicateWorkflow()

  function handleToggle(val: boolean) {
    toggle.mutate(
      { id: workflow.id, is_active: val },
      {
        onSuccess: () => toast('success', `Workflow ${val ? 'activated' : 'deactivated'}`),
        onError: () => toast('error', 'Failed to update workflow status'),
      }
    )
  }

  function handleTrigger() {
    trigger.mutate(
      { id: workflow.id },
      {
        onSuccess: () => toast('success', 'Workflow triggered successfully'),
        onError: () => toast('error', 'Failed to trigger workflow'),
      }
    )
  }

  function handleDelete() {
    if (!window.confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return
    deleteWf.mutate(workflow.id, {
      onSuccess: () => toast('success', 'Workflow deleted'),
      onError: () => toast('error', 'Failed to delete workflow'),
    })
  }

  function handleDuplicate() {
    duplicate.mutate(workflow.id, {
      onSuccess: () => toast('success', 'Workflow duplicated'),
      onError: () => toast('error', 'Failed to duplicate workflow'),
    })
  }

  return (
    <Card>
      <div className="space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug truncate">
              {workflow.name}
            </h3>
            {workflow.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                {workflow.description}
              </p>
            )}
          </div>
          <ToggleSwitch
            checked={workflow.is_active}
            onChange={handleToggle}
            disabled={toggle.isPending}
          />
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5">
          {triggerBadge(workflow.trigger_type)}
          {workflow.category && (
            <Badge variant="default">{workflow.category}</Badge>
          )}
          {workflow.is_template && (
            <Badge variant="primary">Template</Badge>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {workflow.run_count} runs
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Last: {formatDate(workflow.last_run_at)}
          </span>
          <span>{workflow.steps.length} steps</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-700">
          <Button size="sm" variant="outline" onClick={() => navigate(`/hr/workflows/builder/${workflow.id}`)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleTrigger}
            loading={trigger.isPending}
            disabled={!workflow.is_active}
          >
            Trigger Now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/hr/workflows/executions?workflow_id=${workflow.id}`)}>
            Executions
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDuplicate} loading={duplicate.isPending}>
            Duplicate
          </Button>
          <Button size="sm" variant="danger" onClick={handleDelete} loading={deleteWf.isPending}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'inactive' | 'templates'

export default function WorkflowListPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  const queryParams = {
    is_active: tab === 'active' ? true : tab === 'inactive' ? false : undefined,
    is_template: tab === 'templates' ? true : undefined,
    search: search || undefined,
  }

  const { data, isLoading } = useWorkflows(queryParams)

  const workflows = data?.items ?? []
  const stats = data?.stats

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
    { key: 'templates', label: 'Templates' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HR Workflows</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Automate HR processes and approvals
          </p>
        </div>
        <Button onClick={() => navigate('/hr/workflows/builder')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Workflow
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-2">
                <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total ?? 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Workflows</p>
            </Card>
            <Card>
              <p className="text-2xl font-bold text-[#6fd943]">{stats?.active ?? 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Active</p>
            </Card>
            <Card>
              <p className="text-2xl font-bold text-[#ffa21d]">{stats?.paused ?? 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Paused</p>
            </Card>
            <Card>
              <p className="text-2xl font-bold text-[#3ec9d6]">{stats?.executions_this_month ?? 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Executions This Month</p>
            </Card>
          </>
        )}
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Tabs */}
        <div className="flex rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'px-4 py-2 text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-[#51459d] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Workflow grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <WorkflowCardSkeleton key={i} />)}
        </div>
      ) : workflows.length === 0 ? (
        <Card>
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              {search ? 'No workflows match your search' : 'No workflows yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
              {search
                ? 'Try a different search term or clear filters.'
                : 'Create your first workflow to automate HR processes and approvals.'}
            </p>
            {!search && (
              <Button onClick={() => navigate('/hr/workflows/builder')}>
                Create your first workflow
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <WorkflowCard key={wf.id} workflow={wf} />
          ))}
        </div>
      )}
    </div>
  )
}
