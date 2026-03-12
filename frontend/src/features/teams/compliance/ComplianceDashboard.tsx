import { useState } from 'react'
import {
  useRetentionPolicies,
  useCreateRetentionPolicy,
  useDLPRules,
  useCreateDLPRule,
  useToggleDLPRule,
  useDLPViolations,
  useResolveDLPViolation,
  useEDiscoverySearch,
  useChatAuditLogs,
} from '@/api/chatExtended'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RetentionPolicy {
  id: string
  name: string
  retention_days: number
  scope: string
  created_at: string
}

interface DLPRule {
  id: string
  name: string
  pattern: string
  action: string
  enabled: boolean
  created_at: string
}

interface DLPViolation {
  id: string
  rule_name: string
  user_name: string
  channel_name: string
  matched_content: string
  is_resolved: boolean
  created_at: string
}

interface AuditLogEntry {
  id: string
  actor: string
  action: string
  target: string
  details: string
  timestamp: string
}

interface EDiscoveryResult {
  id: string
  sender: string
  channel: string
  content: string
  timestamp: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

type TabKey = 'retention' | 'dlp' | 'violations' | 'ediscovery' | 'audit'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'retention', label: 'Retention' },
  { key: 'dlp', label: 'DLP Rules' },
  { key: 'violations', label: 'Violations' },
  { key: 'ediscovery', label: 'eDiscovery' },
  { key: 'audit', label: 'Audit Log' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-[10px] p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function RetentionTab() {
  const { data: policies, isLoading } = useRetentionPolicies()
  const createPolicy = useCreateRetentionPolicy()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', retention_days: 90, scope: 'all' })

  const handleCreate = () => {
    createPolicy.mutate(form, {
      onSuccess: () => {
        setShowForm(false)
        setForm({ name: '', retention_days: 90, scope: 'all' })
      },
    })
  }

  const items: RetentionPolicy[] = policies ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Retention Policies</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs font-medium bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
        >
          {showForm ? 'Cancel' : 'New Policy'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-[10px] p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Policy Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Standard 90-day retention"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Retention (days)</label>
              <input
                type="number"
                min={1}
                value={form.retention_days}
                onChange={(e) => setForm({ ...form, retention_days: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Scope</label>
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 bg-white"
              >
                <option value="all">All Channels</option>
                <option value="public">Public Only</option>
                <option value="private">Private Only</option>
                <option value="direct">Direct Messages</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={!form.name || createPolicy.isPending}
              className="px-4 py-2 text-xs font-medium bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
            >
              {createPolicy.isPending ? 'Creating...' : 'Create Policy'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-400 text-center py-8">Loading policies...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">No retention policies configured</div>
      ) : (
        <div className="space-y-2">
          {items.map((policy) => (
            <div
              key={policy.id}
              className="bg-white border border-gray-100 rounded-[10px] p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{policy.name}</p>
                <p className="text-xs text-gray-500">
                  {policy.retention_days} days &middot; Scope: {policy.scope} &middot; Created{' '}
                  {formatDate(policy.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-[6px] hover:bg-gray-50 transition-colors">
                  Edit
                </button>
                <button className="px-2.5 py-1 text-xs text-[#ff3a6e] border border-red-200 rounded-[6px] hover:bg-red-50 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DLPRulesTab() {
  const { data: rules, isLoading } = useDLPRules()
  const createRule = useCreateDLPRule()
  const toggleRule = useToggleDLPRule()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', pattern: '', action: 'block' })

  const handleCreate = () => {
    createRule.mutate(form, {
      onSuccess: () => {
        setShowForm(false)
        setForm({ name: '', pattern: '', action: 'block' })
      },
    })
  }

  const items: DLPRule[] = rules ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Data Loss Prevention Rules</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs font-medium bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
        >
          {showForm ? 'Cancel' : 'New Rule'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-[10px] p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Rule Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Block credit card numbers"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Pattern (Regex)</label>
            <input
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              placeholder="e.g. \b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"
              className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Action</label>
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 bg-white"
            >
              <option value="block">Block Message</option>
              <option value="redact">Redact Content</option>
              <option value="warn">Warn User</option>
              <option value="log">Log Only</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={!form.name || !form.pattern || createRule.isPending}
              className="px-4 py-2 text-xs font-medium bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
            >
              {createRule.isPending ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-400 text-center py-8">Loading rules...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">No DLP rules configured</div>
      ) : (
        <div className="space-y-2">
          {items.map((rule) => (
            <div
              key={rule.id}
              className="bg-white border border-gray-100 rounded-[10px] p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      rule.enabled
                        ? 'bg-[#6fd943]/15 text-[#4ea830]'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Action: {rule.action} &middot; Pattern:{' '}
                  <code className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded">
                    {rule.pattern.length > 40 ? rule.pattern.slice(0, 40) + '...' : rule.pattern}
                  </code>
                </p>
              </div>
              <button
                onClick={() => toggleRule.mutate(rule.id)}
                disabled={toggleRule.isPending}
                className={`ml-3 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  rule.enabled ? 'bg-[#6fd943]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    rule.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ViolationsTab() {
  const { data: violations, isLoading } = useDLPViolations({ is_resolved: false })
  const resolveViolation = useResolveDLPViolation()

  const items: DLPViolation[] = violations ?? []

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Recent DLP Violations</h3>

      {isLoading ? (
        <div className="text-sm text-gray-400 text-center py-8">Loading violations...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">No unresolved violations</div>
      ) : (
        <div className="space-y-2">
          {items.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-red-100 rounded-[10px] p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-[#ff3a6e] bg-[#ff3a6e]/10 px-1.5 py-0.5 rounded">
                      VIOLATION
                    </span>
                    <span className="text-xs font-medium text-gray-900">{v.rule_name}</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    User: <span className="font-medium">{v.user_name}</span> in{' '}
                    <span className="font-medium">#{v.channel_name}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1 font-mono bg-gray-50 px-2 py-1 rounded">
                    {v.matched_content.length > 100
                      ? v.matched_content.slice(0, 100) + '...'
                      : v.matched_content}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">{formatDate(v.created_at)}</p>
                </div>
                <button
                  onClick={() => resolveViolation.mutate(v.id)}
                  disabled={resolveViolation.isPending}
                  className="ml-3 px-3 py-1.5 text-xs font-medium text-[#6fd943] border border-[#6fd943]/30 rounded-[8px] hover:bg-[#6fd943]/10 disabled:opacity-50 transition-colors shrink-0"
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EDiscoveryTab() {
  const search = useEDiscoverySearch()
  const [form, setForm] = useState({
    query: '',
    from_user: '',
    channel: '',
    date_from: '',
    date_to: '',
  })

  const handleSearch = () => {
    const params: Record<string, string> = {}
    if (form.query) params.query = form.query
    if (form.from_user) params.from_user = form.from_user
    if (form.channel) params.channel = form.channel
    if (form.date_from) params.date_from = form.date_from
    if (form.date_to) params.date_to = form.date_to
    search.mutate(params)
  }

  const results: EDiscoveryResult[] = search.data ?? []

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">eDiscovery Search</h3>

      <div className="bg-gray-50 border border-gray-200 rounded-[10px] p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Search Query</label>
          <input
            value={form.query}
            onChange={(e) => setForm({ ...form, query: e.target.value })}
            placeholder="Search message content..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">From User</label>
            <input
              value={form.from_user}
              onChange={(e) => setForm({ ...form, from_user: e.target.value })}
              placeholder="Username"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Channel</label>
            <input
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              placeholder="Channel name"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Date From</label>
            <input
              type="date"
              value={form.date_from}
              onChange={(e) => setForm({ ...form, date_from: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Date To</label>
            <input
              type="date"
              value={form.date_to}
              onChange={(e) => setForm({ ...form, date_to: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSearch}
            disabled={search.isPending}
            className="px-4 py-2 text-xs font-medium bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
          >
            {search.isPending ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Sender</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Channel</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Content</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-3 text-xs text-gray-700">{r.sender}</td>
                  <td className="py-2 px-3 text-xs text-gray-700">#{r.channel}</td>
                  <td className="py-2 px-3 text-xs text-gray-600 max-w-xs truncate">{r.content}</td>
                  <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(r.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {search.isSuccess && results.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">No results found</div>
      )}
    </div>
  )
}

function AuditLogTab() {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const { data: logs, isLoading } = useChatAuditLogs(
    Object.keys(filters).length > 0 ? filters : undefined,
  )

  const items: AuditLogEntry[] = logs ?? []

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Chat Audit Log</h3>

      <div className="grid grid-cols-3 gap-3">
        <input
          placeholder="Filter by actor..."
          value={filters.actor ?? ''}
          onChange={(e) =>
            setFilters((f) => {
              const next = { ...f }
              if (e.target.value) next.actor = e.target.value
              else delete next.actor
              return next
            })
          }
          className="px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
        />
        <input
          placeholder="Filter by action..."
          value={filters.action ?? ''}
          onChange={(e) =>
            setFilters((f) => {
              const next = { ...f }
              if (e.target.value) next.action = e.target.value
              else delete next.action
              return next
            })
          }
          className="px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
        />
        <input
          type="date"
          value={filters.date ?? ''}
          onChange={(e) =>
            setFilters((f) => {
              const next = { ...f }
              if (e.target.value) next.date = e.target.value
              else delete next.date
              return next
            })
          }
          className="px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 text-center py-8">Loading audit logs...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">No audit log entries</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Actor</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Action</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Target</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Details</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-3 text-xs font-medium text-gray-700">{entry.actor}</td>
                  <td className="py-2 px-3">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3ec9d6]/15 text-[#2da8b4]">
                      {entry.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-xs text-gray-600">{entry.target}</td>
                  <td className="py-2 px-3 text-xs text-gray-500 max-w-xs truncate">{entry.details}</td>
                  <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(entry.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ComplianceDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('retention')

  const { data: policies } = useRetentionPolicies()
  const { data: dlpRules } = useDLPRules()
  const { data: violations } = useDLPViolations({ is_resolved: false })

  const totalPolicies = (policies as RetentionPolicy[] | undefined)?.length ?? 0
  const activeDLPRules =
    (dlpRules as DLPRule[] | undefined)?.filter((r) => r.enabled).length ?? 0
  const unresolvedViolations = (violations as DLPViolation[] | undefined)?.length ?? 0

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">Chat Compliance</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage retention policies, DLP rules, and review audit trails
        </p>
      </div>

      {/* Stats */}
      <div className="px-6 pt-4">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Policies" value={totalPolicies} color="#51459d" />
          <StatCard label="Active DLP Rules" value={activeDLPRules} color="#6fd943" />
          <StatCard label="Unresolved Violations" value={unresolvedViolations} color="#ff3a6e" />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-[#51459d] border-b-2 border-[#51459d]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'retention' && <RetentionTab />}
        {activeTab === 'dlp' && <DLPRulesTab />}
        {activeTab === 'violations' && <ViolationsTab />}
        {activeTab === 'ediscovery' && <EDiscoveryTab />}
        {activeTab === 'audit' && <AuditLogTab />}
      </div>
    </div>
  )
}
