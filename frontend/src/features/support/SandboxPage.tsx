import { useState } from 'react';
import {
  useSandboxes,
  useCreateSandbox,
  useRunSandboxTest,
  useDeleteSandbox,
  type SupportSandbox,
} from '@/api/support_phase3';

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
}

function isExpired(expires: string | null): boolean {
  if (!expires) return false;
  return new Date(expires) < new Date();
}

interface CreateDialogProps {
  onClose: () => void;
  onSave: (data: { name: string; description?: string; expires_at?: string }) => void;
  loading: boolean;
}

function CreateDialog({ onClose, onSave, loading }: CreateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create Sandbox</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Routing Test v2"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Expires At (optional)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSave({ name, description: description || undefined, expires_at: expiresAt || undefined })}
            disabled={!name || loading}
            className="px-5 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: '#51459d' }}
          >
            {loading ? 'Creating…' : 'Create Sandbox'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface RunTestDialogProps {
  sandboxId: string;
  onClose: () => void;
  onRun: (data: { id: string; test_ticket: Record<string, unknown> }) => void;
  loading: boolean;
  result: Record<string, unknown> | null;
}

function RunTestDialog({ sandboxId, onClose, onRun, loading, result }: RunTestDialogProps) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [channel, setChannel] = useState('email');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Run Sandbox Test</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Test ticket subject"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the test scenario…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                <option value="email">Email</option>
                <option value="chat">Chat</option>
                <option value="phone">Phone</option>
                <option value="web">Web</option>
              </select>
            </div>
          </div>

          {result && (
            <div className="bg-gray-50 rounded-lg p-3 mt-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">Test Result:</p>
              <pre className="text-xs text-gray-700 overflow-auto max-h-32">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
            Close
          </button>
          <button
            onClick={() =>
              onRun({
                id: sandboxId,
                test_ticket: { subject, description, priority, channel },
              })
            }
            disabled={!subject || loading}
            className="px-5 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: '#3ec9d6' }}
          >
            {loading ? 'Running…' : 'Run Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SandboxPage() {
  const { data: sandboxes, isLoading } = useSandboxes();
  const createSandbox = useCreateSandbox();
  const runTest = useRunSandboxTest();
  const deleteSandbox = useDeleteSandbox();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedSandbox, setSelectedSandbox] = useState<SupportSandbox | null>(null);
  const [testSandboxId, setTestSandboxId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);

  const list: SupportSandbox[] = sandboxes ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Sandboxes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Test configurations without affecting production</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2"
          style={{ backgroundColor: '#51459d' }}
        >
          <span className="text-lg leading-none">+</span> New Sandbox
        </button>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">Loading sandboxes…</div>}

      {!isLoading && list.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400 mb-2">No sandboxes yet.</p>
          <button onClick={() => setShowCreate(true)} className="text-sm underline" style={{ color: '#51459d' }}>
            Create your first sandbox
          </button>
        </div>
      )}

      <div className="space-y-4">
        {list.map((sb) => {
          const expired = isExpired(sb.expires_at);
          const statusColor = !sb.is_active ? '#9ca3af' : expired ? '#ff3a6e' : '#6fd943';
          const statusLabel = !sb.is_active ? 'Inactive' : expired ? 'Expired' : 'Active';
          const isExpanded = selectedSandbox?.id === sb.id;

          return (
            <div
              key={sb.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Summary row */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setSelectedSandbox(isExpanded ? null : sb)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-2 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: statusColor }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{sb.name}</h3>
                    {sb.description && (
                      <p className="text-xs text-gray-400 truncate">{sb.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: statusColor }}
                  >
                    {statusLabel}
                  </span>
                  <span className="text-xs text-gray-400">
                    Expires: {formatDate(sb.expires_at)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {sb.test_results?.length ?? 0} test{sb.test_results?.length !== 1 ? 's' : ''}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 pb-5">
                  <div className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Config snapshot */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-800">Config Snapshot</h4>
                        <button
                          onClick={() => setExpandedConfig(expandedConfig === sb.id ? null : sb.id)}
                          className="text-xs underline"
                          style={{ color: '#51459d' }}
                        >
                          {expandedConfig === sb.id ? 'Collapse' : 'View JSON'}
                        </button>
                      </div>
                      {expandedConfig === sb.id ? (
                        <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-auto max-h-40">
                          {JSON.stringify(sb.config_snapshot ?? {}, null, 2)}
                        </pre>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-400 text-center">
                          {sb.config_snapshot
                            ? `${Object.keys(sb.config_snapshot).length} config key(s)`
                            : 'No config snapshot'}
                        </div>
                      )}
                    </div>

                    {/* Test results */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-2">Test Results</h4>
                      {sb.test_results && sb.test_results.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {sb.test_results.map((r, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-2.5 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-gray-700">Test {i + 1}</span>
                                {r.passed != null && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-white font-medium"
                                    style={{ backgroundColor: r.passed ? '#6fd943' : '#ff3a6e', fontSize: '10px' }}
                                  >
                                    {r.passed ? 'Passed' : 'Failed'}
                                  </span>
                                )}
                              </div>
                              {r.summary != null && <p className="text-gray-500">{String(r.summary)}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4 text-center text-xs text-gray-400">
                          No tests run yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                    <button
                      onClick={(e) => { e.stopPropagation(); setTestSandboxId(sb.id); setTestResult(null); }}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: '#3ec9d6' }}
                    >
                      Run Test
                    </button>
                    {deleteConfirm === sb.id ? (
                      <>
                        <button
                          onClick={() => { deleteSandbox.mutate(sb.id); setDeleteConfirm(null); setSelectedSandbox(null); }}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(sb.id)}
                        className="px-4 py-2 rounded-lg text-sm border border-red-100 text-red-500 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCreate && (
        <CreateDialog
          onClose={() => setShowCreate(false)}
          onSave={(data) => createSandbox.mutate(data, { onSuccess: () => setShowCreate(false) })}
          loading={createSandbox.isPending}
        />
      )}

      {testSandboxId && (
        <RunTestDialog
          sandboxId={testSandboxId}
          onClose={() => { setTestSandboxId(null); setTestResult(null); }}
          onRun={(data) =>
            runTest.mutate(data, {
              onSuccess: (res) => setTestResult(res),
            })
          }
          loading={runTest.isPending}
          result={testResult}
        />
      )}
    </div>
  );
}
