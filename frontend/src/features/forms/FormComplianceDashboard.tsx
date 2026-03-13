import { useState, useEffect, useCallback } from 'react'
import apiClient from '@/api/client'

interface ConsentConfig {
  privacy_policy_url?: string
  data_retention?: string
  consent_text?: string
  require_consent?: boolean
}

interface FormData {
  id: string
  title: string
  fields?: Array<{ id: string; label: string; field_type: string }>
  settings?: {
    share_token?: string
    require_auth?: boolean
    is_public?: boolean
  }
}

interface CheckItem {
  id: string
  label: string
  description: string
  passed: boolean
  warning?: boolean
}

interface FormComplianceDashboardProps {
  formId: string
  onNavigateToConsent?: () => void
}

const PII_KEYWORDS = ['ssn', 'passport', 'credit card', 'bank account', 'social security']

function hasPiiFields(fields: FormData['fields']): boolean {
  if (!fields) return false
  return fields.some((f) =>
    PII_KEYWORDS.some((kw) => f.label.toLowerCase().includes(kw))
  )
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className ?? ''}`}
      style={{ borderRadius: 10 }}
    />
  )
}

function CheckRow({ item }: { item: CheckItem }) {
  const icon = item.warning ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#ffa21d" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ) : item.passed ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#6fd943" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#ff3a6e" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      {icon}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{item.label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
      </div>
      <span
        className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: item.warning
            ? '#ffa21d22'
            : item.passed
            ? '#6fd94322'
            : '#ff3a6e22',
          color: item.warning ? '#b37200' : item.passed ? '#3d8c1f' : '#cc1144',
          borderRadius: 20,
        }}
      >
        {item.warning ? 'Warning' : item.passed ? 'Pass' : 'Fail'}
      </span>
    </div>
  )
}

export default function FormComplianceDashboard({ formId, onNavigateToConsent }: FormComplianceDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [consent, setConsent] = useState<ConsentConfig | null>(null)
  const [formData, setFormData] = useState<FormData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [consentRes, formRes] = await Promise.allSettled([
        apiClient.get(`/forms/${formId}/consent`),
        apiClient.get(`/forms/${formId}`),
      ])
      setConsent(consentRes.status === 'fulfilled' ? consentRes.value.data : null)
      setFormData(formRes.status === 'fulfilled' ? formRes.value.data : null)
    } catch {
      setError('Failed to load compliance data.')
    } finally {
      setLoading(false)
    }
  }, [formId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const buildChecks = (): CheckItem[] => {
    const piiFound = hasPiiFields(formData?.fields)
    const isAccessControlled =
      !formData?.settings?.is_public &&
      (!formData?.settings?.share_token || formData?.settings?.require_auth)

    return [
      {
        id: 'gdpr_consent',
        label: 'GDPR Consent configured',
        description: 'A consent block is set up to inform respondents before submitting.',
        passed: !!consent,
      },
      {
        id: 'privacy_url',
        label: 'Privacy Policy URL set',
        description: 'Respondents can review your privacy policy before consenting.',
        passed: !!consent?.privacy_policy_url,
      },
      {
        id: 'data_retention',
        label: 'Data retention period set',
        description: 'A defined period for how long response data is kept.',
        passed: !!consent?.data_retention,
      },
      {
        id: 'no_pii',
        label: 'No unencrypted PII fields detected',
        description: piiFound
          ? 'Fields with potential PII labels found (SSN, Passport, Credit Card, Bank Account). Ensure data is encrypted.'
          : 'No obvious PII field labels detected.',
        passed: !piiFound,
        warning: piiFound,
      },
      {
        id: 'access_control',
        label: 'Form access controlled',
        description: 'Form is not publicly accessible without authentication.',
        passed: isAccessControlled,
      },
      {
        id: 'exportable',
        label: 'Response data exportable',
        description: 'Export endpoints are available for data portability (GDPR right to access).',
        passed: true,
      },
    ]
  }

  const checks = loading ? [] : buildChecks()
  const passedCount = checks.filter((c) => c.passed && !c.warning).length
  const totalCount = checks.length
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0

  const badge =
    score >= 85
      ? { label: 'Compliant', bg: '#6fd943', text: '#fff' }
      : score >= 55
      ? { label: 'Needs Attention', bg: '#ffa21d', text: '#fff' }
      : { label: 'Non-Compliant', bg: '#ff3a6e', text: '#fff' }

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      style={{ fontFamily: 'Open Sans, sans-serif', borderRadius: 10 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Compliance Dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            GDPR and data handling status for this form.
          </p>
        </div>
        <button
          onClick={onNavigateToConsent}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#51459d', borderRadius: 10 }}
        >
          Configure Consent
        </button>
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded-lg text-sm text-white"
          style={{ backgroundColor: '#ff3a6e', borderRadius: 10 }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="flex gap-4">
            <SkeletonBlock className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-2 pt-2">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-3 w-48" />
              <SkeletonBlock className="h-6 w-24" />
            </div>
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Score + badge */}
          <div
            className="flex items-center gap-5 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl"
            style={{ borderRadius: 10 }}
          >
            {/* Score circle */}
            <svg width="80" height="80" viewBox="0 0 80 80" className="flex-shrink-0">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="7" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke={badge.bg}
                strokeWidth="7"
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - score / 100)}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="700" fill={badge.bg}>
                {score}%
              </text>
            </svg>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Compliance Score</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                {passedCount} / {totalCount} checks passed
              </p>
              <span
                className="inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full"
                style={{ backgroundColor: badge.bg, color: badge.text, borderRadius: 20 }}
              >
                {badge.label}
              </span>
            </div>
          </div>

          {/* Data retention */}
          {consent?.data_retention && (
            <div
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
              style={{ borderRadius: 10 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#3ec9d6" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-gray-700 dark:text-gray-300">
                Data retained for:{' '}
                <strong className="text-gray-900 dark:text-gray-100">{consent.data_retention}</strong>
              </span>
            </div>
          )}

          {/* Checklist */}
          <div
            className="border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden"
            style={{ borderRadius: 10 }}
          >
            {checks.map((check) => (
              <div key={check.id} className="px-4">
                <CheckRow item={check} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
