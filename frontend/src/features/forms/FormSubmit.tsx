import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, useSubmitResponse, type FormField } from '../../api/forms'
import { Button, Card, Spinner, toast } from '../../components/ui'

export default function FormSubmit() {
  const { id } = useParams<{ id: string }>()
  const { data: form, isLoading } = useForm(id ?? '')
  const submitResponse = useSubmitResponse()
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitted, setSubmitted] = useState(false)

  function setAnswer(fieldId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  function handleCheckbox(fieldId: string, option: string, checked: boolean) {
    setAnswers((prev) => {
      const current = (prev[fieldId] as string[]) || []
      return {
        ...prev,
        [fieldId]: checked ? [...current, option] : current.filter((o) => o !== option),
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    submitResponse.mutate(
      { form_id: id, answers },
      {
        onSuccess: () => {
          setSubmitted(true)
          toast('success', 'Response submitted')
        },
        onError: () => toast('error', 'Failed to submit response'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-lg font-semibold text-gray-900">Form not found</h2>
        <p className="text-sm text-gray-500 mt-1">This form may have been deleted or does not exist.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-[#6fd943]/10 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-[#6fd943]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Response Submitted</h2>
        <p className="text-sm text-gray-500 mt-2">Thank you for your submission.</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => {
            setSubmitted(false)
            setAnswers({})
          }}
        >
          Submit another response
        </Button>
      </div>
    )
  }

  const fields = form.fields ? [...form.fields].sort((a, b) => a.order - b.order) : []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Form Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
        {form.description && (
          <p className="text-sm text-gray-500 mt-2">{form.description}</p>
        )}
      </div>

      {fields.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-sm text-gray-400">This form has no fields yet.</p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card className="space-y-5">
            {fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={(val) => setAnswer(field.id, val)}
                onCheckbox={(opt, checked) => handleCheckbox(field.id, opt, checked)}
              />
            ))}

            <div className="pt-3">
              <Button type="submit" loading={submitResponse.isPending}>
                Submit
              </Button>
            </div>
          </Card>
        </form>
      )}
    </div>
  )
}

// ─── Field Renderer ──────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField
  value: unknown
  onChange: (val: unknown) => void
  onCheckbox: (option: string, checked: boolean) => void
}

function FieldRenderer({ field, value, onChange, onCheckbox }: FieldRendererProps) {
  const inputClasses =
    'w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400'

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {field.label}
        {field.is_required && <span className="text-[#ff3a6e] ml-1">*</span>}
      </label>

      {field.field_type === 'text' && (
        <input
          type="text"
          className={inputClasses}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      )}

      {field.field_type === 'textarea' && (
        <textarea
          className={`${inputClasses} resize-none`}
          rows={4}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      )}

      {field.field_type === 'number' && (
        <input
          type="number"
          className={inputClasses}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder="0"
        />
      )}

      {field.field_type === 'email' && (
        <input
          type="email"
          className={inputClasses}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder="name@example.com"
        />
      )}

      {field.field_type === 'date' && (
        <input
          type="date"
          className={inputClasses}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
        />
      )}

      {field.field_type === 'file' && (
        <input
          type="file"
          className={inputClasses}
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')}
          required={field.is_required}
        />
      )}

      {field.field_type === 'select' && (
        <select
          className={inputClasses}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
        >
          <option value="">Select an option</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.field_type === 'radio' && (
        <div className="space-y-2 pt-1">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name={`field-${field.id}`}
                value={opt}
                checked={(value as string) === opt}
                onChange={() => onChange(opt)}
                className="text-primary focus:ring-primary/30"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {field.field_type === 'checkbox' && (
        <div className="space-y-2 pt-1">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={((value as string[]) ?? []).includes(opt)}
                onChange={(e) => onCheckbox(opt, e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary/30"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
