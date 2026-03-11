import { useState } from 'react'
import {
  useAIAgentRuns,
  useApproveRun,
  useRejectRun,
  type AIAgentRun,
} from '@/api/crm_ai_agents'
import { useAIAgents } from '@/api/crm_ai_agents'
import { Button, Badge, Card, Spinner, Select, Table, toast } from '@/components/ui'

const STATUS_VARIANTS: Record<string, string> = {
  running: 'info',
  completed: 'success',
  failed: 'danger',
  needs_approval: 'warning',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'needs_approval', label: 'Needs Approval' },
]

function formatDate(dateStr: string | null) {
  if (!dateStr) return '---'
  return new Date(dateStr).toLocaleString()
}

export default function AIAgentRunsPage() {
  const params = new URLSearchParams(window.location.search)
  const agentConfigId = params.get('agent_config_id') ?? ''

  const [statusFilter, setStatusFilter] = useState('')
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  const { data: agents } = useAIAgents()
  const agentList = agents?.items ?? agents ?? []

  // Build agent name lookup
  const agentNames: Record<string, string> = {}
  for (const a of agentList) {
    agentNames[a.id] = a.name
  }

  // If no specific agent, fetch for 'all' with a sentinel
  const queryAgentId = agentConfigId || 'all'
  const queryParams: Record<string, unknown> = {}
  if (statusFilter) queryParams.status = statusFilter

  const { data: runsData, isLoading } = useAIAgentRuns(queryAgentId, queryParams)
  const approveRun = useApproveRun()
  const rejectRun = useRejectRun()

  const runs: AIAgentRun[] = runsData?.items ?? runsData ?? []

  async function handleApprove(run: AIAgentRun) {
    try {
      await approveRun.mutateAsync({ agentId: run.agent_config_id, runId: run.id })
      toast.success('Run approved')
    } catch {
      toast.error('Failed to approve run')
    }
  }

  async function handleReject(run: AIAgentRun) {
    try {
      await rejectRun.mutateAsync({ agentId: run.agent_config_id, runId: run.id })
      toast.success('Run rejected')
    } catch {
      toast.error('Failed to reject run')
    }
  }

  const columns = [
    {
      key: 'agent',
      label: 'Agent',
      render: (row: AIAgentRun) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {agentNames[row.agent_config_id] ?? row.agent_config_id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: AIAgentRun) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'trigger',
      label: 'Trigger',
      render: (row: AIAgentRun) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{row.trigger}</span>
      ),
    },
    {
      key: 'started_at',
      label: 'Started',
      render: (row: AIAgentRun) => (
        <span className="text-sm text-gray-500">{formatDate(row.started_at)}</span>
      ),
    },
    {
      key: 'completed_at',
      label: 'Completed',
      render: (row: AIAgentRun) => (
        <span className="text-sm text-gray-500">{formatDate(row.completed_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: AIAgentRun) =>
        row.status === 'needs_approval' ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-[#6fd943] hover:bg-[#5ec636] text-white"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                handleApprove(row)
              }}
              loading={approveRun.isPending}
            >
              Approve
            </Button>
            <Button
              size="sm"
              className="bg-[#ff3a6e] hover:bg-[#e6325f] text-white"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                handleReject(row)
              }}
              loading={rejectRun.isPending}
            >
              Reject
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Agent Runs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {agentConfigId
              ? `Run history for agent: ${agentNames[agentConfigId] ?? agentConfigId.slice(0, 8)}`
              : 'View all agent run history and approve pending runs'}
          </p>
        </div>
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={runs}
              loading={isLoading}
              emptyText="No agent runs found"
              keyExtractor={(row) => row.id}
              onRowClick={(row) =>
                setExpandedRunId(expandedRunId === row.id ? null : row.id)
              }
            />

            {/* Expanded detail panel */}
            {expandedRunId && (() => {
              const run = runs.find((r) => r.id === expandedRunId)
              if (!run) return null
              return (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Input Data</h4>
                    <pre className="text-xs bg-white dark:bg-gray-800 rounded-[10px] p-3 overflow-auto max-h-40 border border-gray-200 dark:border-gray-700">
                      {run.input_data ? JSON.stringify(run.input_data, null, 2) : 'null'}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Output Data</h4>
                    <pre className="text-xs bg-white dark:bg-gray-800 rounded-[10px] p-3 overflow-auto max-h-40 border border-gray-200 dark:border-gray-700">
                      {run.output_data ? JSON.stringify(run.output_data, null, 2) : 'null'}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Actions Taken</h4>
                    <pre className="text-xs bg-white dark:bg-gray-800 rounded-[10px] p-3 overflow-auto max-h-40 border border-gray-200 dark:border-gray-700">
                      {run.actions_taken ? JSON.stringify(run.actions_taken, null, 2) : 'null'}
                    </pre>
                  </div>
                  {run.error_message && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[#ff3a6e] mb-1">Error</h4>
                      <p className="text-sm text-[#ff3a6e]">{run.error_message}</p>
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </Card>
    </div>
  )
}
