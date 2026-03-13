import { useState, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useForm, useSubmitResponse, type FormField } from '../../api/forms'
import { Button, Card, Spinner, toast } from '../../components/ui'

export default function FormSubmit() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isSandbox = searchParams.get('sandbox') === 'true'
  const { data: form, isLoading } = useForm(id ?? '')
  const submitResponse = useSubmitResponse()
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitted, setSubmitted] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

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
      { form_id: id, answers, is_sandbox: isSandbox },
      {
        onSuccess: () => {
          setSubmitted(true)
          toast('success', isSandbox ? 'Preview submitted (sandbox)' : 'Response submitted')
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Form not found</h2>
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {isSandbox ? 'Preview Submitted' : 'Response Submitted'}
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          {isSandbox ? 'This was a sandbox preview and will not appear in analytics.' : 'Thank you for your submission.'}
        </p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => { setSubmitted(false); setAnswers({}); setCurrentPage(1) }}>
          Submit another response
        </Button>
      </div>
    )
  }

  const fields = form.fields ? [...form.fields].sort((a, b) => a.order - b.order) : []

  // Group by page
  const pages = new Map<number, FormField[]>()
  fields.forEach((f) => {
    const page = f.page_number || 1
    if (!pages.has(page)) pages.set(page, [])
    pages.get(page)!.push(f)
  })
  const totalPages = Math.max(...Array.from(pages.keys()), 1)
  const currentFields = pages.get(currentPage) ?? fields

  // Apply theme from settings
  const theme = (form.settings as Record<string, unknown> | null)?.theme as Record<string, string> | undefined

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 sm:px-0 py-4 sm:py-0">
      {/* Sandbox Banner */}
      {isSandbox && (
        <div className="bg-[#ffa21d]/10 border border-[#ffa21d]/30 text-[#ffa21d] rounded-[10px] px-4 py-2 text-sm font-medium text-center">
          Preview Mode — Responses will not appear in analytics
        </div>
      )}

      {/* Form Header */}
      <div style={theme ? { backgroundColor: theme.headerBg, color: theme.headerColor } : undefined}>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{form.title}</h1>
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
          <Card className="space-y-5 p-4 sm:p-6">
            {/* Page indicator */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-gray-100 dark:border-gray-800">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${i + 1 === currentPage ? 'bg-[#51459d]' : 'bg-gray-200 dark:bg-gray-700'}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {currentFields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={(val) => setAnswer(field.id, val)}
                onCheckbox={(opt, checked) => handleCheckbox(field.id, opt, checked)}
              />
            ))}

            <div className="flex items-center justify-between pt-3">
              {totalPages > 1 && currentPage > 1 ? (
                <Button variant="outline" type="button" onClick={() => setCurrentPage((p) => p - 1)}>
                  Previous
                </Button>
              ) : <div />}

              {totalPages > 1 && currentPage < totalPages ? (
                <Button type="button" onClick={() => setCurrentPage((p) => p + 1)}>
                  Next
                </Button>
              ) : (
                <Button type="submit" loading={submitResponse.isPending} className="min-h-[44px]">
                  {isSandbox ? 'Preview Submit' : 'Submit'}
                </Button>
              )}
            </div>
          </Card>
        </form>
      )}
    </div>
  )
}

// ── Field Renderer ───────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField
  value: unknown
  onChange: (val: unknown) => void
  onCheckbox: (option: string, checked: boolean) => void
}

