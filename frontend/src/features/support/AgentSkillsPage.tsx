import { useState } from 'react';
import {
  useAgentSkills,
  useCreateSkill,
  useDeleteSkill,
  useSkillBasedRouting,
  type AgentSkill,
} from '@/api/support_phase3';

type ViewMode = 'by_skill' | 'by_agent';

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className="w-4 h-4"
          fill={s <= score ? '#ffa21d' : 'none'}
          stroke={s <= score ? '#ffa21d' : '#d1d5db'}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ))}
    </div>
  );
}

interface AddSkillDialogProps {
  onClose: () => void;
  onSave: (data: Partial<AgentSkill>) => void;
  loading: boolean;
}

function AddSkillDialog({ onClose, onSave, loading }: AddSkillDialogProps) {
  const [userId, setUserId] = useState('');
  const [skillName, setSkillName] = useState('');
  const [proficiency, setProficiency] = useState(3);
  const [isPrimary, setIsPrimary] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [languages, setLanguages] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Agent Skill</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent ID *</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User UUID"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skill Name *</label>
            <input
              type="text"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              placeholder="e.g. Technical Support, Billing"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proficiency: {proficiency}/5
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setProficiency(s)}
                  className="focus:outline-none"
                >
                  <svg
                    className="w-7 h-7 transition-colors"
                    fill={s <= proficiency ? '#ffa21d' : 'none'}
                    stroke={s <= proficiency ? '#ffa21d' : '#d1d5db'}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Concurrent</label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              />
            </div>
            <div className="flex items-end pb-2 gap-2">
              <input
                id="primary"
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="w-4 h-4 accent-[#51459d]"
              />
              <label htmlFor="primary" className="text-sm text-gray-700">Primary Skill</label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Languages (comma-separated)</label>
            <input
              type="text"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="en, es, fr"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                user_id: userId,
                skill_name: skillName,
                proficiency,
                is_primary: isPrimary,
                max_concurrent: maxConcurrent,
                languages: languages ? languages.split(',').map((l) => l.trim()) : null,
              })
            }
            disabled={!userId || !skillName || loading}
            className="px-5 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: '#51459d' }}
          >
            {loading ? 'Adding…' : 'Add Skill'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentSkillsPage() {
  const [view, setView] = useState<ViewMode>('by_skill');
  const [showAdd, setShowAdd] = useState(false);
  const [routeTicketId, setRouteTicketId] = useState('');
  const [routeResult, setRouteResult] = useState<string | null>(null);

  const { data: skills, isLoading } = useAgentSkills();
  const createSkill = useCreateSkill();
  const deleteSkill = useDeleteSkill();
  const routeTicket = useSkillBasedRouting();

  const allSkills: AgentSkill[] = skills ?? [];

  // Group by skill name
  const bySkill = allSkills.reduce<Record<string, AgentSkill[]>>((acc, s) => {
    if (!acc[s.skill_name]) acc[s.skill_name] = [];
    acc[s.skill_name].push(s);
    return acc;
  }, {});

  // Group by agent
  const byAgent = allSkills.reduce<Record<string, { name: string; skills: AgentSkill[] }>>((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = { name: s.user_name ?? s.user_id, skills: [] };
    acc[s.user_id].skills.push(s);
    return acc;
  }, {});

  const handleRoute = () => {
    if (!routeTicketId) return;
    routeTicket.mutate(routeTicketId, {
      onSuccess: (data) => setRouteResult(`Routed to: ${data?.agent_name ?? data?.agent_id ?? 'Agent found'}`),
      onError: () => setRouteResult('No available agent found.'),
    });
  };

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Agent Skills</h1>
          <p className="text-sm text-gray-500 mt-0.5">{allSkills.length} skill assignments</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2"
          style={{ backgroundColor: '#51459d' }}
        >
          <span className="text-lg leading-none">+</span> Add Skill
        </button>
      </div>

      {/* Skill-based routing */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Skill-Based Routing</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={routeTicketId}
            onChange={(e) => setRouteTicketId(e.target.value)}
            placeholder="Enter Ticket ID to route…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
          />
          <button
            onClick={handleRoute}
            disabled={!routeTicketId || routeTicket.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#3ec9d6' }}
          >
            {routeTicket.isPending ? 'Routing…' : 'Route Ticket'}
          </button>
        </div>
        {routeResult && (
          <p className="mt-2 text-sm font-medium" style={{ color: '#6fd943' }}>{routeResult}</p>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {(['by_skill', 'by_agent'] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {v === 'by_skill' ? 'By Skill' : 'By Agent'}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">Loading skills…</div>}

      {/* By Skill View */}
      {!isLoading && view === 'by_skill' && (
        <div className="space-y-4">
          {Object.keys(bySkill).length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
              No skills configured yet.
            </div>
          )}
          {Object.entries(bySkill).map(([skillName, agents]) => (
            <div key={skillName} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{skillName}</h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {agents.length} agent{agents.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-3">
                {agents.map((a) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ backgroundColor: '#51459d' }}
                      >
                        {(a.user_name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{a.user_name ?? a.user_id}</p>
                        <div className="flex gap-2 text-xs text-gray-400">
                          {a.is_primary && <span className="text-[#51459d] font-medium">Primary</span>}
                          <span>Max {a.max_concurrent} concurrent</span>
                          {a.languages && <span>{a.languages.join(', ')}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StarRating score={a.proficiency} />
                      <button
                        onClick={() => deleteSkill.mutate(a.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* By Agent View */}
      {!isLoading && view === 'by_agent' && (
        <div className="space-y-4">
          {Object.keys(byAgent).length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
              No agents with skills yet.
            </div>
          )}
          {Object.entries(byAgent).map(([agentId, { name, skills: agentSkills }]) => (
            <div key={agentId} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: '#51459d' }}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-400">{agentSkills.length} skill{agentSkills.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {agentSkills.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-700">{s.skill_name}</span>
                    <StarRating score={s.proficiency} />
                    {s.is_primary && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: '#51459d' }}>
                        Primary
                      </span>
                    )}
                    <button
                      onClick={() => deleteSkill.mutate(s.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-sm leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddSkillDialog
          onClose={() => setShowAdd(false)}
          onSave={(data) => createSkill.mutate(data, { onSuccess: () => setShowAdd(false) })}
          loading={createSkill.isPending}
        />
      )}
    </div>
  );
}
