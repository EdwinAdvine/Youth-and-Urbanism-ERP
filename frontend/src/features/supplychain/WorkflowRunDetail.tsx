import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Spinner, Badge, Card, toast,
} from '../../components/ui'
import {
  useWorkflowRun, useCancelWorkflowRun,
  type WorkflowStepItem,
} from '../../api/supplychain_ops'

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const RUN_STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default'> = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'warning',
}

const STEP_STATUS_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  pending: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', dot: 'bg-gray-400' },
  running: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-[#3ec9d6]', dot: 'bg-[#3ec9d6]' },
  completed: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-[#6fd943]', dot: 'bg-[#6fd943]' },
  failed: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-[#ff3a6e]', dot: 'bg-[#ff3a6e]' },
  skipped: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-600', dot: 'bg-gray-300' },
}

export default function WorkflowRunDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: run, isLoading } = useWorkflowRun(id ?? '')
  const cancelMutation = useCancelWorkflowRun()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!run) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Workflow run not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/supply-chain/workflows')}>
          Back to Workflows
        </Button>
      </div>
    )
  }

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(run.id)
      toast('success', 'Workflow run cancelled')
    } catch {
      toast('error', 'Failed to cancel workflow run')
    }
  }

  const steps = (run as unknown as { steps: WorkflowStepItem[] }).steps ?? []
  const sortedSteps = [...steps].sort((a, b) => a.step_index - b.step_index)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/supply-chain/workflows')}
            className="p-2 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workflow Run</h1>
              <Badge variant={RUN_STATUS_BADGE[run.status] ?? 'default'}>
                {run.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">ID: {run.id.slice(0, 12)}...</p>
          </div>
        </div>
        {run.status === 'running' && (
          <Button variant="danger" onClick={handleCancel} loading={cancelMutation.isPending}>
            Cancel Run
          </Button>
        )}
      </div>

      {/* Run Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Run Details</h2>
          <dl className="space-y-3">
            {[
              { label: 'Template ID', value: run.template_id.slice(0, 12) + '...' },
              { label: 'Status', value: run.status },
              { label: 'Started', value: formatDateTime(run.started_at) },
              { label: 'Completed', value: run.completed_at ? formatDateTime(run.completed_at) : 'In progress' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between">
                <dt className="text-sm text-gray-500">{item.label}</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        {run.error_message && (
          <Card className="border-[#ff3a6e]/30">
            <h2 className="text-base font-semibold text-[#ff3a6e] mb-2">Error</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono bg-red-50 dark:bg-red-900/20 p-3 rounded-[10px]">
              {run.error_message}
            </p>
          </Card>
        )}
        {!run.error_message && run.trigger_data && (
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Trigger Data</h2>
            <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-[10px] overflow-auto max-h-40">
              {JSON.stringify(run.trigger_data, null, 2)}
            </pre>
          </Card>
        )}
      </div>

      {/* Steps Timeline */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-6">
          Steps ({sortedSteps.length})
        </h2>
        {sortedSteps.length === 0 ? (
          <p className="text-sm text-gray-500">No steps recorded for this run.</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

            <div className="space-y-4">
              {sortedSteps.map((step) => {
                const colors = STEP_STATUS_COLORS[step.status] ?? STEP_STATUS_COLORS.pending
                return (
                  <div key={step.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-2.5 top-3 h-3 w-3 rounded-full ${colors.dot} ring-2 ring-white dark:ring-gray-900`} />

                    <div className={`rounded-[10px] border p-4 ${colors.bg} ${colors.border}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                            Step {step.step_index}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                            {step.action.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <Badge variant={RUN_STATUS_BADGE[step.status] ?? 'default'} >{step.status}</Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {step.started_at && <span>Started: {formatDateTime(step.started_at)}</span>}
                        {step.completed_at && <span>Completed: {formatDateTime(step.completed_at)}</span>}
                      </div>

                      {step.params && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-gray-500">Params:</span>
                          <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-900/50 p-2 rounded mt-1 overflow-auto max-h-24">
                            {JSON.stringify(step.params, null, 2)}
                          </pre>
                        </div>
                      )}

                      {step.result && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-gray-500">Result:</span>
                          <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-900/50 p-2 rounded mt-1 overflow-auto max-h-24">
                            {JSON.stringify(step.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
