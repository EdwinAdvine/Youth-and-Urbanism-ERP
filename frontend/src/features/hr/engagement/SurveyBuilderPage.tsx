import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input, Select, Modal, toast } from '@/components/ui'
import {
  useCreateSurvey,
  useLaunchSurvey,
  type Survey,
  type SurveyQuestion,
} from '@/api/hr_engagement'

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = SurveyQuestion['type']
type SurveyType = Survey['survey_type']

interface DraftQuestion {
  localId: string
  type: QuestionType
  text: string
  required: boolean
  options: string[]
}

// ─── Question Type Badge ──────────────────────────────────────────────────────

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const map: Record<QuestionType, { label: string; color: string }> = {
    likert:      { label: 'Likert Scale',     color: 'bg-indigo-100 text-indigo-700' },
    nps:         { label: 'NPS',              color: 'bg-cyan-100 text-cyan-700' },
    open:        { label: 'Open Text',        color: 'bg-gray-100 text-gray-700' },
    multichoice: { label: 'Multiple Choice',  color: 'bg-amber-100 text-amber-700' },
    rating:      { label: 'Rating',           color: 'bg-emerald-100 text-emerald-700' },
  }
  const { label, color } = map[type]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

// ─── Question Editor Modal ────────────────────────────────────────────────────

interface QuestionEditorProps {
  open: boolean
  initial?: DraftQuestion | null
  onSave: (q: DraftQuestion) => void
  onClose: () => void
}

