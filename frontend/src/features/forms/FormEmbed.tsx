import { useState } from 'react'
import { useForm, useSubmitResponse } from '@/api/forms'
import type { FormField } from '@/api/forms'

interface FormEmbedProps {
  formId: string
  className?: string
  onSubmitted?: () => void
}

function SimpleFieldRenderer({ field, value, onChange }: { field: FormField; value: unknown; onChange: (v: unknown) => void }) {
  const inputCls = "w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-[6px] focus:ring-1 focus:ring-[#51459d]/50 focus:border-[#51459d] transition-colors"

  if (['section_header', 'description', 'page_break'].includes(field.field_type)) {
    if (field.field_type === 'section_header') return <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-2">{field.label}</h4>
    if (field.field_type === 'description') return <p className="text-[11px] text-gray-500 dark:text-gray-400">{field.label}</p>
    return <hr className="border-gray-200 dark:border-gray-700" />
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 dark:text-gray-300">
        {field.label}
        {field.is_required && <span className="text-[#ff3a6e]">*</span>}
      </label>
      {field.description && <p className="text-[10px] text-gray-400">{field.description}</p>}

      {field.field_type === 'textarea' ? (
        <textarea rows={2} value={value as string || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} className={inputCls + ' resize-none'} />
      ) : field.field_type === 'select' || field.field_type === 'dropdown' ? (
        <select value={value as string || ''} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">Select...</option>
          {(field.field_options?.length ? field.field_options.map(o => ({ label: o.label, value: o.value })) : (field.options || []).map(o => ({ label: o, value: o }))).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : field.field_type === 'checkbox' ? (
        <div className="space-y-1">
          {(field.field_options?.length ? field.field_options.map(o => ({ label: o.label, value: o.value })) : (field.options || []).map(o => ({ label: o, value: o }))).map(o => (
            <label key={o.value} className="flex items-center gap-2">
              <input type="checkbox" checked={((value as string[]) || []).includes(o.value)} onChange={e => {
                const cur = (value as string[]) || []
                onChange(e.target.checked ? [...cur, o.value] : cur.filter(v => v !== o.value))
              }} className="accent-[#51459d]" />
              <span className="text-[11px] text-gray-600 dark:text-gray-400">{o.label}</span>
            </label>
          ))}
        </div>
      ) : field.field_type === 'radio' ? (
        <div className="space-y-1">
          {(field.field_options?.length ? field.field_options.map(o => ({ label: o.label, value: o.value })) : (field.options || []).map(o => ({ label: o, value: o }))).map(o => (
            <label key={o.value} className="flex items-center gap-2">
              <input type="radio" name={field.id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="accent-[#51459d]" />
              <span className="text-[11px] text-gray-600 dark:text-gray-400">{o.label}</span>
            </label>
          ))}
        </div>
      ) : field.field_type === 'number' ? (
        <input type="number" value={value as number || ''} onChange={e => onChange(e.target.valueAsNumber)} placeholder={field.placeholder || ''} className={inputCls} />
      ) : field.field_type === 'date' ? (
        <input type="date" value={value as string || ''} onChange={e => onChange(e.target.value)} className={inputCls} />
      ) : (
        <input type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'} value={value as string || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} className={inputCls} />
      )}
    </div>
  )
}

export default function FormEmbed({ formId, className = '', onSubmitted }: FormEmbedProps) {
  const { data: form, isLoading, error } = useForm(formId)
  const submitResponse = useSubmitResponse()
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (!form) return
    submitResponse.mutate(
      { form_id: formId, answers },
      {
        onSuccess: () => {
          setSubmitted(true)
          onSubmitted?.()
        },
      }
    )
  }

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded" />
          <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      </div>
    )
  }

  if (error || !form) {
    return (
      <div className={`p-4 ${className}`}>
        <p className="text-xs text-gray-400">Form unavailable</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-[#6fd943]/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-[#6fd943]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Submitted!</p>
      </div>
    )
  }

  const visibleFields = form.fields.filter(f => !['section_header', 'description', 'page_break'].includes(f.field_type) || true)

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] p-4 ${className}`}>
      <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-3">{form.title}</h4>
      {form.description && <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">{form.description}</p>}
      <div className="space-y-3">
        {visibleFields.slice(0, 8).map(field => (
          <SimpleFieldRenderer
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={v => setAnswers(prev => ({ ...prev, [field.id]: v }))}
          />
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={submitResponse.isPending}
        className="mt-4 w-full py-2 text-xs font-medium text-white bg-[#51459d] hover:bg-[#3d3480] rounded-[6px] transition-colors disabled:opacity-50"
      >
        {submitResponse.isPending ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  )
}
