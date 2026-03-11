import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Button, Badge, Select, Modal } from '../../../components/ui'
import {
  useWorkflowExecutions,
  useWorkflowExecution,
  useWorkflows,
  useCancelExecution,
  type WorkflowExecution,
  type ExecutionStatus,
  type ExecutionStepResult,
} from '../../../api/hr_phase3'
import { toast } from '../../../components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type StatusVariant = 'info' | 'success' | 'danger' | 'warning' | 'default'

const STATUS_VARIANT: Record<ExecutionStatus, StatusVariant> = {
  running: 'info',
  completed: 'success',
  failed: 'danger',
  paused: 'warning',
  cancelled: 'default',
}

const STATUS_LABEL: Record<ExecutionStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  paused: 'Paused',
  cancelled: 'Cancelled',
}

function StatusBadge({ status }: { status: ExecutionStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return 'Running...'
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Step Icon ────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: ExecutionStatus }) {
  if (status === 'completed') {
    return (
      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-[#6fd943]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }
  if (status === 'running') {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-[#3ec9d6] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-[#ff3a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    )
  }
  if (status === 'paused') {
    return (
      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-[#ffa21d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
        </svg>
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    </div>
  )
}

// ─── Execution Detail Modal ───────────────────────────────────────────────────

function ExecutionDetailModal({
  executionId,
  open,
  onClose,
}: {
  executionId: string | null
  open: boolean
  onClose: () => void
}) {
  const { data: execution, isLoading } = useWorkflowExecution(executionId ?? undefined)
  const cancelExecution = useCancelExecution()

  function handleCancel() {
    if (!executionId) return
    cancelExecution.mutate(executionId, {
      onSuccess: () => {
        toast('success', 'Execution cancelled')
        onClose()
      },
      onError: () => toast('error', 'Failed to cancel execution'),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={execution ? `Execution: ${execution.workflow_name}` : 'Execution Details'}
      size="lg"
    >
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : execution ? (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="flex flex-wrap items-center gap-3 text-sm p-3 bg-gray-50 dark:bg-gray-800/50 rounded-[10px]">
            <StatusBadge status={execution.status} />
            <span className="text-gray-500 dark:text-gray-400">
              Started {formatDateTime(execution.started_at)}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Duration: {formatDuration(execution.started_at, execution.completed_at)}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              By: <span className="font-medium text-gray-700 dark:text-gray-300">{execution.triggered_by}</span>
            </span>
          </div>

          {/* Error message */}
          {execution.error_message && (
            <div className="p-3 rounded-[10px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs font-semibold text-[#ff3a6e] uppercase tracking-wide mb-1">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300 font-mono">{execution.error_message}</p>
            </div>
          )}

          {/* Steps timeline */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Steps ({execution.steps_completed.length}/{execution.total_steps})
            </h3>
            <div className="space-y-0">
              {execution.steps_completed.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No steps recorded yet.</p>
              ) : (
                execution.steps_completed.map((step: ExecutionStepResult, idx: number) => (
                  <div key={step.step_id} className="relative">
                    {/* Connector line */}
                    {idx < execution.steps_completed.length - 1 && (
                      <div className="absolute left-4 top-8 w-0.5 h-4 bg-gray-200 dark:bg-gray-700" />
                    )}
                    <div className="flex gap-3 pb-4">
                      <StepIcon status={step.status} />
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {step.step_name || `Step ${step.step_order}`}
                          </span>
                          <StatusBadge status={step.status} />
                          <span className="text-xs text-gray-400">
                            {step.started_at ? formatDateTime(step.started_at) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 capitalize">
                          {step.step_type.replace(/_/g, ' ')}
                        </p>

                        {/* Error */}
                        {step.error && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-[10px]">
                            <p className="text-xs text-[#ff3a6e] font-mono">{step.error}</p>
                          </div>
                        )}

                        {/* Result data */}
                        {step.result && Object.keys(step.result).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">
                              View result data
                            </summary>
                            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-[10px] text-xs text-gray-700 dark:text-gray-300 overflow-x-auto max-h-32">
                              {JSON.stringify(step.result, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cancel button */}
          {execution.status === 'running' && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <Button variant="danger" loading={cancelExecution.isPending} onClick={handleCancel}>
                Cancel Execution
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Execution not found.</p>
      )}
    </Modal>
  )
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string
  value: number
  color: string
  loading: boolean
}) {
  return (
    <Card>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-7 w-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ) : (
        <>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
        </>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | ExecutionStatus

export default function WorkflowExecutionPage() {
  const [searchParams] = useSearchParams()
  const preselectedWorkflowId = searchParams.get('workflow_id') ?? undefined

  const [workflowFilter, setWorkflowFilter] = useState(preselectedWorkflowId ?? '')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: workflowsData } = useWorkflows()
  const workflows = workflowsData?.items ?? []

  const { data, isLoading } = useWorkflowExecutions({
    workflow_id: workflowFilter || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })

  const executions = data?.items ?? []
  const stats = data?.stats

  const selectedWorkflowName = workflows.find((w) => w.id === workflowFilter)?.name

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'running', label: 'Running' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Failed' },
    { key: 'paused', label: 'Paused' },
  ]

  function openDetail(id: string) {
    setSelectedExecutionId(id)
    setDetailOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow Executions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {selectedWorkflowName
            ? `Showing executions for: ${selectedWorkflowName}`
            : 'Monitor and track all workflow execution history'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Executions" value={stats?.total ?? 0} color="text-gray-900 dark:text-white" loading={isLoading} />
        <StatCard label="Currently Running" value={stats?.running ?? 0} color="text-[#3ec9d6]" loading={isLoading} />
        <StatCard label="Completed Today" value={stats?.completed_today ?? 0} color="text-[#6fd943]" loading={isLoading} />
        <StatCard label="Failed" value={stats?.failed ?? 0} color="text-[#ff3a6e]" loading={isLoading} />
      </div>

      {/* Filters */}
      <Card>
        <div className="space-y-3">
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1">
            {statusTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={[
                  'px-3 py-1.5 text-sm rounded-[10px] font-medium transition-colors',
                  statusFilter === t.key
                    ? 'bg-[#51459d] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Workflow + date filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value)}
            >
              <option value="">All Workflows</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From Date</label>
              <input
                type="date"
                className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To Date</label>
              <input
                type="date"
                className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No executions found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Try adjusting your filters or trigger a workflow to see executions here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  {['Workflow Name', 'Started', 'Duration', 'Status', 'Steps', 'Triggered By', 'Actions'].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {executions.map((ex: WorkflowExecution) => (
                  <tr
                    key={ex.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                      {ex.workflow_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDateShort(ex.started_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono text-xs">
                      {formatDuration(ex.started_at, ex.completed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ex.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {ex.steps_completed.length}/{ex.total_steps} steps
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[140px] truncate">
                      {ex.triggered_by}
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => openDetail(ex.id)}>
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <ExecutionDetailModal
        executionId={selectedExecutionId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}
