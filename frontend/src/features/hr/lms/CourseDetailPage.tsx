import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Badge, Button, Spinner } from '../../../components/ui'
import { toast } from '../../../components/ui'
import {
  useCourse,
  useCourseLeaderboard,
  useEnrollments,
  useCreateEnrollment,
  type CourseModule,
} from '@/api/hr_lms'

// ─── Level badge colour ───────────────────────────────────────────────────────

const levelVariant = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
} as const

// ─── Module type icon + label ─────────────────────────────────────────────────

const moduleTypeIcon: Record<CourseModule['module_type'], string> = {
  video: '🎬',
  document: '📄',
  quiz: '✍️',
  scorm: '🔗',
}

const moduleTypeLabel: Record<CourseModule['module_type'], string> = {
  video: 'Video',
  document: 'Document',
  quiz: 'Quiz',
  scorm: 'SCORM',
}

// ─── Circular progress indicator ─────────────────────────────────────────────

function CircularProgress({ pct }: { pct: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="rotate-[-90deg]">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx="45"
        cy="45"
        r={r}
        fill="none"
        stroke="#51459d"
        strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      <text
        x="45"
        y="45"
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90 origin-center"
        style={{ transform: 'rotate(90deg)', transformOrigin: '45px 45px', fontSize: 14, fontWeight: 700, fill: '#51459d' }}
      >
        {pct}%
      </text>
    </svg>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function EnrollStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'default' | 'info' | 'success' | 'danger'; label: string }> = {
    enrolled: { variant: 'info', label: 'Enrolled' },
    in_progress: { variant: 'warning' as unknown as 'info', label: 'In Progress' },
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'danger', label: 'Failed' },
  }
  const cfg = map[status] ?? { variant: 'default' as const, label: status }
  return <Badge variant={cfg.variant as 'default' | 'info' | 'success' | 'danger'}>{cfg.label}</Badge>
}

// ─── Module accordion item ────────────────────────────────────────────────────

