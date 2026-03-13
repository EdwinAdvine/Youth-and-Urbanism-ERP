import { useState } from 'react';
import {
  useCustomerHealthScores,
  useComputeCustomerHealth,
  type CustomerHealth,
} from '@/api/support_phase3';

type RiskLevel = 'healthy' | 'at_risk' | 'critical' | '';

const RISK_CONFIG = {
  healthy: { label: 'Healthy', color: '#6fd943', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  at_risk: { label: 'At Risk', color: '#ffa21d', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  critical: { label: 'Critical', color: '#ff3a6e', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium" style={{ color }}>{Math.round(pct)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: CustomerHealth['risk_level'] }) {
  const cfg = RISK_CONFIG[level];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#6fd943' : score >= 40 ? '#ffa21d' : '#ff3a6e';
  return (
    <span className="font-bold text-lg" style={{ color }}>
      {Math.round(score)}
    </span>
  );
}

interface DetailPanelProps {
  customer: CustomerHealth;
  onClose: () => void;
}

function DetailPanel({ customer, onClose }: DetailPanelProps) {
  const cfg = RISK_CONFIG[customer.risk_level];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white h-full w-full max-w-md shadow-2xl overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">{customer.customer_email}</h2>
            <div className="mt-1">
              <RiskBadge level={customer.risk_level} />
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Overall Score */}
          <div className={`rounded-xl p-5 border ${cfg.border} ${cfg.bg} text-center`}>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: cfg.color }}>Overall Health Score</p>
            <p className="text-5xl font-bold" style={{ color: cfg.color }}>{Math.round(customer.overall_score)}</p>
            <p className="text-xs mt-1" style={{ color: cfg.color }}>/ 100</p>
          </div>

          {/* Sub-scores */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Score Breakdown</h3>
            <ScoreBar label="Engagement" value={customer.engagement_score} color="#51459d" />
            <ScoreBar label="Satisfaction" value={customer.satisfaction_score} color="#6fd943" />
            <ScoreBar label="Effort" value={customer.effort_score} color="#3ec9d6" />
          </div>

          {/* Key Metrics */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Tickets', value: customer.total_tickets },
                { label: 'Avg CSAT', value: customer.avg_csat != null ? customer.avg_csat.toFixed(2) : '—' },
                {
                  label: 'Avg Sentiment',
                  value: customer.avg_sentiment != null ? `${Math.round(customer.avg_sentiment * 100)}%` : '—',
                },
                {
                  label: 'Churn Probability',
                  value: customer.churn_probability != null ? `${Math.round(customer.churn_probability * 100)}%` : '—',
                },
                {
                  label: 'Last Ticket',
                  value: customer.last_ticket_at ? new Date(customer.last_ticket_at).toLocaleDateString() : '—',
                },
                {
                  label: 'Ticket Frequency',
                  value: customer.ticket_frequency != null ? `${customer.ticket_frequency.toFixed(1)}/mo` : '—',
                },
              ].map((m) => (
                <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{m.label}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Score Factors */}
          {customer.score_factors && customer.score_factors.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Score Factors</h3>
              <div className="space-y-2">
                {customer.score_factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{f.factor}</span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: f.impact >= 0 ? '#6fd943' : '#ff3a6e' }}
                    >
                      {f.impact >= 0 ? '+' : ''}{f.impact.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Computed: {new Date(customer.computed_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CustomerHealthDashboard() {
  const [riskFilter, setRiskFilter] = useState<RiskLevel>('');
  const [page, setPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHealth | null>(null);

  const { data: healthData, isLoading } = useCustomerHealthScores(riskFilter || undefined, page);
  const computeHealth = useComputeCustomerHealth();

  const customers: CustomerHealth[] = healthData?.items ?? healthData ?? [];
  const total = healthData?.total ?? customers.length;

  // Count by risk level for the distribution chart
  const counts = customers.reduce(
    (acc, c) => { acc[c.risk_level] = (acc[c.risk_level] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const maxCount = Math.max(...Object.values(counts), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Health</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} customers tracked</p>
        </div>
        <button
          onClick={() => computeHealth.mutate(undefined)}
          disabled={computeHealth.isPending}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2"
          style={{ backgroundColor: '#51459d' }}
        >
          {computeHealth.isPending ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Computing…
            </>
          ) : (
            'Compute Scores'
          )}
        </button>
      </div>

      {computeHealth.isSuccess && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white"
          style={{ backgroundColor: '#6fd943' }}
        >
          Scores computed successfully.
        </div>
      )}

      {/* Risk Distribution Chart */}
      {customers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Risk Distribution</h2>
          <div className="flex items-end gap-6 h-32">
            {(['healthy', 'at_risk', 'critical'] as const).map((level) => {
              const cfg = RISK_CONFIG[level];
              const count = counts[level] ?? 0;
              const barH = Math.max(12, (count / maxCount) * 112);
              return (
                <div
                  key={level}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                  onClick={() => setRiskFilter(riskFilter === level ? '' : level)}
                >
                  <span className="text-sm font-bold mb-1" style={{ color: cfg.color }}>{count}</span>
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 group-hover:opacity-80"
                    style={{
                      height: `${barH}px`,
                      backgroundColor: cfg.color,
                      outline: riskFilter === level ? `3px solid ${cfg.color}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                  <span className="text-xs text-gray-600 mt-2">{cfg.label}</span>
                </div>
              );
            })}
          </div>
          {riskFilter && (
            <p className="text-xs text-gray-400 mt-3">
              Filtering by: <strong>{RISK_CONFIG[riskFilter]?.label}</strong> —{' '}
              <button onClick={() => setRiskFilter('')} className="underline" style={{ color: '#51459d' }}>
                Clear filter
              </button>
            </p>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setRiskFilter(''); setPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            riskFilter === '' ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#51459d]'
          }`}
          style={riskFilter === '' ? { backgroundColor: '#51459d' } : {}}
        >
          All
        </button>
        {(['healthy', 'at_risk', 'critical'] as const).map((level) => {
          const cfg = RISK_CONFIG[level];
          return (
            <button
              key={level}
              onClick={() => { setRiskFilter(level); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                riskFilter === level ? 'text-white' : `bg-white ${cfg.text} ${cfg.border}`
              }`}
              style={riskFilter === level ? { backgroundColor: cfg.color, borderColor: cfg.color } : {}}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading customer health scores…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {customers.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>No customer health data yet.</p>
              <button
                onClick={() => computeHealth.mutate(undefined)}
                className="mt-2 text-sm underline"
                style={{ color: '#51459d' }}
              >
                Compute scores now
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {[
                      'Customer',
                      'Overall Score',
                      'Risk Level',
                      'Engagement',
                      'Satisfaction',
                      'Total Tickets',
                      'Last Ticket',
                      'Churn Risk',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...customers]
                    .sort((a, b) => a.overall_score - b.overall_score)
                    .map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCustomer(c)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-800">{c.customer_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBadge score={c.overall_score} />
                        </td>
                        <td className="px-4 py-3">
                          <RiskBadge level={c.risk_level} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{Math.round(c.engagement_score)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{Math.round(c.satisfaction_score)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{c.total_tickets}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {c.last_ticket_at ? new Date(c.last_ticket_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {c.churn_probability != null ? (
                            <span
                              className="font-medium"
                              style={{
                                color:
                                  c.churn_probability > 0.6
                                    ? '#ff3a6e'
                                    : c.churn_probability > 0.3
                                    ? '#ffa21d'
                                    : '#6fd943',
                              }}
                            >
                              {Math.round(c.churn_probability * 100)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Page {page} · {total} customers
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={customers.length < 20}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedCustomer && (
        <DetailPanel
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
