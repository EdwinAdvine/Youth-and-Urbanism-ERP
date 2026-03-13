import { useState } from 'react';
import { useAnalyticsOverview, useAnalyticsTrends } from '@/api/support_phase3';

type DateRange = '7d' | '30d' | '90d';

function getDateRange(range: DateRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (range === '7d') start.setDate(end.getDate() - 7);
  else if (range === '30d') start.setDate(end.getDate() - 30);
  else start.setDate(end.getDate() - 90);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) return <div className="h-8 text-xs text-gray-400">No data</div>;
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t"
          style={{
            height: `${Math.max(4, (v / max) * 32)}px`,
            backgroundColor: '#51459d',
            opacity: 0.6 + (i / values.length) * 0.4,
          }}
        />
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color,
  sparkValues,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  sparkValues?: number[];
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold mb-1" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {sparkValues && (
        <div className="mt-3">
          <Sparkline values={sparkValues} />
        </div>
      )}
    </div>
  );
}

function ChannelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="capitalize text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: '#51459d' }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsOverview() {
  const [range, setRange] = useState<DateRange>('30d');
  const { start, end } = getDateRange(range);
  const { data: overview, isLoading: loadingOverview } = useAnalyticsOverview(start, end);
  const { data: trends, isLoading: loadingTrends } = useAnalyticsTrends(start, end);

  const snapshot = overview?.[0] ?? null;
  const totalTickets = snapshot ? snapshot.new_tickets + snapshot.backlog_count : 0;
  const resolved = snapshot?.resolved_tickets ?? 0;
  const sla = snapshot?.sla_compliance_pct != null ? `${snapshot.sla_compliance_pct.toFixed(1)}%` : '—';
  const csat = snapshot?.avg_csat != null ? snapshot.avg_csat.toFixed(2) : '—';
  const backlog = snapshot?.backlog_count ?? 0;

  const trendResolved: number[] = trends?.map((t: { resolved_tickets: number }) => t.resolved_tickets) ?? [];
  const trendNew: number[] = trends?.map((t: { new_tickets: number }) => t.new_tickets) ?? [];

  const channelBreakdown: Record<string, number> = snapshot?.channel_breakdown ?? {};
  const channelMax = Math.max(...Object.values(channelBreakdown), 1);

  const ranges: DateRange[] = ['7d', '30d', '90d'];
  const rangeLabels: Record<DateRange, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overview of support performance metrics</p>
        </div>
        <div className="flex gap-2">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                range === r ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#51459d] hover:text-[#51459d]'
              }`}
              style={range === r ? { backgroundColor: '#51459d' } : {}}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {(loadingOverview || loadingTrends) && (
        <div className="text-center py-12 text-gray-400">Loading analytics…</div>
      )}

      {/* Metric Cards */}
      {!loadingOverview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard
            label="Total Tickets"
            value={totalTickets}
            color="#51459d"
            sparkValues={trendNew}
          />
          <MetricCard
            label="Resolved"
            value={resolved}
            color="#6fd943"
            sparkValues={trendResolved}
          />
          <MetricCard
            label="SLA Compliance"
            value={sla}
            color="#3ec9d6"
          />
          <MetricCard
            label="Avg CSAT"
            value={csat}
            sub="out of 5"
            color="#ffa21d"
          />
          <MetricCard
            label="Backlog"
            value={backlog}
            color="#ff3a6e"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        {!loadingTrends && trends && trends.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Ticket Volume Trend</h2>
            <div className="flex items-end gap-1 h-32">
              {trends.map(
                (t: { snapshot_date: string; new_tickets: number; resolved_tickets: number }, i: number) => {
                  const maxVal = Math.max(
                    ...trends.map((x: { new_tickets: number }) => x.new_tickets),
                    1
                  );
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(4, (t.new_tickets / maxVal) * 112)}px`,
                          backgroundColor: '#51459d',
                          opacity: 0.8,
                        }}
                        title={`New: ${t.new_tickets}`}
                      />
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(2, (t.resolved_tickets / maxVal) * 112)}px`,
                          backgroundColor: '#6fd943',
                          opacity: 0.7,
                          marginTop: '-2px',
                        }}
                        title={`Resolved: ${t.resolved_tickets}`}
                      />
                    </div>
                  );
                }
              )}
            </div>
            <div className="flex gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#51459d' }} />
                New
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#6fd943' }} />
                Resolved
              </span>
            </div>
          </div>
        )}

        {/* Channel Distribution */}
        {!loadingOverview && Object.keys(channelBreakdown).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Channel Distribution</h2>
            {Object.entries(channelBreakdown).map(([ch, val]) => (
              <ChannelBar key={ch} label={ch} value={val as number} max={channelMax} />
            ))}
          </div>
        )}
      </div>

      {/* Priority Breakdown */}
      {!loadingOverview && snapshot?.priority_breakdown && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Priority Breakdown</h2>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(snapshot.priority_breakdown).map(([p, v]) => {
              const colors: Record<string, string> = {
                low: '#6fd943',
                normal: '#3ec9d6',
                high: '#ffa21d',
                urgent: '#ff3a6e',
              };
              return (
                <div
                  key={p}
                  className="flex flex-col items-center px-5 py-3 rounded-xl border"
                  style={{ borderColor: colors[p] ?? '#51459d' }}
                >
                  <span className="text-2xl font-bold" style={{ color: colors[p] ?? '#51459d' }}>
                    {v as number}
                  </span>
                  <span className="text-xs text-gray-500 capitalize mt-0.5">{p}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
