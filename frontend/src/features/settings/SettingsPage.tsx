import { useState, useEffect } from 'react'
import { Button, Card, Select, Badge, Spinner, toast } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import {
  useSystemSettings,
  useUpdateSystemSettings,
  useUserPreferences,
  useUpdatePreferences,
} from '../../api/settings'
import { useSharingPolicies } from '../../api/drive'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = 'general' | 'company' | 'notifications' | 'integrations' | 'sharing'

const ALL_TABS: { id: Tab; label: string; adminOnly: boolean }[] = [
  { id: 'general', label: 'General', adminOnly: false },
  { id: 'company', label: 'Company', adminOnly: true },
  { id: 'notifications', label: 'Notifications', adminOnly: true },
  { id: 'integrations', label: 'Integrations', adminOnly: true },
  { id: 'sharing', label: 'Sharing Policies', adminOnly: true },
]

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab() {
  const { data: prefs, isLoading } = useUserPreferences()
  const updatePrefs = useUpdatePreferences()

  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState('UTC')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)

  useEffect(() => {
    if (prefs) {
      setLanguage(prefs.language ?? 'en')
      setTimezone(prefs.timezone ?? 'UTC')
      setNotificationsEnabled(prefs.notifications_enabled ?? true)
      setEmailNotifications(prefs.email_notifications ?? true)
    }
  }, [prefs])

  const handleSave = () => {
    updatePrefs.mutate(
      { language, timezone, notifications_enabled: notificationsEnabled, email_notifications: emailNotifications },
      {
        onSuccess: () => toast('success', 'Preferences saved successfully'),
        onError: () => toast('error', 'Failed to save preferences'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">General Preferences</h2>
      <div className="space-y-5 max-w-lg">
        <Select
          label="Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          options={[
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'French' },
            { value: 'sw', label: 'Swahili' },
          ]}
        />

        <Select
          label="Timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          options={[
            { value: 'UTC', label: 'UTC' },
            { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
            { value: 'America/New_York', label: 'America/New_York (EST)' },
            { value: 'Europe/London', label: 'Europe/London (GMT)' },
          ]}
        />

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Notification Preferences</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enable in-app notifications</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enable email notifications</span>
          </label>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleSave}
            loading={updatePrefs.isPending}
            disabled={updatePrefs.isPending}
          >
            Save Preferences
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Company Tab ─────────────────────────────────────────────────────────────

function CompanyTab() {
  const { data: settings, isLoading } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

  const getVal = (key: string) =>
    settings?.find((s) => s.key === key)?.value ?? ''

  const [companyName, setCompanyName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD')
  const [fiscalYearStart, setFiscalYearStart] = useState('January')

  useEffect(() => {
    if (settings) {
      setCompanyName(getVal('company_name'))
      setCurrency(getVal('currency') || 'USD')
      setDateFormat(getVal('date_format') || 'YYYY-MM-DD')
      setFiscalYearStart(getVal('fiscal_year_start') || 'January')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const handleSave = () => {
    updateSettings.mutate(
      {
        items: [
          { key: 'company_name', value: companyName, category: 'company' },
          { key: 'currency', value: currency, category: 'company' },
          { key: 'date_format', value: dateFormat, category: 'company' },
          { key: 'fiscal_year_start', value: fiscalYearStart, category: 'company' },
        ],
      },
      {
        onSuccess: () => toast('success', 'Company settings saved'),
        onError: () => toast('error', 'Failed to save company settings'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Company Settings</h2>
      <div className="space-y-5 max-w-lg">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your company name"
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>

        <Select
          label="Default Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={[
            { value: 'USD', label: 'USD — US Dollar' },
            { value: 'KES', label: 'KES — Kenyan Shilling' },
            { value: 'EUR', label: 'EUR — Euro' },
            { value: 'GBP', label: 'GBP — British Pound' },
          ]}
        />

        <Select
          label="Date Format"
          value={dateFormat}
          onChange={(e) => setDateFormat(e.target.value)}
          options={[
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2025-03-10)' },
            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 03/10/2025)' },
            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 10/03/2025)' },
          ]}
        />

        <Select
          label="Fiscal Year Start"
          value={fiscalYearStart}
          onChange={(e) => setFiscalYearStart(e.target.value)}
          options={[
            { value: 'January', label: 'January' },
            { value: 'July', label: 'July' },
          ]}
        />

        <div className="pt-2">
          <Button
            onClick={handleSave}
            loading={updateSettings.isPending}
            disabled={updateSettings.isPending}
          >
            Save Company Settings
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Notifications Tab ───────────────────────────────────────────────────────

function NotificationsTab() {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl mb-4">
          📧
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Email Notification Templates</h3>
        <p className="text-sm text-gray-500 mt-2">
          Email notification templates coming soon.
        </p>
      </div>
    </Card>
  )
}

// ─── Integrations Tab ────────────────────────────────────────────────────────

const INTEGRATIONS = [
  { name: 'Ollama', description: 'Local AI inference engine', status: 'connected' },
  { name: 'MinIO', description: 'S3-compatible object storage', status: 'connected' },
  { name: 'Mail Engine', description: 'SMTP/IMAP + PostgreSQL', status: 'connected' },
]

function IntegrationsTab() {
  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Connected Services</h2>
      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="flex items-center justify-between p-4 rounded-[10px] border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{integration.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{integration.description}</p>
            </div>
            <Badge variant="success">Connected</Badge>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Sharing Policies Tab ────────────────────────────────────────────────────

function SharingPoliciesTab() {
  const { data: policies, isLoading } = useSharingPolicies()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (!policies) {
    return (
      <Card>
        <p className="text-sm text-gray-500">Unable to load sharing policies.</p>
      </Card>
    )
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Allow External Sharing', value: policies.allow_external_sharing ? 'Yes' : 'No' },
    { label: 'Allow Public Links', value: policies.allow_public_links ? 'Yes' : 'No' },
    { label: 'Default Link Expiry (days)', value: policies.default_link_expiry_days != null ? String(policies.default_link_expiry_days) : 'None' },
    { label: 'Max Link Expiry (days)', value: policies.max_link_expiry_days != null ? String(policies.max_link_expiry_days) : 'None' },
    { label: 'Allow File Drop', value: policies.allow_file_drop ? 'Yes' : 'No' },
    { label: 'Require Password for Links', value: policies.require_password_for_links ? 'Yes' : 'No' },
  ]

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Drive Sharing Policies</h2>
      <div className="max-w-lg">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-gray-50 dark:border-gray-800">
                <td className="py-3 pr-4 text-gray-500 font-medium">{row.label}</td>
                <td className="py-3 text-gray-900 dark:text-gray-100">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ─── Settings Page ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = user?.role === 'superadmin'
  const [activeTab, setActiveTab] = useState<Tab>('general')

  const visibleTabs = ALL_TABS.filter((t) => !t.adminOnly || isSuperAdmin)

  // If current tab is admin-only and user lost access, reset to general
  useEffect(() => {
    const current = ALL_TABS.find((t) => t.id === activeTab)
    if (current?.adminOnly && !isSuperAdmin) {
      setActiveTab('general')
    }
  }, [isSuperAdmin, activeTab])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your application and account settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-800">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${ activeTab === tab.id ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-200' }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'company' && isSuperAdmin && <CompanyTab />}
      {activeTab === 'notifications' && isSuperAdmin && <NotificationsTab />}
      {activeTab === 'integrations' && isSuperAdmin && <IntegrationsTab />}
      {activeTab === 'sharing' && isSuperAdmin && <SharingPoliciesTab />}
    </div>
  )
}
