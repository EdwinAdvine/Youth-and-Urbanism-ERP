import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button, Card, Select, Spinner, toast } from '../../components/ui'
import apiClient from '@/api/client'

interface RiskAssessmentSummary {
  id: string
  title: string
  risk_level: string
}

interface Scenario {
  id: string
  name: string
  scenario_type: 'optimistic' | 'base' | 'pessimistic'
  probability: number
  cost_impact: number
  revenue_impact: number
  delay_days: number
  description: string | null
}

interface SimulationResult {
  assessment_id: string
  simulated_at: string
  outcomes: {
    scenario_type: string
    expected_cost: number
    expected_revenue_loss: number
    expected_delay_days: number
    weighted_risk_score: number
  }[]
}

const scenarioConfig: Record<string, { label: string; bg: string; accent: string }> = {
  optimistic: { label: 'Optimistic', bg: 'bg-success/10', accent: 'text-success' },
  base: { label: 'Base Case', bg: 'bg-info/10', accent: 'text-info' },
  pessimistic: { label: 'Pessimistic', bg: 'bg-danger/10', accent: 'text-danger' },
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  )
}

export default function ScenarioSimulationPage() {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')
  const [simResult, setSimResult] = useState<SimulationResult | null>(null)

  const { data: assessmentsData, isLoading: loadingAssessments } = useQuery({
    queryKey: ['sc', 'risk-assessments-summary'],
    queryFn: () =>
      apiClient.get('/supply-chain/risk/assessments', { params: { limit: 100 } }).then((r) => r.data),
  })

  const { data: scenariosData, isLoading: loadingScenarios } = useQuery({
    queryKey: ['sc', 'scenarios', selectedAssessmentId],
    queryFn: () =>
      apiClient
        .get(`/supply-chain/risk/assessments/${selectedAssessmentId}/scenarios`)
        .then((r) => r.data),
    enabled: !!selectedAssessmentId,
  })

  const simulate = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/supply-chain/risk/assessments/${selectedAssessmentId}/simulate`)
        .then((r) => r.data),
    onSuccess: (data) => {
      setSimResult(data)
      toast('success', 'Simulation complete')
    },
    onError: () => toast('error', 'Simulation failed'),
  })

  const assessments: RiskAssessmentSummary[] = assessmentsData?.items ?? assessmentsData ?? []
  const scenarios: Scenario[] = scenariosData ?? []

  const TYPES: Array<'optimistic' | 'base' | 'pessimistic'> = ['optimistic', 'base', 'pessimistic']

  const getScenario = (type: 'optimistic' | 'base' | 'pessimistic') =>
    scenarios.find((s) => s.scenario_type === type)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Scenario Simulation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Simulate risk scenarios across optimistic, base, and pessimistic outcomes
          </p>
        </div>
      </div>

      {/* Assessment Selector */}
      <Card>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Risk Assessment
            </label>
            {loadingAssessments ? (
              <Spinner />
            ) : (
              <Select
                value={selectedAssessmentId}
                onChange={(e) => { setSelectedAssessmentId(e.target.value); setSimResult(null) }}
                options={[
                  { value: '', label: 'Choose an assessment...' },
                  ...assessments.map((a) => ({ value: a.id, label: a.title })),
                ]}
              />
            )}
          </div>
          <Button
            onClick={() => simulate.mutate()}
            loading={simulate.isPending}
            disabled={!selectedAssessmentId}
          >
            Run Simulation
          </Button>
        </div>
      </Card>

      {/* Scenario Cards Side by Side */}
      {selectedAssessmentId && (
        <>
          {loadingScenarios ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : scenarios.length === 0 ? (
            <Card>
              <p className="text-center text-gray-400 py-6 text-sm">
                No scenarios defined for this assessment
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TYPES.map((type) => {
                const scenario = getScenario(type)
                const config = scenarioConfig[type]
                return (
                  <Card key={type} className={config.bg}>
                    <div className="text-center mb-4">
                      <h3 className={`text-base font-bold ${config.accent}`}>{config.label}</h3>
                      {scenario && (
                        <p className="text-xs text-gray-500 mt-1">
                          Probability: {(scenario.probability * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                    {!scenario ? (
                      <p className="text-center text-gray-400 text-sm py-4">Not defined</p>
                    ) : (
                      <div className="space-y-4">
                        <MetricCard
                          label="Cost Impact"
                          value={`$${scenario.cost_impact.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                          accent={config.accent}
                        />
                        <MetricCard
                          label="Revenue Impact"
                          value={`$${scenario.revenue_impact.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                          accent={config.accent}
                        />
                        <MetricCard
                          label="Delay"
                          value={`${scenario.delay_days} days`}
                          accent={config.accent}
                        />
                        {scenario.description && (
                          <p className="text-xs text-gray-500 text-center mt-2 italic">
                            {scenario.description}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {/* Simulation Results */}
          {simResult && (
            <Card>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Simulation Results
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {simResult.outcomes.map((o) => {
                  const config = scenarioConfig[o.scenario_type] ?? { label: o.scenario_type, bg: '', accent: 'text-gray-900' }
                  return (
                    <div
                      key={o.scenario_type}
                      className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${config.bg}`}
                    >
                      <h4 className={`font-semibold text-sm mb-3 capitalize ${config.accent}`}>
                        {config.label}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Expected Cost:</span>
                          <span className="font-medium">${o.expected_cost.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Revenue Loss:</span>
                          <span className="font-medium">${o.expected_revenue_loss.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Delay:</span>
                          <span className="font-medium">{o.expected_delay_days} days</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                          <span className="text-gray-500">Risk Score:</span>
                          <span className={`font-bold ${config.accent}`}>
                            {o.weighted_risk_score.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Simulated at: {new Date(simResult.simulated_at).toLocaleString()}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
