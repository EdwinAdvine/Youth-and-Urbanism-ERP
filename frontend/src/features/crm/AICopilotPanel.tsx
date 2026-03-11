import { useAIAgentRuns, type AIAgentRun } from '@/api/crm_ai_agents'
import { Badge, Card, Spinner } from '@/components/ui'

interface AICopilotPanelProps {
  entityType: string
  entityId: string
}

export function AICopilotPanel({ entityType, entityId }: AICopilotPanelProps) {
  const { data: runsData, isLoading } = useAIAgentRuns('all', {
    entity_type: entityType,
    entity_id: entityId,
    status: 'completed',
    limit: 10,
  })

  const runs: AIAgentRun[] = runsData?.items ?? runsData ?? []

  // Extract suggested actions from the latest completed runs
  const suggestedActions: { label: string; source: string }[] = []
  for (const run of runs.slice(0, 5)) {
    if (run.output_data) {
      const suggestions = (run.output_data as Record<string, unknown>).suggestions
      if (Array.isArray(suggestions)) {
        for (const s of suggestions) {
          suggestedActions.push({
            label: typeof s === 'string' ? s : String((s as Record<string, unknown>).label ?? s),
            source: run.trigger,
          })
        }
      }
      const nextAction = (run.output_data as Record<string, unknown>).next_action
      if (nextAction && typeof nextAction === 'string') {
        suggestedActions.push({ label: nextAction, source: run.trigger })
      }
    }
  }

  return (
    <div className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#51459d]/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#51459d] animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Copilot</h3>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Contextual suggestions for {entityType} {entityId.slice(0, 8)}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {/* Suggested Actions */}
          {suggestedActions.length > 0 && (
            <div className="p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#51459d] mb-2">
                Suggested Actions
              </h4>
              <ul className="space-y-2">
                {suggestedActions.slice(0, 5).map((action, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#6fd943] flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{action.label}</p>
                      <p className="text-xs text-gray-400">via {action.source}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent AI Activity */}
          <div className="p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Recent AI Activity
            </h4>
            {runs.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No recent AI activity for this record.</p>
            ) : (
              <ul className="space-y-2">
                {runs.slice(0, 5).map((run) => (
                  <li key={run.id}>
                    <Card className="p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {run.trigger}
                        </span>
                        <Badge
                          variant={
                            run.status === 'completed'
                              ? 'success'
                              : run.status === 'failed'
                              ? 'danger'
                              : 'info'
                          }
                        >
                          {run.status}
                        </Badge>
                      </div>
                      {run.output_data && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {(run.output_data as Record<string, unknown>).summary
                            ? String((run.output_data as Record<string, unknown>).summary)
                            : JSON.stringify(run.output_data).slice(0, 100)}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(run.started_at).toLocaleString()}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