function FieldRenderer({ field, value, onChange, onCheckbox }: FieldRendererProps) {
  const inputClasses =
    'w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-3 text-base sm:text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400'

  const ft = field.field_type
  const meta = (field.metadata ?? {}) as Record<string, unknown>

  // Layout fields — no input
  if (ft === 'section_header') {
    return (
      <div className="pt-4 pb-1 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{field.label}</h3>
        {field.description && <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>}
      </div>
    )
  }
  if (ft === 'description') {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-[10px] p-3">
        {field.label}
      </div>
    )
  }
  if (ft === 'page_break') {
    return <hr className="border-gray-200 dark:border-gray-700 my-2" />
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {field.label}
        {field.is_required && <span className="text-[#ff3a6e] ml-1">*</span>}
      </label>
      {field.description && (
        <p className="text-xs text-gray-400 -mt-1">{field.description}</p>
      )}

      {/* Text */}
      {ft === 'text' && (
        <input type="text" className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required} placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`} />
      )}

      {/* Textarea */}
      {ft === 'textarea' && (
        <textarea className={`${inputClasses} resize-none`} rows={4} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required} placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`} />
      )}

      {/* Number */}
      {ft === 'number' && (
        <input type="number" className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required} placeholder="0" inputMode="numeric" />
      )}

      {/* Email */}
      {ft === 'email' && (
        <input type="email" className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required} placeholder="name@example.com" inputMode="email" autoComplete="email" />
      )}

      {/* Phone */}
      {ft === 'phone' && (
        <input type="tel" className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required} placeholder="+1 (555) 000-0000" inputMode="tel" autoComplete="tel" />
      )}

      {/* URL */}
      {ft === 'url' && (
        <input type="url" className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required} placeholder="https://example.com" inputMode="url" />
      )}

      {/* Date */}
      {ft === 'date' && (
        <input type="date" className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required} />
      )}

      {/* Time */}
      {ft === 'time' && (
        <input type="time" className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required} />
      )}

      {/* DateTime */}
      {ft === 'datetime' && (
        <input type="datetime-local" className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required} />
      )}

      {/* Select / Dropdown */}
      {(ft === 'select' || ft === 'dropdown') && (
        <select className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required}>
          <option value="">Select an option</option>
          {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}

      {/* Radio */}
      {ft === 'radio' && (
        <div className="space-y-1 pt-1">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer py-2 px-2 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[44px]">
              <input type="radio" name={`field-${field.id}`} value={opt} checked={(value as string) === opt} onChange={() => onChange(opt)} className="w-5 h-5 text-[#51459d] focus:ring-[#51459d]/30" />
              {opt}
            </label>
          ))}
        </div>
      )}

      {/* Checkbox */}
      {ft === 'checkbox' && (
        <div className="space-y-1 pt-1">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer py-2 px-2 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[44px]">
              <input type="checkbox" checked={((value as string[]) ?? []).includes(opt)} onChange={(e) => onCheckbox(opt, e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]/30" />
              {opt}
            </label>
          ))}
        </div>
      )}

      {/* Rating (Stars) */}
      {ft === 'rating' && <RatingField value={value as number} max={Number(meta.max ?? 5)} onChange={onChange} />}

      {/* NPS (0-10) */}
      {ft === 'nps' && <NPSField value={value as number} onChange={onChange} />}

      {/* Slider */}
      {ft === 'slider' && (
        <div className="space-y-1">
          <input
            type="range"
            min={Number(meta.min ?? 0)}
            max={Number(meta.max ?? 100)}
            value={Number(value ?? meta.min ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#51459d]"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{String(meta.min ?? 0)}</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{String(value ?? meta.min ?? 0)}</span>
            <span>{String(meta.max ?? 100)}</span>
          </div>
        </div>
      )}

      {/* Likert */}
      {ft === 'likert' && (
        <div className="flex gap-2 pt-1">
          {Array.from({ length: Number(meta.max ?? 5) - Number(meta.min ?? 1) + 1 }, (_, i) => {
            const val = Number(meta.min ?? 1) + i
            return (
              <button
                key={val}
                type="button"
                onClick={() => onChange(val)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                  value === val
                    ? 'bg-[#51459d] text-white border-[#51459d]'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-[#51459d]/40'
                }`}
              >
                {val}
              </button>
            )
          })}
        </div>
      )}

      {/* Matrix */}
      {ft === 'matrix' && <MatrixField field={field} value={value as Record<string, string>} onChange={onChange} />}

      {/* Ranking */}
      {ft === 'ranking' && <RankingField options={field.options ?? []} value={value as string[]} onChange={onChange} />}

      {/* File */}
      {ft === 'file' && (
        <FileUploadInput fieldId={field.id} value={value as string} onChange={onChange} required={field.is_required} accept="*/*" />
      )}

      {/* Photo */}
      {ft === 'photo' && (
        <FileUploadInput fieldId={field.id} value={value as string} onChange={onChange} required={field.is_required} accept="image/*" capture="environment" />
      )}

      {/* Video */}
      {ft === 'video' && (
        <FileUploadInput fieldId={field.id} value={value as string} onChange={onChange} required={field.is_required} accept="video/*" capture="environment" />
      )}

      {/* Audio */}
      {ft === 'audio' && (
        <FileUploadInput fieldId={field.id} value={value as string} onChange={onChange} required={field.is_required} accept="audio/*" capture="user" />
      )}

      {/* Signature */}
      {ft === 'signature' && <SignatureField value={value as string} onChange={onChange} />}

      {/* GPS */}
      {ft === 'gps' && <GPSField value={value as { lat: number; lng: number } | null} onChange={onChange} />}

      {/* Barcode */}
      {ft === 'barcode' && (
        <input type="text" className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Scan or enter barcode/QR code" />
      )}

      {/* Calculated — read only */}
      {ft === 'calculated' && (
        <input type="text" className={`${inputClasses} bg-gray-50 dark:bg-gray-900`} value={(value as string) ?? ''} readOnly placeholder="Calculated automatically" />
      )}

      {/* Cascading Select */}
      {ft === 'cascading_select' && (
        <select className={inputClasses} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.is_required}>
          <option value="">Select an option</option>
          {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}

      {/* ERP Pickers — text input with search hint */}
      {(ft === 'employee_picker' || ft === 'product_picker' || ft === 'customer_picker' || ft === 'gl_account_picker' || ft === 'warehouse_picker') && (
        <input
          type="text"
          className={inputClasses}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder={`Search ${ft.replace('_picker', '').replace('_', ' ')}...`}
        />
      )}
    </div>
  )
}

// ── Star Rating ──────────────────────────────────────────────────────────────

function RatingField({ value, max, onChange }: { value: number | undefined; max: number; onChange: (v: unknown) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1 pt-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i + 1)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i + 1)}
          className="text-2xl transition-transform hover:scale-110"
        >
          <svg className={`w-8 h-8 ${(hover || value || 0) >= i + 1 ? 'text-[#ffa21d] fill-current' : 'text-gray-200 dark:text-gray-700'}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
      {value != null && <span className="text-sm text-gray-500 self-center ml-2">{value}/{max}</span>}
    </div>
  )
}

// ── NPS (0-10) ───────────────────────────────────────────────────────────────

function NPSField({ value, onChange }: { value: number | undefined; onChange: (v: unknown) => void }) {
  return (
    <div>
      <div className="flex gap-1 pt-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
              value === i
                ? i <= 6 ? 'bg-[#ff3a6e] text-white border-[#ff3a6e]' : i <= 8 ? 'bg-[#ffa21d] text-white border-[#ffa21d]' : 'bg-[#6fd943] text-white border-[#6fd943]'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-[#51459d]/40'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
    </div>
  )
}

// ── Matrix Grid ──────────────────────────────────────────────────────────────

function MatrixField({ field, value, onChange }: { field: FormField; value: Record<string, string> | undefined; onChange: (v: unknown) => void }) {
  const meta = (field.metadata ?? {}) as Record<string, string[]>
  const rows = meta.rows ?? field.options ?? ['Row 1', 'Row 2']
  const cols = meta.columns ?? ['Col 1', 'Col 2', 'Col 3']
  const current = value ?? {}

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 pr-3 text-gray-500 font-normal" />
            {cols.map((col) => (
              <th key={col} className="text-center py-2 px-2 text-gray-500 font-normal text-xs">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-t border-gray-100 dark:border-gray-800">
              <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300">{row}</td>
              {cols.map((col) => (
                <td key={col} className="text-center py-2.5 px-2">
                  <input
                    type="radio"
                    name={`matrix-${field.id}-${row}`}
                    checked={current[row] === col}
                    onChange={() => onChange({ ...current, [row]: col })}
                    className="w-4 h-4 text-[#51459d] focus:ring-[#51459d]/30"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Ranking (drag/click reorder) ─────────────────────────────────────────────

function RankingField({ options, value, onChange }: { options: string[]; value: string[] | undefined; onChange: (v: unknown) => void }) {
  const ranked = value ?? [...options]

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...ranked]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  function moveDown(index: number) {
    if (index === ranked.length - 1) return
    const next = [...ranked]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-1.5 pt-1">
      {ranked.map((item, idx) => (
        <div key={item} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px]">
          <span className="text-xs font-medium text-gray-400 w-5 text-center">{idx + 1}</span>
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{item}</span>
          <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button type="button" onClick={() => moveDown(idx)} disabled={idx === ranked.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      ))}
    </div>
  )
}

// ── File Upload ──────────────────────────────────────────────────────────────

function FileUploadInput({ fieldId, value, onChange, required, accept, capture }: {
  fieldId: string; value: string | undefined; onChange: (v: unknown) => void; required: boolean; accept: string; capture?: string
}) {
  return (
    <div className="relative">
      <input type="file" className="hidden" id={`file-${fieldId}`} accept={accept} capture={capture as 'user' | 'environment' | undefined}
        onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')} required={required && !value} />
      <label htmlFor={`file-${fieldId}`}
        className="flex items-center justify-center gap-2 w-full rounded-[10px] border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-4 py-4 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:border-[#51459d]/40 hover:bg-[#51459d]/5 transition-colors min-h-[56px]">
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {value || (capture ? 'Tap to capture' : 'Tap to choose a file')}
      </label>
    </div>
  )
}

// ── Signature ────────────────────────────────────────────────────────────────

function SignatureField({ value, onChange }: { value: string | undefined; onChange: (v: unknown) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    setDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1f2937'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function endDraw() {
    setDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] bg-white dark:bg-gray-800 cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <Button variant="ghost" size="sm" type="button" onClick={clearSignature}>Clear</Button>
    </div>
  )
}

// ── GPS Location ─────────────────────────────────────────────────────────────

function GPSField({ value, onChange }: { value: { lat: number; lng: number } | null; onChange: (v: unknown) => void }) {
  const [loading, setLoading] = useState(false)

  function captureLocation() {
    if (!navigator.geolocation) {
      toast('error', 'Geolocation not supported')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLoading(false)
      },
      () => {
        toast('error', 'Failed to get location')
        setLoading(false)
      },
      { enableHighAccuracy: true }
    )
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" type="button" onClick={captureLocation} loading={loading}>
        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Capture GPS Location
      </Button>
      {value && (
        <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
          Lat: {value.lat.toFixed(6)}, Lng: {value.lng.toFixed(6)}
        </p>
      )}
    </div>
  )
}