function ModuleItem({ mod, idx }: { mod: CourseModule; idx: number }) {
  const [open, setOpen] = useState(false)
  const quizCount = mod.quiz_questions?.length ?? 0

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-[10px] overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-base">{moduleTypeIcon[mod.module_type]}</span>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">
          {idx + 1}. {mod.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{mod.duration_minutes}min</span>
          <Badge variant="default">{moduleTypeLabel[mod.module_type]}</Badge>
          {mod.is_required && <Badge variant="danger">Required</Badge>}
          {mod.module_type === 'quiz' && quizCount > 0 && (
            <Badge variant="info">{quizCount} Qs</Badge>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-700">
          {mod.content_url && (
            <p className="text-xs text-gray-500 mb-2 break-all">
              <span className="font-medium">URL:</span> {mod.content_url}
            </p>
          )}
          {mod.module_type === 'quiz' && mod.quiz_questions && mod.quiz_questions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Quiz Preview</p>
              {mod.quiz_questions.map((q, qi) => (
                <div key={qi} className="text-xs bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 p-3">
                  <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                    Q{qi + 1}. {q.question}
                  </p>
                  <ul className="space-y-0.5">
                    {q.options.map((opt, oi) => (
                      <li
                        key={oi}
                        className={`pl-2 ${oi === q.correct_index ? 'text-[#6fd943] font-semibold' : 'text-gray-500'}`}
                      >
                        {oi === q.correct_index ? '✓ ' : '  '}{opt}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-gray-400">{q.points} pts</p>
                </div>
              ))}
            </div>
          )}
          {!mod.content_url && mod.module_type !== 'quiz' && (
            <p className="text-xs text-gray-400 italic">No content URL configured.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'modules' | 'leaderboard'

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { courseId = '' } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('modules')
  const [enrolling, setEnrolling] = useState(false)

  const { data: course, isLoading } = useCourse(courseId)
  const { data: leaderboard } = useCourseLeaderboard(courseId)
  const { data: enrollData } = useEnrollments({ course_id: courseId, limit: 1 })
  const enrollment = enrollData?.items?.[0]

  const createEnrollment = useCreateEnrollment()

  function handleEnroll() {
    setEnrolling(true)
    createEnrollment.mutate(
      { course_id: courseId },
      {
        onSuccess: () => {
          toast('success', 'Enrolled successfully!')
          setEnrolling(false)
        },
        onError: () => {
          toast('error', 'Already enrolled or enrollment failed.')
          setEnrolling(false)
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500">Course not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/hr/lms/catalog')}>
              Back to Catalog
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const modules = course.modules ?? []
  const sortedModules = [...modules].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
        onClick={() => navigate('/hr/lms/catalog')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Catalog
      </button>

      {/* Header card */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Info */}
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {course.category && <Badge variant="primary">{course.category}</Badge>}
              <Badge variant={levelVariant[course.level] as 'success' | 'warning' | 'danger'}>
                {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
              </Badge>
              {course.is_mandatory && <Badge variant="danger">Mandatory</Badge>}
              {!course.is_published && <Badge variant="default">Draft</Badge>}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{course.title}</h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span>⏱ {course.duration_hours} hours</span>
              <span>🎯 Pass score: {course.pass_score}%</span>
              {course.enrollment_count != null && (
                <span>👥 {course.enrollment_count} learners</span>
              )}
            </div>

            {course.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {course.description}
              </p>
            )}

            {/* Skills */}
            {(course.skills_taught?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What you'll learn</p>
                <div className="flex flex-wrap gap-1.5">
                  {course.skills_taught!.map((sk) => (
                    <span
                      key={sk}
                      className="text-xs bg-[#51459d]/10 text-[#51459d] rounded-full px-2.5 py-0.5 font-medium"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Enrollment sidebar */}
          <div className="lg:w-64 shrink-0">
            <div className="border border-gray-100 dark:border-gray-700 rounded-[10px] p-5 space-y-4 bg-gray-50 dark:bg-gray-800/60">
              {enrollment ? (
                <>
                  <div className="flex flex-col items-center gap-2">
                    <CircularProgress pct={Math.round(enrollment.progress_pct)} />
                    <EnrollStatusBadge status={enrollment.status} />
                  </div>
                  {enrollment.quiz_score != null && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Quiz Score</p>
                      <p className="text-2xl font-bold text-[#51459d]">{enrollment.quiz_score}%</p>
                    </div>
                  )}
                  <Button className="w-full" onClick={() => navigate(`/hr/lms/learn/${enrollment.id}`)}>
                    {enrollment.status === 'enrolled' ? 'Start Learning' : 'Continue Learning'}
                  </Button>
                  {enrollment.certificate_url && (
                    <a
                      href={enrollment.certificate_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-center text-xs text-[#51459d] hover:underline"
                    >
                      📜 Download Certificate
                    </a>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    You are not enrolled in this course.
                  </p>
                  <Button className="w-full" onClick={handleEnroll} loading={enrolling}>
                    Enroll Now
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-100 dark:border-gray-700">
        <nav className="flex gap-6">
          {(['overview', 'modules', 'leaderboard'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setTab(t)}
            >
              {t === 'overview' ? 'Overview' : t === 'modules' ? `Modules (${sortedModules.length})` : 'Leaderboard'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      {tab === 'overview' && (
        <Card>
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Course Description</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
              {course.description ?? 'No description provided.'}
            </p>
            {(course.prerequisites?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prerequisites</p>
                <ul className="list-disc list-inside space-y-1">
                  {course.prerequisites!.map((p) => (
                    <li key={p} className="text-sm text-gray-600 dark:text-gray-400">{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === 'modules' && (
        <div className="space-y-2">
          {sortedModules.length === 0 ? (
            <Card>
              <p className="text-center text-gray-400 text-sm py-8">No modules added yet.</p>
            </Card>
          ) : (
            sortedModules.map((mod, idx) => (
              <ModuleItem key={mod.id} mod={mod} idx={idx} />
            ))
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <Card>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Completers</h2>
          {!leaderboard || leaderboard.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No completions yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry, idx) => (
                <div
                  key={entry.employee_id}
                  className="flex items-center gap-4 px-4 py-3 rounded-[10px] bg-gray-50 dark:bg-gray-800/60"
                >
                  <span
                    className={`text-base font-bold w-7 text-center ${
                      idx === 0
                        ? 'text-yellow-500'
                        : idx === 1
                        ? 'text-gray-400'
                        : idx === 2
                        ? 'text-amber-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#51459d]/10 text-[#51459d] flex items-center justify-center font-bold text-sm shrink-0">
                    {entry.employee_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {entry.employee_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Completed {new Date(entry.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#51459d]">{entry.quiz_score}%</p>
                    <p className="text-xs text-gray-400">Score</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
