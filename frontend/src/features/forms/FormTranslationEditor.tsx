import { useState, useEffect } from 'react'
import apiClient from '@/api/client'
import type { FormField } from '@/api/forms'

interface TranslationData {
  locale: string
  fields: Record<string, { label: string; description: string; options: Record<string, string> }>
}

interface FormTranslationEditorProps {
  formId: string
}

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'sw', label: 'Swahili' },
  { value: 'ar', label: 'Arabic' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
]

const CHOICE_TYPES = new Set([
  'select', 'checkbox', 'radio', 'dropdown', 'cascading_select', 'ranking',
])

export default function FormTranslationEditor({ formId }: FormTranslationEditorProps) {
  const [locale, setLocale] = useState('fr')
  const [fields, setFields] = useState<FormField[]>([])
  const [translations, setTranslations] = useState<
    Record<string, { label: string; description: string; options: Record<string, string> }>
  >({})
  const [loading, setLoading] = useState(true)
  const [translating, setTranslating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  async function loadData(targetLocale: string) {
    setLoading(true)
    try {
      // Load fields
      const formRes = await apiClient.get<{ fields: FormField[] }>(`/forms/${formId}`)
      const formFields = formRes.data.fields ?? []
      setFields(formFields)

      // Load existing translations for this locale
      try {
        const txRes = await apiClient.get<TranslationData>(
          `/forms/${formId}/translations?locale=${targetLocale}`
        )
        setTranslations(txRes.data.fields ?? {})
      } catch {
        // No translations yet — init empty
        const empty: typeof translations = {}
        formFields.forEach((f) => {
          empty[f.id] = {
            label: '',
            description: '',
            options: {},
          }
        })
        setTranslations(empty)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(locale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, locale])

  function setFieldTranslation(
    fieldId: string,
    key: 'label' | 'description',
    value: string
  ) {
    setTranslations((prev) => ({
      ...prev,
      [fieldId]: {
        ...(prev[fieldId] ?? { label: '', description: '', options: {} }),
        [key]: value,
      },
    }))
  }

  function setOptionTranslation(fieldId: string, optionVal: string, value: string) {
    setTranslations((prev) => ({
      ...prev,
      [fieldId]: {
        ...(prev[fieldId] ?? { label: '', description: '', options: {} }),
        options: {
          ...(prev[fieldId]?.options ?? {}),
          [optionVal]: value,
        },
      },
    }))
  }

  async function handleAITranslate() {
    setTranslating(true)
    try {
      const res = await apiClient.post<{ fields: typeof translations }>(
        `/forms/${formId}/translations/ai-generate?locale=${locale}`
      )
      if (res.data.fields) {
        setTranslations(res.data.fields)
      }
    } catch {
      // ignore
    } finally {
      setTranslating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiClient.post(`/forms/${formId}/translations`, {
        locale,
        fields: translations,
      })
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5" style={{ fontFamily: 'Open Sans, sans-serif' }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
            Target Language
          </label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
          >
            {LOCALES.filter((l) => l.value !== 'en').map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 pt-5">
          <button
            type="button"
            disabled={translating}
            onClick={handleAITranslate}
            className="px-4 py-2 text-sm font-semibold text-white rounded-[10px] flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#3ec9d6' }}
          >
            {translating ? (
              <>
                <span
                  className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'white', borderTopColor: 'transparent' }}
                />
                Translating…
              </>
            ) : (
              'AI Translate'
            )}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#51459d' }}
          >
            {saving ? 'Saving…' : savedMsg ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
          English (Original)
        </div>
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
          {LOCALES.find((l) => l.value === locale)?.label ?? locale} (Translation)
        </div>
      </div>

      {/* Fields */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-2 gap-4 animate-pulse">
              <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-[10px]" />
              <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-[10px]" />
            </div>
          ))}
        </div>
      ) : fields.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No fields to translate.</p>
      ) : (
        <div className="space-y-4">
          {fields.map((field) => {
            const fieldTx = translations[field.id] ?? { label: '', description: '', options: {} }
            const isChoice = CHOICE_TYPES.has(field.field_type)
            const options =
              field.field_options?.map((o) => ({ val: o.value, label: o.label })) ??
              (field.options ?? []).map((o) => ({ val: o, label: o }))

            return (
              <div
                key={field.id}
                className="rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Field type badge */}
                <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: '#51459d' }}
                  >
                    {field.field_type}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {field.is_required && <span className="text-red-400 mr-1">*</span>}
                    Field #{field.order + 1}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-0 divide-x divide-gray-200 dark:divide-gray-700">
                  {/* Left — Original */}
                  <div className="p-3 space-y-2">
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Label</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                        {field.label || '—'}
                      </p>
                    </div>
                    {field.description && (
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Description</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{field.description}</p>
                      </div>
                    )}
                    {isChoice && options.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Options</p>
                        <ul className="space-y-0.5">
                          {options.map((opt) => (
                            <li key={opt.val} className="text-xs text-gray-600 dark:text-gray-400">
                              {opt.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Right — Translation */}
                  <div className="p-3 space-y-2">
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Label</p>
                      <input
                        type="text"
                        value={fieldTx.label}
                        onChange={(e) => setFieldTranslation(field.id, 'label', e.target.value)}
                        placeholder={`Translate "${field.label}"…`}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
                      />
                    </div>
                    {field.description && (
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Description</p>
                        <input
                          type="text"
                          value={fieldTx.description}
                          onChange={(e) =>
                            setFieldTranslation(field.id, 'description', e.target.value)
                          }
                          placeholder="Translate description…"
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
                        />
                      </div>
                    )}
                    {isChoice && options.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Options</p>
                        <div className="space-y-1">
                          {options.map((opt) => (
                            <input
                              key={opt.val}
                              type="text"
                              value={fieldTx.options?.[opt.val] ?? ''}
                              onChange={(e) =>
                                setOptionTranslation(field.id, opt.val, e.target.value)
                              }
                              placeholder={`Translate "${opt.label}"…`}
                              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
