import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStats, useAppConfig, useUpdateAppConfig } from '../../api/app-admin'
import { Card, Spinner, Button, Badge, toast } from '../../components/ui'

// ── App metadata ─────────────────────────────────────────────────────────────

interface AppMeta {
  label: string
  icon: string
  gradient: string
  description: string
}

const APP_META: Record<string, AppMeta> = {
  mail: {
    label: 'Y&U Mails',
    icon: '\u2709\ufe0f',
    gradient: 'from-blue-400 to-blue-600',
    description: 'Email service powered by Stalwart',
  },
  forms: {
    label: 'Y&U Forms',
    icon: '\ud83d\udccb',
    gradient: 'from-emerald-400 to-emerald-600',
    description: 'Form builder and response collection',
  },
  projects: {
    label: 'Y&U Projects',
    icon: '\ud83d\udcca',
    gradient: 'from-violet-400 to-violet-600',
    description: 'Project management with Kanban boards',
  },
  drive: {
    label: 'Y&U Drive',
    icon: '\ud83d\udcc1',
    gradient: 'from-amber-400 to-amber-600',
    description: 'File storage powered by MinIO',
  },
  calendar: {
    label: 'Y&U Calendar',
    icon: '\ud83d\udcc5',
    gradient: 'from-cyan-400 to-cyan-600',
    description: 'Event scheduling and management',
  },
  notes: {
    label: 'Y&U Notes',
    icon: '\ud83d\udcdd',
    gradient: 'from-pink-400 to-pink-600',
    description: 'Personal notes with rich text editing',
  },
  docs: {
    label: 'Y&U Docs',
    icon: '\ud83d\udcc4',
    gradient: 'from-indigo-400 to-indigo-600',
    description: 'Document editing with ONLYOFFICE',
  },
  teams: {
    label: 'Y&U Teams',
    icon: '\ud83c\udfa5',
    gradient: 'from-red-400 to-red-600',
    description: 'Video meetings powered by Jitsi',
  },
  analytics: {
    label: 'Y&U Analytics',
    icon: '\ud83d\udcc8',
    gradient: 'from-teal-400 to-teal-600',
    description: 'Business intelligence dashboards',
  },
  hr: {
    label: 'HR',
    icon: '\ud83d\udc65',
    gradient: 'from-orange-400 to-orange-600',
    description: 'Human resource management',
  },
  crm: {
    label: 'CRM',
    icon: '\ud83e\udd1d',
    gradient: 'from-lime-500 to-green-600',
    description: 'Customer relationship management',
  },
  finance: {
    label: 'Finance',
    icon: '\ud83d\udcb0',
    gradient: 'from-yellow-400 to-yellow-600',
    description: 'Financial management and accounting',
  },
  inventory: {
    label: 'Inventory',
    icon: '\ud83d\udce6',
    gradient: 'from-stone-400 to-stone-600',
    description: 'Inventory tracking and management',
  },
}

// ── Stat display helpers ─────────────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
  total_notes: 'Total Notes',
  pinned_notes: 'Pinned Notes',
  total_forms: 'Total Forms',
  published_forms: 'Published Forms',
  total_responses: 'Total Responses',
  total_fields: 'Total Fields',
  total_projects: 'Total Projects',
  active_projects: 'Active Projects',
  total_tasks: 'Total Tasks',
  completed_tasks: 'Completed Tasks',
  total_milestones: 'Milestones',
  total_time_logs: 'Time Logs',
  total_files: 'Total Files',
  total_folders: 'Total Folders',
  total_storage_bytes: 'Storage Used',
  public_files: 'Public Files',
  total_events: 'Total Events',
  total_meetings: 'Meetings',
  total_users: 'Total Users',
  active_users: 'Active Users',
}

const STAT_COLORS: string[] = [
  'bg-blue-50 text-blue-700',
  'bg-purple-50 text-purple-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
  'bg-cyan-50 text-cyan-700',
  'bg-pink-50 text-pink-700',
]

