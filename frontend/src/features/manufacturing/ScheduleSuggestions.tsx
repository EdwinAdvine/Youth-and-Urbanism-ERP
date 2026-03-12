import { Card, Badge, Button } from '../../components/ui'
import { useScheduleSuggestions } from '../../api/manufacturing_ai'
import { useNavigate } from 'react-router-dom'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const severityColors: Record<string, BadgeVariant> = { high: 'danger', medium: 'warning', low: 'success' }

const ACTION_LINKS: Record<string, string> = {
  review_schedule: '/manufacturing/schedule',
  rebalance_workload: '/manufacturing/capacity',
  run_scheduler: '/manufacturing/schedule',
}

export default function ScheduleSuggestions() {
  const { data, isLoading, refetch } = useScheduleSuggestions()
  const navigate = useNavigate()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule Optimization Suggestions</h1>
        <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
      </div>

      {isLoading && <Card className="p-8 text-center">Generating suggestions...</Card>}

      {data && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">
            Generated at {new Date(data.generated_at).toLocaleString()}
          </div>
          {data.suggestions.map((s, i) => (
            <Card key={i} className={`p-4 border-l-4 ${s.severity === 'high' ? 'border-l-red-500' : s.severity === 'medium' ? 'border-l-yellow-400' : 'border-l-green-400'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={severityColors[s.severity] || 'default'} className="text-xs capitalize">
                      {s.severity}
                    </Badge>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">{s.type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm">{s.message}</p>
                </div>
                {s.action && ACTION_LINKS[s.action] && (
                  <Button size="sm" variant="outline" onClick={() => navigate(ACTION_LINKS[s.action!])}>
                    Take Action
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
