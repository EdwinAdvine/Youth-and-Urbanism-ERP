import { useState } from 'react';
import {
  useAgentShifts,
  useCreateShift,
  useOnDutyAgents,
  useShiftCoverage,
  type AgentShift,
} from '@/api/support_phase3';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const SHIFT_COLORS = [
  '#51459d', '#3ec9d6', '#6fd943', '#ffa21d', '#ff3a6e', '#8b5cf6', '#06b6d4',
];


function parseHour(t: string): number {
  return parseInt(t.split(':')[0], 10);
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

interface AddShiftDialogProps {
  onClose: () => void;
  onSave: (data: Partial<AgentShift>) => void;
  loading: boolean;
}

function AddShiftDialog({ onClose, onSave, loading }: AddShiftDialogProps) {
  const [userId, setUserId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [timezone, setTimezone] = useState('UTC');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Shift</h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSave({ user_id: userId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, timezone, is_active: true })}
            disabled={!userId || loading}
            className="px-5 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: '#51459d' }}
          >
            {loading ? 'Saving…' : 'Add Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentSchedulePage() {
  const [selectedAgentId] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  const { data: shifts, isLoading: loadingShifts } = useAgentShifts(
    selectedAgentId !== 'all' ? selectedAgentId : ''
  );
  const { data: onDuty, isLoading: loadingOnDuty } = useOnDutyAgents();
  const { data: coverage } = useShiftCoverage();
  const createShift = useCreateShift();

  const allShifts: AgentShift[] = shifts ?? [];
  const onDutyList: { user_id: string; user_name: string }[] = onDuty ?? [];

  // Assign stable color per agent
  const agentColorMap = new Map<string, string>();
  allShifts.forEach((s) => {
    if (!agentColorMap.has(s.user_id)) {
      agentColorMap.set(s.user_id, SHIFT_COLORS[agentColorMap.size % SHIFT_COLORS.length]);
    }
  });

  // Build grid: day -> hour -> shifts
  const grid: Record<number, Record<number, AgentShift[]>> = {};
  DAYS.forEach((_, di) => {
    grid[di] = {};
    HOURS.forEach((h) => { grid[di][h] = []; });
  });
  allShifts.forEach((shift) => {
    const startH = parseHour(shift.start_time);
    const endH = parseHour(shift.end_time);
    for (let h = startH; h < endH && h < 24; h++) {
      if (!grid[shift.day_of_week]) grid[shift.day_of_week] = {};
      if (!grid[shift.day_of_week][h]) grid[shift.day_of_week][h] = [];
      grid[shift.day_of_week][h].push(shift);
    }
  });

  const VISIBLE_HOURS = HOURS.filter((h) => h >= 6 && h <= 22);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">Weekly shift grid</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2"
          style={{ backgroundColor: '#51459d' }}
        >
          <span className="text-lg leading-none">+</span> Add Shift
        </button>
      </div>

      <div className="flex gap-6">
        {/* Schedule Grid */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loadingShifts ? (
              <div className="text-center py-12 text-gray-400">Loading schedule…</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  {/* Header */}
                  <div className="flex border-b border-gray-100">
                    <div className="w-16 flex-shrink-0" />
                    {DAYS.map((d) => (
                      <div
                        key={d}
                        className="flex-1 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide border-l border-gray-100"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Hour rows */}
                  {VISIBLE_HOURS.map((h) => (
                    <div key={h} className="flex border-b border-gray-50 hover:bg-gray-50/50">
                      <div className="w-16 flex-shrink-0 py-2 px-2 text-right">
                        <span className="text-xs text-gray-400">{formatHour(h)}</span>
                      </div>
                      {DAYS.map((_, di) => {
                        const cellShifts = grid[di]?.[h] ?? [];
                        return (
                          <div
                            key={di}
                            className="flex-1 py-0.5 px-0.5 border-l border-gray-100 min-h-[28px]"
                          >
                            {cellShifts.slice(0, 2).map((s) => (
                              <div
                                key={s.id}
                                className="rounded text-white text-xs px-1 py-0.5 truncate mb-0.5 opacity-85"
                                style={{ backgroundColor: agentColorMap.get(s.user_id) ?? '#51459d' }}
                                title={`${s.user_name ?? s.user_id}: ${s.start_time}-${s.end_time}`}
                              >
                                {s.user_name ?? s.user_id.slice(0, 6)}
                              </div>
                            ))}
                            {cellShifts.length > 2 && (
                              <div className="text-xs text-gray-400 px-1">+{cellShifts.length - 2}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          {allShifts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from(agentColorMap.entries()).map(([userId, color]) => {
                const s = allShifts.find((x) => x.user_id === userId);
                return (
                  <span key={userId} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
                    {s?.user_name ?? userId.slice(0, 8)}
                  </span>
                );
              })}
            </div>
          )}

          {/* Coverage summary */}
          {coverage && (
            <div className="mt-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Coverage Summary</h3>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((d, i) => {
                  const dayData = coverage[i] ?? { covered_hours: 0, agent_count: 0 };
                  return (
                    <div key={d} className="text-center">
                      <p className="text-xs text-gray-500 mb-1">{d}</p>
                      <p className="text-sm font-bold" style={{ color: '#51459d' }}>{dayData.covered_hours ?? 0}h</p>
                      <p className="text-xs text-gray-400">{dayData.agent_count ?? 0} agents</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* On-duty sidebar */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm sticky top-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#6fd943] animate-pulse" />
              <h3 className="text-sm font-semibold text-gray-800">On Duty Now</h3>
            </div>
            {loadingOnDuty ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : onDutyList.length === 0 ? (
              <p className="text-xs text-gray-400">No agents currently on duty.</p>
            ) : (
              <div className="space-y-2">
                {onDutyList.map((a) => (
                  <div key={a.user_id} className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: agentColorMap.get(a.user_id) ?? '#51459d' }}
                    >
                      {(a.user_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 truncate">{a.user_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddShiftDialog
          onClose={() => setShowAdd(false)}
          onSave={(data) => createShift.mutate(data, { onSuccess: () => setShowAdd(false) })}
          loading={createShift.isPending}
        />
      )}
    </div>
  );
}