function formatStatValue(key: string, value: number | string): string {
  if (key === 'total_storage_bytes' && typeof value === 'number') {
    if (value === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(value) / Math.log(1024))
    return `${(value / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return String(value)
}

// ── Config display helpers ────────────────────────────────────────────────────

function formatConfigKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Mb\b/, 'MB')
    .replace(/Kb\b/, 'KB')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppAdminDashboard() {
  const { appName } = useParams<{ appName: string }>()
  const navigate = useNavigate()

  const { data: statsData, isLoading: statsLoading } = useAppStats(appName ?? '')
  const { data: configData, isLoading: configLoading } = useAppConfig(appName ?? '')
  const updateConfig = useUpdateAppConfig(appName ?? '')

  const [editingConfig, setEditingConfig] = useState(false)
  const [configDraft, setConfigDraft] = useState<Record<string, unknown>>({})

  const meta = appName ? APP_META[appName] : undefined

  if (!appName || !meta) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center text-4xl mb-4">?</div>
        <h1 className="text-2xl font-bold text-gray-900">Unknown Application</h1>
        <p className="text-gray-500 mt-2">The app "{appName}" is not recognized.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/admin')}>
          Back to Admin
        </Button>
      </div>
    )
  }

  const stats = statsData?.stats ?? {}
  const config = configData?.config ?? {}

  function handleStartEdit() {
    setConfigDraft({ ...config })
    setEditingConfig(true)
  }

  function handleCancelEdit() {
    setEditingConfig(false)
    setConfigDraft({})
  }

  async function handleSaveConfig() {
    try {
      await updateConfig.mutateAsync(configDraft)
      toast('success', 'Configuration updated successfully')
      setEditingConfig(false)
    } catch {
      toast('error', 'Failed to update configuration')
    }
  }

  function handleConfigChange(key: string, value: unknown) {
    setConfigDraft((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin')}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-3xl shadow-sm`}>
          {meta.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{meta.label} Admin</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meta.description}</p>
        </div>
        <Badge variant="primary" className="ml-auto">{appName}</Badge>
      </div>

      {/* Stats Section */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Statistics</h2>
        {statsLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : Object.keys(stats).length === 0 ? (
          <Card>
            <p className="text-gray-400 text-sm text-center py-4">No statistics available yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(stats).map(([key, value], idx) => (
              <Card key={key}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">
                      {STAT_LABELS[key] ?? formatConfigKey(key)}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {formatStatValue(key, value)}
                    </p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold ${
                      STAT_COLORS[idx % STAT_COLORS.length]
                    }`}
                  >
                    {typeof value === 'number' ? '#' : '~'}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Configuration Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Configuration</h2>
          {!editingConfig ? (
            <Button variant="outline" size="sm" onClick={handleStartEdit}>
              Edit Config
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button size="sm" loading={updateConfig.isPending} onClick={handleSaveConfig}>
                Save Changes
              </Button>
            </div>
          )}
        </div>
        {configLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : Object.keys(config).length === 0 ? (
          <Card>
            <p className="text-gray-400 text-sm text-center py-4">No configuration available.</p>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-gray-50">
              {Object.entries(editingConfig ? configDraft : config).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{formatConfigKey(key)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{key}</p>
                  </div>
                  <div className="ml-4">
                    {editingConfig ? (
                      <ConfigEditor
                        configKey={key}
                        value={configDraft[key] ?? value}
                        onChange={(v) => handleConfigChange(key, v)}
                      />
                    ) : (
                      <ConfigValue value={value} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Quick Links */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-3 p-3 rounded-[10px] border border-gray-100 hover:border-[#51459d]/30 hover:bg-[#51459d]/5 transition-colors text-left group"
          >
            <span className="text-xl">{'<'}</span>
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#51459d] transition-colors">
              Admin Dashboard
            </span>
          </button>
          <button
            onClick={() => navigate('/admin/app-admins')}
            className="flex items-center gap-3 p-3 rounded-[10px] border border-gray-100 hover:border-[#51459d]/30 hover:bg-[#51459d]/5 transition-colors text-left group"
          >
            <span className="text-xl">{'\ud83d\udee1\ufe0f'}</span>
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#51459d] transition-colors">
              App Admins
            </span>
          </button>
          <button
            onClick={() => navigate('/admin/audit-logs')}
            className="flex items-center gap-3 p-3 rounded-[10px] border border-gray-100 hover:border-[#51459d]/30 hover:bg-[#51459d]/5 transition-colors text-left group"
          >
            <span className="text-xl">{'\ud83d\udccb'}</span>
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#51459d] transition-colors">
              Audit Logs
            </span>
          </button>
        </div>
      </Card>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ConfigValue({ value }: { value: unknown }) {
  if (typeof value === 'boolean') {
    return (
      <Badge variant={value ? 'success' : 'default'}>
        {value ? 'Enabled' : 'Disabled'}
      </Badge>
    )
  }
  if (Array.isArray(value)) {
    return (
      <span className="text-sm text-gray-600">
        {value.length === 0 ? 'None' : value.join(', ')}
      </span>
    )
  }
  return <span className="text-sm font-medium text-gray-900">{String(value)}</span>
}

function ConfigEditor({
  value,
  onChange,
}: {
  configKey?: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (typeof value === 'boolean') {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-[#6fd943]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    )
  }
  if (typeof value === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-[10px] border border-gray-200 px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
      />
    )
  }
  if (typeof value === 'string') {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-40 rounded-[10px] border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
      />
    )
  }
  // Fallback: show JSON
  return (
    <span className="text-xs text-gray-400 font-mono">{JSON.stringify(value)}</span>
  )
}
