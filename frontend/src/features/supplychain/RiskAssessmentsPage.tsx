import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Modal, Badge, Select, Spinner } from '../../components/ui'
import apiClient from '@/api/client'

interface RiskAssessment {
  id: string
  title: string
  category: string
  risk_level: string
  risk_score: number | null
  status: string
  description: string | null
  created_at: string
}

interface RiskScenario {
  id: string
  name: string
  scenario_type: string
  probability: number
  cost_impact: number
  revenue_impact: number
  delay_days: number
}

interface MitigationPlan {
  id: string
  title: string
  action_type: string
  status: string
  due_date: string | null
  owner_name: string | null
}

const riskLevelStyles: Record<string, { badge: 'default' | 'warning' | 'danger' | 'success'; dot: string }> = {
  critical: { badge: 'danger', dot: 'bg-danger' },
  high: { badge: 'warning', dot: 'bg-orange-400' },
  medium: { badge: 'warning', dot: 'bg-yellow-400' },
  low: { badge: 'success', dot: 'bg-success' },
}

export default function RiskAssessmentsPage() {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'scenarios' | 'mitigation'>('scenarios')

  const { data, isLoading } = useQuery({
    queryKey: ['sc', 'risk-assessments', categoryFilter, statusFilter],
    queryFn: () =>
      apiClient
        .get('/supply-chain/risk/assessments', {
          params: {
            ...(categoryFilter ? { category: categoryFilter } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        })
        .then((r) => r.data),
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['sc', 'risk-assessment', selectedId],
    queryFn: () =>
      apiClient.get(`/supply-chain/risk/assessments/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  })

  const assessments: RiskAssessment[] = data?.items ?? data ?? []
  const selectedAssessment = assessments.find((a) => a.id === selectedId)

  const scenarios: RiskScenario[] = detail?.scenarios ?? []
  const mitigations: MitigationPlan[] = detail?.mitigation_plans ?? []

  const columns = [
    {
      key: 'title',
      label: 'Risk',
      render: (r: RiskAssessment) => (
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${riskLevelStyles[r.risk_level]?.dot ?? 'bg-gray-400'}`}
          />
          <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{r.title}</span>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (r: RiskAssessment) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{r.category}</span>
      ),
    },
    {
      key: 'level',
      label: 'Risk Level',
      render: (r: RiskAssessment) => (
        <Badge variant={riskLevelStyles[r.risk_level]?.badge ?? 'default'}>
          {r.risk_level}
        </Badge>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      render: (r: RiskAssessment) => (
        <span className="text-sm font-mono font-medium">
          {r.risk_score != null ? r.risk_score.toFixed(1) : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: RiskAssessment) => (
        <Badge variant={r.status === 'closed' ? 'success' : r.status === 'active' ? 'warning' : 'default'}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: RiskAssessment) => (
        <button
          className="text-sm text-primary hover:underline"
          onClick={() => { setSelectedId(r.id); setDetailTab('scenarios') }}
        >
          Details
        </button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Risk Assessments</h1>
          <p className="text-sm text-gray-500 mt-1">Supply chain risk register</p>
        </div>
        <div className="flex gap-3">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: '', label: 'All Categories' },
              { value: 'supplier', label: 'Supplier' },
              { value: 'logistics', label: 'Logistics' },
              { value: 'demand', label: 'Demand' },
              { value: 'regulatory', label: 'Regulatory' },
              { value: 'financial', label: 'Financial' },
              { value: 'operational', label: 'Operational' },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'monitoring', label: 'Monitoring' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
        </div>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={assessments}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No risk assessments found"
        />
      </Card>

      <Modal
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={selectedAssessment?.title ?? 'Risk Assessment'}
        size="xl"
      >
        {detailLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {selectedAssessment && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Category:</span>{' '}
                  <span className="font-medium capitalize">{selectedAssessment.category}</span>
                </div>
                <div>
                  <span className="text-gray-500">Risk Level:</span>{' '}
                  <Badge variant={riskLevelStyles[selectedAssessment.risk_level]?.badge ?? 'default'}>
                    {selectedAssessment.risk_level}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-500">Score:</span>{' '}
                  <span className="font-medium">{selectedAssessment.risk_score?.toFixed(1) ?? '-'}</span>
                </div>
              </div>
            )}
            {selectedAssessment?.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAssessment.description}</p>
            )}

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
              {(['scenarios', 'mitigation'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`pb-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                    detailTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500'
                  }`}
                >
                  {tab === 'mitigation' ? 'Mitigation Plans' : 'Scenarios'}
                </button>
              ))}
            </div>

            {detailTab === 'scenarios' && (
              <div className="space-y-2">
                {scenarios.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No scenarios</p>
                ) : (
                  scenarios.map((s) => (
                    <div key={s.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-medium capitalize">{s.name} ({s.scenario_type})</span>
                        <span className="text-gray-500">P: {(s.probability * 100).toFixed(0)}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
                        <span>Cost: ${s.cost_impact.toFixed(0)}</span>
                        <span>Revenue: ${s.revenue_impact.toFixed(0)}</span>
                        <span>Delay: {s.delay_days}d</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'mitigation' && (
              <div className="space-y-2">
                {mitigations.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No mitigation plans</p>
                ) : (
                  mitigations.map((m) => (
                    <div key={m.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{m.title}</span>
                        <Badge variant={m.status === 'completed' ? 'success' : 'warning'}>
                          {m.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {m.owner_name && <span>Owner: {m.owner_name}</span>}
                        {m.due_date && (
                          <span className="ml-3">Due: {new Date(m.due_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
