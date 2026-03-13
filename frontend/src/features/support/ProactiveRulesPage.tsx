import { useState } from 'react';
import {
  useProactiveRules,
  useCreateProactiveRule,
  useToggleProactiveRule,
  useDeleteProactiveRule,
  type ProactiveRule,
} from '@/api/support_phase3';

const TRIGGER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  event: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Event' },
  schedule: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Schedule' },
  threshold: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Threshold' },
};

interface RuleDialogProps {
  initial?: Partial<ProactiveRule>;
  onClose: () => void;
  onSave: (data: Partial<ProactiveRule>) => void;
  loading: boolean;
}

function RuleDialog({ initial, onClose, onSave, loading }: RuleDialogProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [triggerType, setTriggerType] = useState<'event' | 'schedule' | 'threshold'>(
    initial?.trigger_type ?? 'event'
  );
  const [conditionsJson, setConditionsJson] = useState(
    initial?.trigger_conditions ? JSON.stringify(initial.trigger_conditions, null, 2) : '{}'
  );
  const [actionsJson, setActionsJson] = useState(
    initial?.actions ? JSON.stringify(initial.actions, null, 2) : '[]'
  );
  const [jsonError, setJsonError] = useState('');

  const handleSave = () => {
    try {
      const conditions = JSON.parse(conditionsJson);
      const actions = JSON.parse(actionsJson);
      setJsonError('');
      onSave({ name, description, trigger_type: triggerType, trigger_conditions: conditions, actions });
    } catch {
      setJsonError('Invalid JSON in conditions or actions.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{initial?.id ? 'Edit Rule' : 'Create Proactive Rule'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SLA breach alert"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type *</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as 'event' | 'schedule' | 'threshold')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            >
              <option value="event">Event</option>
              <option value="schedule">Schedule</option>
              <option value="threshold">Threshold</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Conditions (JSON)</label>
            <textarea
              value={conditionsJson}
              onChange={(e) => setConditionsJson(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actions (JSON array)</label>
            <textarea
              value={actionsJson}
              onChange={(e) => setActionsJson(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || loading}
            className="px-5 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#51459d' }}
          >
            {loading ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProactiveRulesPage() {
  const { data: rules, isLoading } = useProactiveRules();
  const createRule = useCreateProactiveRule();
  const toggleRule = useToggleProactiveRule();
  const deleteRule = useDeleteProactiveRule();

  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<ProactiveRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleSave = (data: Partial<ProactiveRule>) => {
    createRule.mutate(data, { onSuccess: () => setShowDialog(false) });
  };

  const ruleList: ProactiveRule[] = rules ?? [];

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : 'Never';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proactive Rules</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automate actions based on triggers and conditions</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowDialog(true); }}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2"
          style={{ backgroundColor: '#51459d' }}
        >
          <span className="text-lg leading-none">+</span> New Rule
        </button>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">Loading rules…</div>}

      {!isLoading && ruleList.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400 mb-2">No proactive rules yet.</p>
          <button
            onClick={() => { setEditTarget(null); setShowDialog(true); }}
            className="text-sm underline"
            style={{ color: '#51459d' }}
          >
            Create your first rule
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ruleList.map((rule) => {
          const tc = TRIGGER_COLORS[rule.trigger_type] ?? TRIGGER_COLORS.event;
          return (
            <div
              key={rule.id}
              className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{rule.name}</h3>
                  {rule.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{rule.description}</p>
                  )}
                </div>
                <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${tc.bg} ${tc.text}`}>
                  {tc.label}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => toggleRule.mutate(rule.id)}
                  disabled={toggleRule.isPending}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    rule.is_active ? 'bg-[#6fd943]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      rule.is_active ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className={`text-xs font-medium ${rule.is_active ? 'text-[#6fd943]' : 'text-gray-400'}`}>
                  {rule.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-gray-500">
                <div>
                  <span className="block text-gray-400">Executions</span>
                  <span className="font-semibold text-gray-700">{rule.execution_count}</span>
                </div>
                <div>
                  <span className="block text-gray-400">Last Triggered</span>
                  <span className="font-semibold text-gray-700">{formatDate(rule.last_triggered_at)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-50">
                <button
                  onClick={() => { setEditTarget(rule); setShowDialog(true); }}
                  className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Edit
                </button>
                {deleteConfirm === rule.id ? (
                  <div className="flex gap-1 flex-1">
                    <button
                      onClick={() => { deleteRule.mutate(rule.id); setDeleteConfirm(null); }}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-red-50 text-red-600 font-medium hover:bg-red-100"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(rule.id)}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showDialog && (
        <RuleDialog
          initial={editTarget ?? undefined}
          onClose={() => { setShowDialog(false); setEditTarget(null); }}
          onSave={handleSave}
          loading={createRule.isPending}
        />
      )}
    </div>
  );
}
