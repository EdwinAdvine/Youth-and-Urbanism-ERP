import { useState, useEffect } from 'react'
import { Card, Button, Badge, Spinner, toast } from '../../components/ui'
import {
  useDriveQuotas, useUpdateDriveQuotas,
  useDriveFileTypes, useUpdateDriveFileTypes,
  useDriveRetention, useUpdateDriveRetention,
  useDriveHealth,
  type DriveQuotas, type DriveFileTypes, type DriveRetention,
} from '../../api/adminConfig'

type Tab = 'quotas' | 'filetypes' | 'retention' | 'health'

const TABS: { id: Tab; label: string }[] = [
  { id: 'quotas', label: 'Storage Quotas' },
  { id: 'filetypes', label: 'File Types' },
  { id: 'retention', label: 'Retention' },
  { id: 'health', label: 'Health' },
]

// ── Quotas Tab ──────────────────────────────────────────────────────────────

function QuotasTab() {
  const { data, isLoading } = useDriveQuotas()
  const mutation = useUpdateDriveQuotas()
  const [form, setForm] = useState<DriveQuotas>({
    default_storage_quota_mb: 10240, per_user_overrides: {}, per_team_overrides: {}, warn_at_percent: 90,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Drive quotas saved'),
    onError: () => toast('error', 'Failed to save drive quotas'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Storage Quotas</h2>
      <div className="space-y-4 max-w-lg">
        <NumberField label="Default Storage Quota (MB)" value={form.default_storage_quota_mb} onChange={v => setForm({ ...form, default_storage_quota_mb: v })} />
        <NumberField label="Warn at (%)" value={form.warn_at_percent} onChange={v => setForm({ ...form, warn_at_percent: v })} />
        <p className="text-xs text-gray-500">Per-user and per-team overrides can be set via the API.</p>
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Quotas</Button>
        </div>
      </div>
    </Card>
  )
}

// ── File Types Tab ──────────────────────────────────────────────────────────

function FileTypesTab() {
  const { data, isLoading } = useDriveFileTypes()
  const mutation = useUpdateDriveFileTypes()
  const [form, setForm] = useState<DriveFileTypes>({
    allowed_mime_types: [], blocked_mime_types: ['application/x-msdownload', 'application/x-executable'], max_file_size_mb: 500,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'File type rules saved'),
    onError: () => toast('error', 'Failed to save file type rules'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Allowed / Blocked File Types</h2>
      <div className="space-y-4 max-w-lg">
        <NumberField label="Max File Size (MB)" value={form.max_file_size_mb} onChange={v => setForm({ ...form, max_file_size_mb: v })} />
        <ListField label="Allowed MIME Types (empty = all allowed)" value={form.allowed_mime_types} onChange={v => setForm({ ...form, allowed_mime_types: v })} placeholder="e.g. application/pdf" />
        <ListField label="Blocked MIME Types" value={form.blocked_mime_types} onChange={v => setForm({ ...form, blocked_mime_types: v })} placeholder="e.g. application/x-msdownload" />
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save File Type Rules</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Retention Tab ───────────────────────────────────────────────────────────

function RetentionTab() {
  const { data, isLoading } = useDriveRetention()
  const mutation = useUpdateDriveRetention()
  const [form, setForm] = useState<DriveRetention>({
    auto_delete_trash_days: 30, version_retention_count: 10, version_retention_days: 90,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Retention policies saved'),
    onError: () => toast('error', 'Failed to save retention policies'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Retention Policies</h2>
      <div className="space-y-4 max-w-lg">
        <NumberField label="Auto-delete Trash After (days)" value={form.auto_delete_trash_days} onChange={v => setForm({ ...form, auto_delete_trash_days: v })} />
        <NumberField label="Max Version Count" value={form.version_retention_count} onChange={v => setForm({ ...form, version_retention_count: v })} />
        <NumberField label="Version Retention (days)" value={form.version_retention_days} onChange={v => setForm({ ...form, version_retention_days: v })} />
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Retention Policies</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Health Tab ───────────────────────────────────────────────────────────────

function HealthTab() {
  const { data, isLoading, refetch } = useDriveHealth()

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">MinIO Health Check</h2>
        <Button variant="secondary" onClick={() => refetch()}>Refresh</Button>
      </div>
      <div className="space-y-3 max-w-lg">
        <InfoRow label="Connection" value={
          data?.minio_connected
            ? <Badge variant="success">Connected</Badge>
            : <Badge variant="danger">Disconnected</Badge>
        } />
        <InfoRow label="MinIO URL" value={data?.minio_url || 'N/A'} />
        <InfoRow label="Total Buckets" value={String(data?.total_buckets ?? 0)} />
        <InfoRow label="Storage Used" value={data?.storage_used_display || '0 B'} />
      </div>
    </Card>
  )
}

// ── Shared components ───────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}

function NumberField({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
    </div>
  )
}

function ListField({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  const [input, setInput] = useState('')
  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) { onChange([...value, trimmed]); setInput('') }
  }
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
        <Button onClick={add} variant="secondary">Add</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map(item => (
            <span key={item} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-300">
              {item}
              <button onClick={() => onChange(value.filter(v => v !== item))} className="text-gray-400 hover:text-gray-600">&times;</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DriveConfigPage() {
  const [tab, setTab] = useState<Tab>('quotas')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Drive Administration</h1>
        <p className="text-sm text-gray-500 mt-1">Configure storage quotas, file type restrictions, retention policies, and check MinIO health</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-800">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${ tab === t.id ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-200' }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'quotas' && <QuotasTab />}
      {tab === 'filetypes' && <FileTypesTab />}
      {tab === 'retention' && <RetentionTab />}
      {tab === 'health' && <HealthTab />}
    </div>
  )
}
