import { useState, useEffect } from 'react'
import apiClient from '@/api/client'

interface ConsentConfig {
  consent_text: string
  required: boolean
  data_retention: string
  privacy_policy_url: string
}

interface FormConsentManagerProps {
  formId: string
}

const RETENTION_OPTIONS = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
  { value: 'forever', label: 'Forever' },
]

const DEFAULT_CONSENT_TEXT =
  'By submitting this form, I consent to the collection and processing of my personal data as described in the privacy policy.'

export default function FormConsentManager({ formId }: FormConsentManagerProps) {
  const [config, setConfig] = useState<ConsentConfig>({
    consent_text: DEFAULT_CONSENT_TEXT,
    required: true,
    data_retention: '90d',
    privacy_policy_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    async function fetchConsent() {
      try {
        const res = await apiClient.get<ConsentConfig>(`/forms/${formId}/consent`)
        setConfig(res.data)
        setConfigured(true)
      } catch {
        // No consent configured yet
        setConfigured(false)
      } finally {
        setLoading(false)
      }
    }
    fetchConsent()
  }, [formId])

  function update<K extends keyof ConsentConfig>(key: K, value: ConsentConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiClient.post(`/forms/${formId}/consent`, config)
      setConfigured(true)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10" style={{ fontFamily: 'Open Sans, sans-serif' }}>
        <div
          className="h-7 w-7 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: '#51459d', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'Open Sans, sans-serif' }}>
      {/* GDPR Status Badge */}
      <div className="flex items-center justify-between p-4 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">GDPR Status</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Consent configuration for this form
          </p>
        </div>
        <span
          className="px-3 py-1 text-xs font-semibold rounded-full text-white"
          style={{ backgroundColor: configured ? '#6fd943' : '#ffa21d' }}
        >
          {configured ? 'Consent configured' : 'Not configured'}
        </span>
      </div>

      {/* Consent Text */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
          Consent Text
        </label>
        <textarea
          rows={4}
          value={config.consent_text}
          onChange={(e) => update('consent_text', e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#51459d] resize-none"
          placeholder="Enter the consent statement respondents must agree to…"
        />
      </div>

      {/* Required Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-[10px]">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Required</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Respondents cannot submit without checking this
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.required}
          onClick={() => update('required', !config.required)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
            config.required ? 'bg-[#51459d]' : 'bg-gray-200 dark:bg-gray-600'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
              config.required ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Data Retention */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
          Data Retention Period
        </label>
        <select
          value={config.data_retention}
          onChange={(e) => update('data_retention', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
        >
          {RETENTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          Response data will be automatically purged after this period.
        </p>
      </div>

      {/* Privacy Policy URL */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
          Privacy Policy URL
        </label>
        <input
          type="url"
          value={config.privacy_policy_url}
          onChange={(e) => update('privacy_policy_url', e.target.value)}
          placeholder="https://your-org.com/privacy"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
        />
      </div>

      {/* Consent Preview */}
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
          Preview
        </p>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-[10px] bg-gray-50 dark:bg-gray-800/50">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              disabled
              className="mt-0.5 accent-[#51459d]"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              {config.consent_text || DEFAULT_CONSENT_TEXT}
              {config.privacy_policy_url && (
                <>
                  {' '}
                  <span className="text-[#51459d] underline cursor-pointer">
                    Privacy Policy
                  </span>
                </>
              )}
              {config.required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </span>
          </label>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-5 py-2 text-sm font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#51459d' }}
        >
          {saving ? 'Saving…' : savedMsg ? 'Saved ✓' : 'Save Consent Settings'}
        </button>
      </div>
    </div>
  )
}
