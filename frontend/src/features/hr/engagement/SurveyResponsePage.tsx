import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Badge, Spinner, toast } from '@/components/ui'
import { useSurvey, useSubmitSurveyResponse, type SurveyQuestion } from '@/api/hr_engagement'

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="transition-transform hover:scale-110 focus:outline-none"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          <svg
            className={`h-8 w-8 transition-colors ${
              star <= (hovered || value) ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-600'
            }`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 self-center text-sm text-gray-500">{value}/5</span>
      )}
    </div>
  )
}

// ─── NPS Scale ────────────────────────────────────────────────────────────────

function NPSScale({ value, onChange }: { value: number | ''; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`h-9 w-9 rounded-[10px] border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              value === i
                ? 'border-primary bg-primary text-white'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-primary/50'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
    </div>
  )
}

// ─── Likert Scale ─────────────────────────────────────────────────────────────

const LIKERT_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']

function LikertScale({
  questionId,
  value,
  onChange,
}: {
  questionId: string
  value: number | ''
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
      {LIKERT_LABELS.map((label, i) => {
        const score = i + 1
        const isSelected = value === score
        return (
          <label
            key={score}
            className={`flex flex-1 cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2.5 text-sm transition-colors ${
              isSelected
                ? 'border-primary bg-primary/5 text-primary font-medium'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary/40'
            }`}
          >
            <input
              type="radio"
              name={questionId}
              value={score}
              checked={isSelected}
              onChange={() => onChange(score)}
              className="h-4 w-4 accent-primary"
            />
            <span className="leading-tight">{score}. {label}</span>
          </label>
        )
      })}
    </div>
  )
}

// ─── Question Renderer ────────────────────────────────────────────────────────

interface QuestionRendererProps {
  question: SurveyQuestion
  answer: string | number | ''
  onAnswer: (v: string | number) => void
}

function QuestionRenderer({ question, answer, onAnswer }: QuestionRendererProps) {
  switch (question.type) {
    case 'likert':
      return (
        <LikertScale
          questionId={question.id}
          value={answer as number | ''}
          onChange={onAnswer}
        />
      )

    case 'nps':
      return (
        <NPSScale
          value={answer as number | ''}
          onChange={onAnswer}
        />
      )

    case 'open':
      return (
        <textarea
          className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
          rows={4}
          placeholder="Share your thoughts…"
          value={answer as string}
          onChange={(e) => onAnswer(e.target.value)}
        />
      )

    case 'multichoice':
      return (
        <div className="flex flex-col gap-2">
          {(question.options ?? []).map((opt) => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-4 py-3 text-sm transition-colors ${
                answer === opt
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary/40'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={answer === opt}
                onChange={() => onAnswer(opt)}
                className="h-4 w-4 accent-primary"
              />
              {opt}
            </label>
          ))}
        </div>
      )

    case 'rating':
      return (
        <StarRating
          value={answer as number}
          onChange={onAnswer}
        />
      )

    default:
      return null
  }
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="mb-6 animate-bounce">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: '#6fd94320' }}>
          <svg className="h-10 w-10" style={{ color: '#6fd943' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Thank you for your feedback!
      </h2>
      <p className="mb-8 max-w-md text-sm text-gray-500">
        Your response has been recorded. Your input helps us create a better workplace for everyone.
      </p>
      <Button variant="secondary" onClick={() => navigate(-1)}>
        Back to Dashboard
      </Button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SurveyResponsePage() {
  const { surveyId = '' } = useParams<{ surveyId: string }>()
  const { data: survey, isLoading, isError } = useSurvey(surveyId)
  const submitResponse = useSubmitSurveyResponse()

  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set())

  function setAnswer(questionId: string, value: string | number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setValidationErrors((prev) => {
      const next = new Set(prev)
      next.delete(questionId)
      return next
    })
  }

  async function handleSubmit() {
    if (!survey?.questions) return

    // Validate required questions
    const errors = new Set<string>()
    survey.questions.forEach((q) => {
      if (q.required && (answers[q.id] === undefined || answers[q.id] === '')) {
        errors.add(q.id)
      }
    })

    if (errors.size > 0) {
      setValidationErrors(errors)
      toast('error', `Please answer all required questions (${errors.size} remaining)`)
      // Scroll to first error
      const firstError = document.getElementById(`question-${[...errors][0]}`)
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    try {
      await submitResponse.mutateAsync({ id: surveyId, answers })
      setSubmitted(true)
    } catch {
      toast('error', 'Failed to submit response. Please try again.')
    }
  }

  if (submitted) return <SuccessScreen />

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isError || !survey) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <p className="text-gray-500">Survey not found or unavailable.</p>
      </div>
    )
  }

  const questions = survey.questions ?? []
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length
  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Survey Header */}
      <Card>
        <div className="space-y-3">
          <div className="flex flex-wrap items-start gap-2">
            <h1 className="flex-1 text-xl font-bold text-gray-900 dark:text-gray-100">{survey.title}</h1>
            {survey.is_anonymous && (
              <Badge variant="info">Anonymous</Badge>
            )}
            <Badge variant="default" className="capitalize">{survey.survey_type}</Badge>
          </div>
          {survey.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{survey.description}</p>
          )}
          {survey.closes_at && (
            <p className="text-xs text-gray-400">
              Closes: {new Date(survey.closes_at).toLocaleString()}
            </p>
          )}

          {/* Progress bar */}
          {questions.length > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{answeredCount} of {questions.length} answered</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: '#51459d' }}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Questions */}
      {questions.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-gray-500 py-8">This survey has no questions yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => {
            const hasError = validationErrors.has(question.id)
            return (
              <Card
                key={question.id}
                id={`question-${question.id}`}
                className={hasError ? 'ring-2 ring-red-400/50 border-red-300' : ''}
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#51459d' }}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
                        {question.text}
                        {question.required && <span className="ml-1 text-danger">*</span>}
                      </p>
                    </div>
                  </div>

                  <QuestionRenderer
                    question={question}
                    answer={answers[question.id] ?? ''}
                    onAnswer={(v) => setAnswer(question.id, v)}
                  />

                  {hasError && (
                    <p className="text-xs text-danger">This question is required.</p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Submit */}
      {questions.length > 0 && (
        <div className="flex justify-end pb-6">
          <Button
            onClick={handleSubmit}
            loading={submitResponse.isPending}
            size="lg"
            className="min-w-36"
          >
            Submit Response
          </Button>
        </div>
      )}
    </div>
  )
}
