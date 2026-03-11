import { useState, useEffect } from 'react'
import { Card, Button, Spinner, toast } from '../../components/ui'
import {
  useDocsConfig, useUpdateDocsConfig,
  useDocsTemplates, useUpdateDocsTemplates,
  useDocsQuotas, useUpdateDocsQuotas,
  useDocsFileTypes, useUpdateDocsFileTypes,
  type DocsServerConfig, type DocsTemplates, type DocsQuotas, type DocsFileTypes,
} from '../../api/adminConfig'

type Tab = 'server' | 'templates' | 'quotas' | 'filetypes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'server', label: 'Server Config' },
  { id: 'templates', label: 'Templates' },
  { id: 'quotas', label: 'Quotas' },
  { id: 'filetypes', label: 'File Types' },
]

// ── Server Config Tab ───────────────────────────────────────────────────────

function ServerTab() {
  const { data, isLoading } = useDocsConfig()
  const mutation = useUpdateDocsConfig()
  const [form, setForm] = useState<DocsServerConfig>({
    onlyoffice_url: 'http://onlyoffice:80', jwt_secret: '', jwt_header: 'Authorization',
    max_file_size_mb: 100, autosave_enabled: true, autosave_interval_seconds: 300,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'ONLYOFFICE config saved'),
    onError: () => toast('error', 'Failed to save ONLYOFFICE config'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">ONLYOFFICE Server Configuration</h2>
      <div className="space-y-4 max-w-lg">
        <Field label="ONLYOFFICE Server URL" value={form.onlyoffice_url} onChange={v => setForm({ ...form, onlyoffice_url: v })} />
        <Field label="JWT Secret" value={form.jwt_secret} onChange={v => setForm({ ...form, jwt_secret: v })} type="password" />
        <Field label="JWT Header" value={form.jwt_header} onChange={v => setForm({ ...form, jwt_header: v })} />
        <NumberField label="Max File Size (MB)" value={form.max_file_size_mb} onChange={v => setForm({ ...form, max_file_size_mb: v })} />
        <Toggle label="Enable Autosave" checked={form.autosave_enabled} onChange={v => setForm({ ...form, autosave_enabled: v })} />
        <NumberField label="Autosave Interval (seconds)" value={form.autosave_interval_seconds} onChange={v => setForm({ ...form, autosave_interval_seconds: v })} />
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Server Config</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Templates Tab ───────────────────────────────────────────────────────────

function TemplatesTab() {
  const { data, isLoading } = useDocsTemplates()
  const mutation = useUpdateDocsTemplates()
  const [templates, setTemplates] = useState<DocsTemplates['templates']>([])
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('docx')
  const [newUrl, setNewUrl] = useState('')

  useEffect(() => { if (data) setTemplates(data.templates) }, [data])

  const addTemplate = () => {
    if (!newName.trim() || !newUrl.trim()) return
    setTemplates([...templates, { name: newName.trim(), type: newType, url: newUrl.trim() }])
    setNewName(''); setNewUrl('')
  }

  const removeTemplate = (idx: number) => setTemplates(templates.filter((_, i) => i !== idx))

  const save = () => mutation.mutate({ templates }, {
    onSuccess: () => toast('success', 'Document templates saved'),
    onError: () => toast('error', 'Failed to save templates'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">System Document Templates</h2>
      <div className="space-y-4 max-w-lg">
        {templates.length > 0 && (
          <div className="space-y-2">
            {templates.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-[10px] border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.type} &mdash; {t.url}</p>
                </div>
                <button onClick={() => removeTemplate(i)} className="text-sm text-red-500 hover:text-red-700">Remove</button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add Template</p>
          <div className="space-y-3">
            <Field label="Template Name" value={newName} onChange={setNewName} placeholder="e.g. Invoice Template" />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
              <select value={newType} onChange={e => setNewType(e.target.value)}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors">
                {['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <Field label="Template URL" value={newUrl} onChange={setNewUrl} placeholder="https://..." />
            <Button onClick={addTemplate} variant="secondary">Add Template</Button>
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Templates</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Quotas Tab ──────────────────────────────────────────────────────────────

function QuotasTab() {
  const { data, isLoading } = useDocsQuotas()
  const mutation = useUpdateDocsQuotas()
  const [form, setForm] = useState<DocsQuotas>({
    default_storage_quota_mb: 2048, per_user_overrides: {}, max_concurrent_editors: 20,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Docs quotas saved'),
    onError: () => toast('error', 'Failed to save docs quotas'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Document Storage Quotas</h2>
      <div className="space-y-4 max-w-lg">
        <NumberField label="Default Storage Quota (MB)" value={form.default_storage_quota_mb} onChange={v => setForm({ ...form, default_storage_quota_mb: v })} />
        <NumberField label="Max Concurrent Editors" value={form.max_concurrent_editors} onChange={v => setForm({ ...form, max_concurrent_editors: v })} />
        <p className="text-xs text-gray-500">Per-user overrides can be set via the API.</p>
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Quotas</Button>
        </div>
      </div>
    </Card>
  )
}

// ── File Types Tab ──────────────────────────────────────────────────────────

function FileTypesTab() {
  const { data, isLoading } = useDocsFileTypes()
  const mutation = useUpdateDocsFileTypes()
  const [form, setForm] = useState<DocsFileTypes>({
    allowed_document_types: ['docx', 'xlsx', 'pptx', 'pdf', 'odt', 'ods', 'odp', 'doc', 'xls', 'ppt', 'csv', 'txt', 'rtf'],
    allowed_image_types: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp'],
    enable_pdf_editing: false,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Document file types saved'),
    onError: () => toast('error', 'Failed to save file types'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Allowed Document Types</h2>
      <div className="space-y-4 max-w-lg">
        <ListField label="Document Types" value={form.allowed_document_types} onChange={v => setForm({ ...form, allowed_document_types: v })} placeholder="e.g. docx" />
        <ListField label="Image Types" value={form.allowed_image_types} onChange={v => setForm({ ...form, allowed_image_types: v })} placeholder="e.g. png" />
        <Toggle label="Enable PDF Editing" checked={form.enable_pdf_editing} onChange={v => setForm({ ...form, enable_pdf_editing: v })} />
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save File Types</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Shared components ───────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
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

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary/30 accent-primary" />
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
              <button onClick={() => onChange(value.filter(v => v !== item))} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DocsConfigPage() {
  const [tab, setTab] = useState<Tab>('server')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Docs Administration</h1>
        <p className="text-sm text-gray-500 mt-1">Configure ONLYOFFICE document server, templates, quotas, and file type restrictions</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-800">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-200 dark:hover:border-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'server' && <ServerTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'quotas' && <QuotasTab />}
      {tab === 'filetypes' && <FileTypesTab />}
    </div>
  )
}
