import { useState } from 'react';
import { useVoiceCalls, useCreateVoiceCall, type VoiceCall } from '@/api/support_phase3';

const DIRECTION_STYLES = {
  inbound: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Inbound' },
  outbound: { bg: 'bg-green-100', text: 'text-green-700', label: 'Outbound' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  ringing: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  missed: { bg: 'bg-red-100', text: 'text-red-600' },
  voicemail: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function formatDuration(seconds: number) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
}

interface NewCallDialogProps {
  onClose: () => void;
  onSave: (data: { customer_phone: string; customer_name?: string; direction: string }) => void;
  loading: boolean;
}

function NewCallDialog({ onClose, onSave, loading }: NewCallDialogProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [direction, setDirection] = useState('outbound');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Log New Call</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            >
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSave({ customer_phone: phone, customer_name: name || undefined, direction })}
            disabled={!phone || loading}
            className="px-5 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: '#51459d' }}
          >
            {loading ? 'Saving…' : 'Log Call'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VoiceCallPage() {
  const [dirFilter, setDirFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: callsData, isLoading } = useVoiceCalls({
    direction: dirFilter || undefined,
    status: statusFilter || undefined,
    page,
  });

  const createCall = useCreateVoiceCall();

  const calls: VoiceCall[] = callsData?.items ?? callsData ?? [];
  const total = callsData?.total ?? calls.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voice Calls</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} call records</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2"
          style={{ backgroundColor: '#51459d' }}
        >
          <span className="text-lg leading-none">+</span> Log Call
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={dirFilter}
          onChange={(e) => { setDirFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] bg-white"
        >
          <option value="">All Directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] bg-white"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="missed">Missed</option>
          <option value="in_progress">In Progress</option>
          <option value="ringing">Ringing</option>
          <option value="voicemail">Voicemail</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading calls…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {calls.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No calls found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Customer', 'Phone', 'Direction', 'Status', 'Duration', 'Agent', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {calls.map((call) => {
                    const ds = DIRECTION_STYLES[call.direction] ?? DIRECTION_STYLES.inbound;
                    const ss = STATUS_STYLES[call.status] ?? STATUS_STYLES.completed;
                    return (
                      <tr
                        key={call.id}
                        onClick={() => setSelectedId(call.id === selectedId ? null : call.id)}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedId === call.id ? 'bg-purple-50' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {call.customer_name ?? <span className="text-gray-400">Unknown</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                          {call.customer_phone ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ds.bg} ${ds.text}`}>
                            {ds.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ss.bg} ${ss.text}`}>
                            {call.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDuration(call.duration_seconds)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {call.agent_name ?? <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(call.started_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">Page {page}</span>
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
                  disabled={calls.length < 20}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showNew && (
        <NewCallDialog
          onClose={() => setShowNew(false)}
          onSave={(data) => createCall.mutate(data, { onSuccess: () => setShowNew(false) })}
          loading={createCall.isPending}
        />
      )}
    </div>
  );
}
