import { useState } from 'react';
import { useAnalyticsAgents } from '@/api/support_phase3';

type SortKey = 'name' | 'resolved' | 'avg_response_min' | 'avg_csat' | 'resolution_rate';
type SortDir = 'asc' | 'desc';

interface AgentRow {
  user_id: string;
  name: string;
  resolved: number;
  avg_response_min: number;
  avg_csat: number;
  total_assigned?: number;
}

function getDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="ml-1" style={{ color: '#51459d' }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function CsatDot({ score }: { score: number }) {
  const color = score >= 4 ? '#6fd943' : score >= 3 ? '#ffa21d' : '#ff3a6e';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
      <span style={{ color }}>{score.toFixed(2)}</span>
    </span>
  );
}

export default function AnalyticsAgents() {
  const [days, setDays] = useState(30);
  const [sortKey, setSortKey] = useState<SortKey>('resolved');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const { start, end } = getDateRange(days);
  const { data, isLoading } = useAnalyticsAgents(start, end);

  const agents: AgentRow[] = data ?? [];

  const resolutionRate = (a: AgentRow) =>
    a.total_assigned && a.total_assigned > 0
      ? Math.round((a.resolved / a.total_assigned) * 100)
      : 0;

  const sorted = [...agents].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;
    if (sortKey === 'name') { aVal = a.name; bVal = b.name; }
    else if (sortKey === 'resolved') { aVal = a.resolved; bVal = b.resolved; }
    else if (sortKey === 'avg_response_min') { aVal = a.avg_response_min; bVal = b.avg_response_min; }
    else if (sortKey === 'avg_csat') { aVal = a.avg_csat; bVal = b.avg_csat; }
    else { aVal = resolutionRate(a); bVal = resolutionRate(b); }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const th = (label: string, key: SortKey) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
      onClick={() => toggleSort(key)}
    >
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </th>
  );

  const formatMinutes = (min: number) => {
    if (!min) return '—';
    if (min < 60) return `${Math.round(min)}m`;
    return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Leaderboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Performance metrics by support agent</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                days === d ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#51459d]'
              }`}
              style={days === d ? { backgroundColor: '#51459d' } : {}}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">Loading agent data…</div>}

      {!isLoading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {sorted.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No agent data for this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                    {th('Agent Name', 'name')}
                    {th('Tickets Resolved', 'resolved')}
                    {th('Avg Response Time', 'avg_response_min')}
                    {th('Avg CSAT', 'avg_csat')}
                    {th('Resolution Rate', 'resolution_rate')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((agent, idx) => {
                    const rate = resolutionRate(agent);
                    return (
                      <tr key={agent.user_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-400 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                              style={{ backgroundColor: '#51459d' }}
                            >
                              {agent.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                            <span className="font-medium text-gray-800">{agent.name ?? 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">{agent.resolved}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatMinutes(agent.avg_response_min)}</td>
                        <td className="px-4 py-3 text-sm">
                          {agent.avg_csat != null ? <CsatDot score={agent.avg_csat} /> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[80px]">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${rate}%`,
                                  backgroundColor: rate >= 70 ? '#6fd943' : rate >= 40 ? '#ffa21d' : '#ff3a6e',
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Top Resolver', value: sorted[0]?.name, sub: `${sorted[0]?.resolved} tickets`, color: '#6fd943' },
            {
              label: 'Best Response Time',
              value: [...sorted].sort((a, b) => a.avg_response_min - b.avg_response_min)[0]?.name,
              sub: formatMinutes([...sorted].sort((a, b) => a.avg_response_min - b.avg_response_min)[0]?.avg_response_min),
              color: '#3ec9d6',
            },
            {
              label: 'Highest CSAT',
              value: [...sorted].sort((a, b) => (b.avg_csat ?? 0) - (a.avg_csat ?? 0))[0]?.name,
              sub: ([...sorted].sort((a, b) => (b.avg_csat ?? 0) - (a.avg_csat ?? 0))[0]?.avg_csat ?? 0).toFixed(2),
              color: '#ffa21d',
            },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{item.label}</p>
              <p className="font-semibold text-gray-800">{item.value ?? '—'}</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: item.color }}>{item.sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