function QuestionEditor({ open, initial, onSave, onClose }: QuestionEditorProps) {
  const [type, setType]       = useState<QuestionType>(initial?.type ?? 'likert')
  const [text, setText]       = useState(initial?.text ?? '')
  const [required, setReq]   = useState(initial?.required ?? true)
  const [options, setOpts]   = useState<string[]>(initial?.options ?? ['', ''])

  function addOption()  { setOpts((p) => [...p, '']) }
  function removeOption(i: number) { setOpts((p) => p.filter((_, idx) => idx !== i)) }
  function setOption(i: number, v: string) {
    setOpts((p) => p.map((o, idx) => (idx === i ? v : o)))
  }

  function handleSave() {
    if (!text.trim()) { toast('error', 'Question text is required'); return }
    onSave({
      localId: initial?.localId ?? crypto.randomUUID(),
      type,
      text: text.trim(),
      required,
      options: type === 'multichoice' ? options.filter(Boolean) : [],
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Question' : 'Add Question'} size="lg">
      <div className="space-y-4">
        <Select
          label="Question Type"
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          options={[
            { value: 'likert',      label: 'Likert Scale (1-5 agreement)' },
            { value: 'nps',         label: 'NPS (0-10 likelihood)' },
            { value: 'open',        label: 'Open Text' },
            { value: 'multichoice', label: 'Multiple Choice' },
            { value: 'rating',      label: 'Rating (1-5 stars)' },
          ]}
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Question Text <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            rows={3}
            placeholder="Enter your question…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {type === 'multichoice' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Answer Options</label>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeOption(i)} disabled={options.length <= 2}>
                  <svg className="h-4 w-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addOption}>+ Add Option</Button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={required}
              onChange={(e) => setReq(e.target.checked)}
            />
            <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          </label>
          <span className="text-sm text-gray-700 dark:text-gray-300">Required question</span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Question</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Question Card ────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: DraftQuestion
  index: number
  onEdit: () => void
  onDelete: () => void
}

function QuestionCard({ question, index, onEdit, onDelete }: QuestionCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {/* Drag handle (visual only) */}
      <div className="mt-0.5 flex cursor-grab flex-col gap-1 text-gray-300 dark:text-gray-600 select-none">
        <span className="block h-px w-4 bg-current" />
        <span className="block h-px w-4 bg-current" />
        <span className="block h-px w-4 bg-current" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-400">Q{index + 1}</span>
          <QuestionTypeBadge type={question.type} />
          {question.required && (
            <span className="text-xs text-danger font-medium">Required</span>
          )}
        </div>
        <p className="text-sm text-gray-900 dark:text-gray-100 font-medium leading-snug">
          {question.text}
        </p>
        {question.type === 'multichoice' && question.options.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {question.options.map((opt, i) => (
              <span key={i} className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                {opt}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit} title="Edit">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} title="Delete">
          <svg className="h-4 w-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SurveyBuilderPage() {
  const navigate = useNavigate()
  const createSurvey = useCreateSurvey()
  const launchSurvey = useLaunchSurvey()

  // Survey meta
  const [title, setTitle]           = useState('')
  const [surveyType, setSurveyType] = useState<SurveyType>('engagement')
  const [description, setDesc]      = useState('')
  const [isAnonymous, setAnon]      = useState(false)
  const [allEmployees, setAllEmp]   = useState(true)
  const [deptIds, setDeptIds]       = useState('')
  const [opensAt, setOpensAt]       = useState('')
  const [closesAt, setClosesAt]     = useState('')

  // Questions
  const [questions, setQuestions]   = useState<DraftQuestion[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DraftQuestion | null>(null)

  function openAdd()  { setEditTarget(null); setEditorOpen(true) }
  function openEdit(q: DraftQuestion) { setEditTarget(q); setEditorOpen(true) }
  function deleteQ(localId: string)  { setQuestions((p) => p.filter((q) => q.localId !== localId)) }

  function handleSaveQuestion(q: DraftQuestion) {
    setQuestions((prev) => {
      const idx = prev.findIndex((x) => x.localId === q.localId)
      if (idx !== -1) return prev.map((x) => (x.localId === q.localId ? q : x))
      return [...prev, q]
    })
  }

  function buildPayload(): Partial<Survey> {
    return {
      title:           title.trim(),
      survey_type:     surveyType,
      description:     description.trim() || null,
      is_anonymous:    isAnonymous,
      questions:       questions.map((q) => ({
        id:       q.localId,
        type:     q.type,
        text:     q.text,
        required: q.required,
        options:  q.options,
      })),
      target_audience: allEmployees
        ? { all: true }
        : { department_ids: deptIds.split(',').map((s) => s.trim()).filter(Boolean) },
      opens_at:   opensAt  || null,
      closes_at:  closesAt || null,
    }
  }

  async function handleSaveDraft() {
    if (!title.trim()) { toast('error', 'Survey title is required'); return }
    try {
      await createSurvey.mutateAsync(buildPayload())
      toast('success', 'Survey saved as draft')
      navigate('/hr/engagement/surveys')
    } catch {
      toast('error', 'Failed to save survey')
    }
  }

  async function handleLaunch() {
    if (!title.trim())          { toast('error', 'Survey title is required'); return }
    if (questions.length === 0) { toast('error', 'Add at least one question'); return }
    try {
      const survey = await createSurvey.mutateAsync(buildPayload())
      await launchSurvey.mutateAsync(survey.id)
      toast('success', 'Survey launched successfully')
      navigate('/hr/engagement/surveys')
    } catch {
      toast('error', 'Failed to launch survey')
    }
  }

  const isBusy = createSurvey.isPending || launchSurvey.isPending

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="mb-1 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Survey Builder</h1>
          <p className="text-sm text-gray-500">Create and configure a new employee survey</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSaveDraft} loading={isBusy}>
            Save Draft
          </Button>
          <Button onClick={handleLaunch} loading={isBusy}>
            Launch Survey
          </Button>
        </div>
      </div>

      {/* Survey Details */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Survey Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Survey Title"
              placeholder="e.g., Q1 2026 Engagement Survey"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <Select
            label="Survey Type"
            value={surveyType}
            onChange={(e) => setSurveyType(e.target.value as SurveyType)}
            options={[
              { value: 'engagement', label: 'Engagement' },
              { value: 'enps',       label: 'eNPS' },
              { value: 'pulse',      label: 'Pulse' },
              { value: 'exit',       label: 'Exit' },
              { value: 'onboarding', label: 'Onboarding' },
              { value: 'custom',     label: 'Custom' },
            ]}
          />

          <div className="flex items-end pb-1">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isAnonymous}
                  onChange={(e) => setAnon(e.target.checked)}
                />
                <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
              </label>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Anonymous responses</span>
            </div>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              rows={3}
              placeholder="Optional description or instructions for respondents…"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Target Audience */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Target Audience</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={allEmployees}
                onChange={(e) => setAllEmp(e.target.checked)}
              />
              <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
            </label>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Send to all employees</span>
          </div>

          {!allEmployees && (
            <Input
              label="Department IDs (comma-separated)"
              placeholder="dept-001, dept-002, dept-003"
              value={deptIds}
              onChange={(e) => setDeptIds(e.target.value)}
            />
          )}
        </div>
      </Card>

      {/* Schedule */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Schedule</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Opens At</label>
            <input
              type="datetime-local"
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Closes At</label>
            <input
              type="datetime-local"
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Questions Builder */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Questions</h2>
            <p className="text-xs text-gray-500">{questions.length} question{questions.length !== 1 ? 's' : ''} added</p>
          </div>
          <Button size="sm" onClick={openAdd}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Question
          </Button>
        </div>

        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-gray-200 dark:border-gray-700 py-12 text-center">
            <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-500">No questions yet. Click "Add Question" to start building your survey.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.localId}
                question={q}
                index={i}
                onEdit={() => openEdit(q)}
                onDelete={() => deleteQ(q.localId)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Bottom actions */}
      <div className="flex justify-end gap-2 pb-6">
        <Button variant="secondary" onClick={handleSaveDraft} loading={isBusy}>
          Save Draft
        </Button>
        <Button onClick={handleLaunch} loading={isBusy}>
          Launch Survey
        </Button>
      </div>

      {/* Question editor modal */}
      <QuestionEditor
        open={editorOpen}
        initial={editTarget}
        onSave={handleSaveQuestion}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  )
}
