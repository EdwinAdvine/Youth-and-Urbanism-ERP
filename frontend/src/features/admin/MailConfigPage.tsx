import { useState, useEffect } from 'react'
import { Card, Button, Spinner, toast } from '../../components/ui'
import {
  useMailConfig, useUpdateMailConfig,
  useMailPolicies, useUpdateMailPolicies,
  useMailSpamConfig, useUpdateMailSpamConfig,
  useMailQuotas, useUpdateMailQuotas,
  type MailServerConfig, type MailPolicies, type MailSpamConfig, type MailQuotas,
} from '../../api/adminConfig'

type Tab = 'server' | 'policies' | 'spam' | 'quotas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'server', label: 'Server Config' },
  { id: 'policies', label: 'Policies' },
  { id: 'spam', label: 'Spam Filter' },
  { id: 'quotas', label: 'Quotas' },
]

// ── Server Config Tab ───────────────────────────────────────────────────────

function ServerTab() {
  const { data, isLoading } = useMailConfig()
  const mutation = useUpdateMailConfig()
  const [form, setForm] = useState<MailServerConfig>({
    domain: 'localhost', tls_cert_path: '', tls_key_path: '',
    smtp_relay_host: '', smtp_relay_port: 587, smtp_relay_user: '',
    smtp_relay_password: '', smtp_relay_tls: true,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Mail server config saved'),
    onError: () => toast('error', 'Failed to save mail config'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Mail Server Configuration</h2>
      <div className="space-y-4 max-w-lg">
        <Field label="Mail Domain" value={form.domain} onChange={v => setForm({ ...form, domain: v })} />
        <Field label="TLS Certificate Path" value={form.tls_cert_path} onChange={v => setForm({ ...form, tls_cert_path: v })} placeholder="/etc/ssl/certs/mail.pem" />
        <Field label="TLS Key Path" value={form.tls_key_path} onChange={v => setForm({ ...form, tls_key_path: v })} placeholder="/etc/ssl/private/mail.key" />
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">SMTP Relay</p>
          <div className="space-y-3">
            <Field label="Relay Host" value={form.smtp_relay_host} onChange={v => setForm({ ...form, smtp_relay_host: v })} placeholder="smtp.relay.example.com" />
            <NumberField label="Relay Port" value={form.smtp_relay_port} onChange={v => setForm({ ...form, smtp_relay_port: v })} />
            <Field label="Relay Username" value={form.smtp_relay_user} onChange={v => setForm({ ...form, smtp_relay_user: v })} />
            <Field label="Relay Password" value={form.smtp_relay_password} onChange={v => setForm({ ...form, smtp_relay_password: v })} type="password" />
            <Toggle label="Use TLS" checked={form.smtp_relay_tls} onChange={v => setForm({ ...form, smtp_relay_tls: v })} />
          </div>
        </div>
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Server Config</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Policies Tab ────────────────────────────────────────────────────────────

function PoliciesTab() {
  const { data, isLoading } = useMailPolicies()
  const mutation = useUpdateMailPolicies()
  const [form, setForm] = useState<MailPolicies>({
    max_attachment_size_mb: 25, retention_days: 365,
    allowed_domains: [], blocked_domains: [], max_recipients_per_message: 100,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Mail policies saved'),
    onError: () => toast('error', 'Failed to save mail policies'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Mail Policies</h2>
      <div className="space-y-4 max-w-lg">
        <NumberField label="Max Attachment Size (MB)" value={form.max_attachment_size_mb} onChange={v => setForm({ ...form, max_attachment_size_mb: v })} />
        <NumberField label="Retention Days" value={form.retention_days} onChange={v => setForm({ ...form, retention_days: v })} />
        <NumberField label="Max Recipients Per Message" value={form.max_recipients_per_message} onChange={v => setForm({ ...form, max_recipients_per_message: v })} />
        <ListField label="Allowed Domains" value={form.allowed_domains} onChange={v => setForm({ ...form, allowed_domains: v })} placeholder="e.g. example.com" />
        <ListField label="Blocked Domains" value={form.blocked_domains} onChange={v => setForm({ ...form, blocked_domains: v })} placeholder="e.g. spam.com" />
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Policies</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Spam Tab ────────────────────────────────────────────────────────────────

function SpamTab() {
  const { data, isLoading } = useMailSpamConfig()
  const mutation = useUpdateMailSpamConfig()
  const [form, setForm] = useState<MailSpamConfig>({
    spam_threshold: 5.0, blocklist: [], allowlist: [],
    reject_on_spam: false, quarantine_enabled: true,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Spam configuration saved'),
    onError: () => toast('error', 'Failed to save spam config'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Spam Filter Configuration</h2>
      <div className="space-y-4 max-w-lg">
        <NumberField label="Spam Threshold Score" value={form.spam_threshold} onChange={v => setForm({ ...form, spam_threshold: v })} step={0.5} />
        <Toggle label="Reject on Spam" checked={form.reject_on_spam} onChange={v => setForm({ ...form, reject_on_spam: v })} />
        <Toggle label="Enable Quarantine" checked={form.quarantine_enabled} onChange={v => setForm({ ...form, quarantine_enabled: v })} />
        <ListField label="Blocklist (emails/domains)" value={form.blocklist} onChange={v => setForm({ ...form, blocklist: v })} placeholder="e.g. bad@spam.com" />
        <ListField label="Allowlist (emails/domains)" value={form.allowlist} onChange={v => setForm({ ...form, allowlist: v })} placeholder="e.g. trusted@partner.com" />
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Spam Config</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Quotas Tab ──────────────────────────────────────────────────────────────

function QuotasTab() {
  const { data, isLoading } = useMailQuotas()
  const mutation = useUpdateMailQuotas()
  const [form, setForm] = useState<MailQuotas>({
    default_quota_mb: 5120, per_user_overrides: {}, warn_at_percent: 90,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Mail quotas saved'),
    onError: () => toast('error', 'Failed to save mail quotas'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Mail Storage Quotas</h2>
      <div className="space-y-4 max-w-lg">
        <NumberField label="Default Quota (MB)" value={form.default_quota_mb} onChange={v => setForm({ ...form, default_quota_mb: v })} />
        <NumberField label="Warn at (%)" value={form.warn_at_percent} onChange={v => setForm({ ...form, warn_at_percent: v })} />
        <p className="text-xs text-gray-500">Per-user overrides can be set via the API (key = user email, value = quota in MB).</p>
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Quotas</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Shared field components ─────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
      />
    </div>
  )
}

function NumberField({ label, value, onChange, step }: {
  label: string; value: number; onChange: (v: number) => void; step?: number
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
      />
    </div>
  )
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary"
      />
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  )
}

function ListField({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  const [input, setInput] = useState('')
  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setInput('')
    }
  }
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
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

export default function MailConfigPage() {
  const [tab, setTab] = useState<Tab>('server')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Mail Administration</h1>
        <p className="text-sm text-gray-500 mt-1">Configure mail server, policies, spam filtering, and storage quotas</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-800">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${ tab === t.id ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-200' }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'server' && <ServerTab />}
      {tab === 'policies' && <PoliciesTab />}
      {tab === 'spam' && <SpamTab />}
      {tab === 'quotas' && <QuotasTab />}
    </div>
  )
}
