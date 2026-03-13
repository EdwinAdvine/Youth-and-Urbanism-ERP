import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

// ─── Types ────────────────────────────────────────────────────────────────────

type PublicFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'rating'
  | 'section_header'
  | 'description'
  | 'page_break'
  | string

interface PublicFieldOption {
  value: string
  label: string
}

interface PublicFormField {
  id: string
  label: string
  field_type: PublicFieldType
  is_required: boolean
  description: string | null
  placeholder: string | null
  options: string[] | null
  field_options: PublicFieldOption[]
  order: number
  metadata: Record<string, unknown> | null
}

interface ConsentConfig {
  consent_text: string
  required: boolean
  privacy_policy_url?: string
}

interface PublicForm {
  id: string
  title: string
  description: string | null
  settings: {
    theme?: {
      header_image?: string
      primary_color?: string
    }
    thank_you_message?: string
  } | null
  fields: PublicFormField[]
  consent?: ConsentConfig | null
}

// ─── No-auth API client ───────────────────────────────────────────────────────

const publicApi = axios.create({ baseURL: '/api/v1' })

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicFormPage() {
  const { shareToken } = useParams<{ shareToken: string }>()

  const [form, setForm] = useState<PublicForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [consentChecked, setConsentChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchForm() {
      if (!shareToken) {
        setNotFound(true)
        setLoading(false)
        return
      }
      try {
        const res = await publicApi.get<PublicForm>(`/forms/public/${shareToken}`)
        setForm(res.data)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchForm()
  }, [shareToken])

  function setAnswer(fieldId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  function handleCheckbox(fieldId: string, option: string, checked: boolean) {
    setAnswers((prev) => {
      const current = (prev[fieldId] as string[]) ?? []
      return {
        ...prev,
        [fieldId]: checked ? [...current, option] : current.filter((o) => o !== option),
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (form.consent?.required && !consentChecked) {
      setSubmitError('You must accept the consent to submit.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await publicApi.post(`/forms/${form.id}/responses`, { answers })
      setSubmitted(true)
    } catch {
      setSubmitError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const primaryColor = form?.settings?.theme?.primary_color ?? '#51459d'

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-50"
        style={{ fontFamily: 'Open Sans, sans-serif' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-9 w-9 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: primaryColor, borderTopColor: 'transparent' }}
          />
          <p className="text-sm text-gray-400">Loading form…</p>
        </div>
      </div>
    )
  }

  // ─── Not Found ────────────────────────────────────────────────────────────

  if (notFound || !form) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
        style={{ fontFamily: 'Open Sans, sans-serif' }}
      >
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-3xl">
            ✕
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Form not found</h1>
          <p className="text-sm text-gray-500">
            This form link may be expired, invalid, or the form has been removed.
          </p>
        </div>
      </div>
    )
  }

  // ─── Submitted ────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4"
        style={{ fontFamily: 'Open Sans, sans-serif' }}
      >
        <div className="bg-white rounded-[10px] shadow-lg px-8 py-10 max-w-md w-full text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-white text-2xl font-bold"
            style={{ backgroundColor: '#6fd943' }}
          >
            ✓
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
          <p className="text-sm text-gray-500">
            {form.settings?.thank_you_message ?? 'Your response has been submitted successfully.'}
          </p>
        </div>
        <PoweredBy />
      </div>
    )
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-gray-50 py-10 px-4"
      style={{ fontFamily: 'Open Sans, sans-serif' }}
    >
      <div className="max-w-xl mx-auto">
        {/* Form Card */}
        <div className="bg-white rounded-[10px] shadow-md overflow-hidden">
          {/* Header Image */}
          {form.settings?.theme?.header_image && (
            <img
              src={form.settings.theme.header_image}
              alt="Form header"
              className="w-full h-36 object-cover"
            />
          )}

          {/* Color Bar */}
          <div className="h-1.5" style={{ backgroundColor: primaryColor }} />

          {/* Title */}
          <div className="px-6 pt-6 pb-4">
            <h1 className="text-xl font-bold text-gray-900">{form.title}</h1>
            {form.description && (
              <p className="text-sm text-gray-500 mt-1.5">{form.description}</p>
            )}
          </div>

          {/* Fields */}
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
            {form.fields
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((field) => (
                <PublicField
                  key={field.id}
                  field={field}
                  value={answers[field.id]}
                  primaryColor={primaryColor}
                  onAnswer={setAnswer}
                  onCheckbox={handleCheckbox}
                />
              ))}

            {/* Consent */}
            {form.consent && (
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    required={form.consent.required}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#51459d]"
                  />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    {form.consent.consent_text}
                    {form.consent.privacy_policy_url && (
                      <>
                        {' '}
                        <a
                          href={form.consent.privacy_policy_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                          style={{ color: primaryColor }}
                        >
                          Privacy Policy
                        </a>
                      </>
                    )}
                    {form.consent.required && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </span>
                </label>
              </div>
            )}

            {submitError && (
              <p className="text-sm text-red-500">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-base font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50 mt-2"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </form>
        </div>

        <PoweredBy />
      </div>
    </div>
  )
}

// ─── Powered By Footer ────────────────────────────────────────────────────────

function PoweredBy() {
  return (
    <div className="mt-6 text-center">
      <p className="text-xs text-gray-400">
        Powered by{' '}
        <span className="font-semibold" style={{ color: '#51459d' }}>
          Y&amp;U ERP
        </span>
      </p>
    </div>
  )
}

// ─── Individual Field Renderer ────────────────────────────────────────────────

interface PublicFieldProps {
  field: PublicFormField
  value: unknown
  primaryColor: string
  onAnswer: (fieldId: string, value: unknown) => void
  onCheckbox: (fieldId: string, option: string, checked: boolean) => void
}

function PublicField({ field, value, primaryColor, onAnswer, onCheckbox }: PublicFieldProps) {
  const inputClass = `w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-[10px] bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-shadow`

  if (field.field_type === 'section_header') {
    return (
      <div className="border-b border-gray-200 pb-2 pt-2">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{field.label}</h3>
      </div>
    )
  }

  if (field.field_type === 'description') {
    return <p className="text-sm text-gray-500">{field.description ?? field.label}</p>
  }

  if (field.field_type === 'page_break') {
    return <hr className="border-gray-200" />
  }

  const labelEl = (
    <label className="block text-sm font-semibold text-gray-800 mb-1.5">
      {field.label}
      {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )

  if (field.field_type === 'textarea') {
    return (
      <div>
        {labelEl}
        {field.description && (
          <p className="text-xs text-gray-400 mb-1.5">{field.description}</p>
        )}
        <textarea
          rows={4}
          required={field.is_required}
          placeholder={field.placeholder ?? ''}
          value={String(value ?? '')}
          onChange={(e) => onAnswer(field.id, e.target.value)}
          className={`${inputClass} resize-none`}
          style={{ ['--tw-ring-color' as string]: primaryColor }}
        />
      </div>
    )
  }

  if (field.field_type === 'select' || field.field_type === 'dropdown') {
    const opts = resolveOptions(field)
    return (
      <div>
        {labelEl}
        <select
          required={field.is_required}
          value={String(value ?? '')}
          onChange={(e) => onAnswer(field.id, e.target.value)}
          className={inputClass}
        >
          <option value="">Select an option…</option>
          {opts.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.field_type === 'radio') {
    const opts = resolveOptions(field)
    return (
      <div>
        {labelEl}
        <div className="space-y-2 mt-1">
          {opts.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  value === opt.value ? 'border-[var(--primary)]' : 'border-gray-300'
                }`}
                style={
                  value === opt.value
                    ? ({ '--primary': primaryColor, borderColor: primaryColor } as React.CSSProperties)
                    : {}
                }
              >
                {value === opt.value && (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </div>
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                checked={value === opt.value}
                required={field.is_required}
                onChange={() => onAnswer(field.id, opt.value)}
                className="sr-only"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (field.field_type === 'checkbox') {
    const opts = resolveOptions(field)
    const selected = (value as string[]) ?? []
    return (
      <div>
        {labelEl}
        <div className="space-y-2 mt-1">
          {opts.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                value={opt.value}
                checked={selected.includes(opt.value)}
                onChange={(e) => onCheckbox(field.id, opt.value, e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: primaryColor }}
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (field.field_type === 'rating') {
    const max = (field.metadata?.max as number) ?? 5
    const current = Number(value ?? 0)
    return (
      <div>
        {labelEl}
        <div className="flex gap-1 mt-1">
          {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onAnswer(field.id, star)}
              className="text-2xl leading-none transition-colors focus:outline-none"
              style={{ color: star <= current ? '#ffa21d' : '#d1d5db' }}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Default text-based input
  const htmlType: React.HTMLInputTypeAttribute =
    field.field_type === 'email'
      ? 'email'
      : field.field_type === 'number'
      ? 'number'
      : field.field_type === 'date'
      ? 'date'
      : field.field_type === 'time'
      ? 'time'
      : field.field_type === 'datetime'
      ? 'datetime-local'
      : field.field_type === 'phone'
      ? 'tel'
      : field.field_type === 'url'
      ? 'url'
      : 'text'

  return (
    <div>
      {labelEl}
      {field.description && (
        <p className="text-xs text-gray-400 mb-1.5">{field.description}</p>
      )}
      <input
        type={htmlType}
        required={field.is_required}
        placeholder={field.placeholder ?? ''}
        value={String(value ?? '')}
        onChange={(e) => onAnswer(field.id, e.target.value)}
        className={inputClass}
      />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveOptions(field: PublicFormField): PublicFieldOption[] {
  if (field.field_options?.length) {
    return field.field_options.map((o) => ({ value: o.value, label: o.label }))
  }
  return (field.options ?? []).map((o) => ({ value: o, label: o }))
}
