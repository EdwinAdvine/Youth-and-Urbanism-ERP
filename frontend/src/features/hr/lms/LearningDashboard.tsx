import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button, Spinner, Table } from '../../../components/ui'
import {
  useLMSDashboard,
  useEnrollments,
  useCourses,
  useCertifications,
  type CourseEnrollment,
  type Certification,
} from '@/api/hr_lms'

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string | number
  icon: string
  color: string
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center text-xl shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </Card>
  )
}

// ─── Enrollment status badge ──────────────────────────────────────────────────

function EnrollBadge({ status }: { status: CourseEnrollment['status'] }) {
  const cfg: Record<CourseEnrollment['status'], { variant: 'default' | 'info' | 'success' | 'danger' | 'warning'; label: string }> = {
    enrolled: { variant: 'info', label: 'Enrolled' },
    in_progress: { variant: 'info', label: 'In Progress' },
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'danger', label: 'Failed' },
  }
  const { variant, label } = cfg[status] ?? { variant: 'default' as const, label: status }
  return <Badge variant={variant as 'default' | 'info' | 'success' | 'danger'}>{label}</Badge>
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, color = '#51459d' }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─── Progress card ────────────────────────────────────────────────────────────

function EnrollmentCard({ enrollment }: { enrollment: CourseEnrollment }) {
  const navigate = useNavigate()
  const course = enrollment.course
  const pct = Math.round(enrollment.progress_pct)

  const progressColor =
    enrollment.status === 'completed'
      ? '#6fd943'
      : enrollment.status === 'failed'
      ? '#ff3a6e'
      : '#51459d'

  return (
    <Card className="flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Thumbnail placeholder */}
        <div className="w-14 h-14 rounded-[10px] bg-[#51459d]/10 flex items-center justify-center text-2xl shrink-0">
          📚
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight truncate">
            {course?.title ?? 'Unknown Course'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <EnrollBadge status={enrollment.status} />
            {course?.is_mandatory && (
              <span className="text-[10px] bg-[#ff3a6e]/10 text-[#ff3a6e] rounded-full px-2 py-0.5 font-medium">
                Mandatory
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span className="font-semibold" style={{ color: progressColor }}>{pct}%</span>
        </div>
        <ProgressBar pct={pct} color={progressColor} />
      </div>

      {/* Last activity + score */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {enrollment.started_at
            ? `Last activity: ${new Date(enrollment.started_at).toLocaleDateString()}`
            : 'Not started yet'}
        </span>
        {enrollment.quiz_score != null && (
          <span className="font-medium text-[#51459d]">Score: {enrollment.quiz_score}%</span>
        )}
      </div>

      {/* CTA */}
      <Button
        size="sm"
        variant={enrollment.status === 'completed' ? 'outline' : 'primary'}
        onClick={() => navigate(`/hr/lms/learn/${enrollment.id}`)}
      >
        {enrollment.status === 'enrolled'
          ? 'Start'
          : enrollment.status === 'completed'
          ? 'Review'
          : 'Continue'}
      </Button>
    </Card>
  )
}

// ─── Cert expiry badge ────────────────────────────────────────────────────────

function CertExpiryCell({ expiry }: { expiry: string | null }) {
  if (!expiry) return <span className="text-gray-400 text-sm">No expiry</span>
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000)
  const isExpired = days < 0
  const isSoon = days >= 0 && days < 30

  return (
    <span className={`text-sm font-medium ${isExpired ? 'text-[#ff3a6e]' : isSoon ? 'text-[#ffa21d]' : 'text-gray-600 dark:text-gray-400'}`}>
      {new Date(expiry).toLocaleDateString()}
      {isExpired && ' (Expired)'}
      {isSoon && !isExpired && ` (${days}d)`}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LearningDashboard() {
  const navigate = useNavigate()

  const { data: lmsDash, isLoading: dashLoading } = useLMSDashboard()
  const { data: enrollData, isLoading: enrollLoading } = useEnrollments({ limit: 50 })
  const { data: certData } = useCertifications({ limit: 10 })
  const { data: mandatoryData } = useCourses({ is_mandatory: true, is_published: true, limit: 50 })

  const enrollments = enrollData?.items ?? []
  const certs = certData?.items ?? []
  const mandatoryCourses = mandatoryData?.items ?? []

  // Compute stats from enrollment data
  const totalEnrolled = enrollData?.total ?? 0
  const completed = enrollments.filter((e) => e.status === 'completed').length
  const inProgress = enrollments.filter((e) => e.status === 'in_progress').length
  const scores = enrollments.filter((e) => e.quiz_score != null).map((e) => e.quiz_score!)
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  // Upcoming mandatory = mandatory courses not yet enrolled
  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id))
  const upcomingMandatory = mandatoryCourses.filter((c) => !enrolledCourseIds.has(c.id))

  // Leaderboard from top_courses in dashboard
  const topCourses = lmsDash?.top_courses ?? []

  // Cert table columns
  const certColumns = [
    {
      key: 'name',
      label: 'Certification',
      render: (c: Certification) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{c.name}</p>
          {c.credential_id && <p className="text-xs text-gray-400">ID: {c.credential_id}</p>}
        </div>
      ),
    },
    {
      key: 'issuer',
      label: 'Issuer',
      render: (c: Certification) => <span className="text-sm text-gray-600 dark:text-gray-400">{c.issuer ?? '—'}</span>,
    },
    {
      key: 'issue_date',
      label: 'Issued',
      render: (c: Certification) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(c.issue_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'expiry_date',
      label: 'Expires',
      render: (c: Certification) => <CertExpiryCell expiry={c.expiry_date} />,
    },
    {
      key: 'is_verified',
      label: 'Status',
      render: (c: Certification) => (
        <Badge variant={c.is_verified ? 'success' : 'default'}>
          {c.is_verified ? '✓ Verified' : 'Unverified'}
        </Badge>
      ),
    },
  ]

  if (dashLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Learning</h1>
          <p className="text-sm text-gray-500 mt-1">Track your courses, certifications and learning progress</p>
        </div>
        <Button onClick={() => navigate('/hr/lms/catalog')}>Browse Catalog</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Enrolled Courses" value={totalEnrolled} icon="📚" color="bg-[#51459d]/10 text-[#51459d]" />
        <StatCard label="Completed" value={completed} icon="✅" color="bg-[#6fd943]/10 text-[#6fd943]" />
        <StatCard label="In Progress" value={inProgress} icon="⏳" color="bg-[#3ec9d6]/10 text-[#3ec9d6]" />
        <StatCard label="Avg Score" value={avgScore ? `${avgScore}%` : '—'} icon="🏆" color="bg-[#ffa21d]/10 text-[#ffa21d]" />
      </div>

      {/* Upcoming mandatory */}
      {upcomingMandatory.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              ⚠️ Mandatory Courses — Not Yet Started ({upcomingMandatory.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingMandatory.slice(0, 6).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 bg-[#ff3a6e]/5 border border-[#ff3a6e]/20 rounded-[10px] px-4 py-3 cursor-pointer hover:bg-[#ff3a6e]/10 transition-colors"
                onClick={() => navigate(`/hr/lms/courses/${c.id}`)}
              >
                <span className="text-2xl shrink-0">📌</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{c.title}</p>
                  <p className="text-xs text-gray-500">{c.duration_hours}h · {c.level}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Progress cards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">My Courses</h2>
        </div>
        {enrollLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 shadow-sm p-6 animate-pulse space-y-3">
                <div className="flex gap-3">
                  <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-[10px]" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full" />
                <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-[10px]" />
              </div>
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-gray-500 text-sm">You haven't enrolled in any courses yet.</p>
              <Button className="mt-4" onClick={() => navigate('/hr/lms/catalog')}>
                Browse Catalog
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.map((e) => (
              <EnrollmentCard key={e.id} enrollment={e} />
            ))}
          </div>
        )}
      </section>

      {/* Certifications */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">My Certifications</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/hr/lms/certifications')}>
            Manage All
          </Button>
        </div>
        <Card padding={false}>
          <Table
            columns={certColumns}
            data={certs}
            keyExtractor={(c) => c.id}
            emptyText="No certifications on record. Add your first certification."
          />
        </Card>
      </section>

      {/* Leaderboard */}
      {topCourses.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
            🏆 Top Courses This Month
          </h2>
          <Card>
            <div className="space-y-2">
              {topCourses.map((tc, idx) => (
                <div
                  key={tc.course_id}
                  className="flex items-center gap-4 px-3 py-2.5 rounded-[10px] hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/hr/lms/courses/${tc.course_id}`)}
                >
                  <span
                    className={`text-sm font-bold w-6 text-center ${
                      idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-gray-400'
                    }`}
                  >
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <p className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{tc.title}</p>
                  <Badge variant="primary">{tc.enrollments} enrolled</Badge>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* LMS overview stats (if admin data available) */}
      {lmsDash && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">LMS Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="text-center">
              <p className="text-2xl font-bold text-[#51459d]">{lmsDash.total_courses}</p>
              <p className="text-xs text-gray-500 mt-1">Total Courses</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-[#3ec9d6]">{lmsDash.enrolled_employees}</p>
              <p className="text-xs text-gray-500 mt-1">Enrolled Employees</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-[#6fd943]">{lmsDash.completions_this_month}</p>
              <p className="text-xs text-gray-500 mt-1">Completions This Month</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-[#ffa21d]">{Math.round(lmsDash.avg_completion_pct)}%</p>
              <p className="text-xs text-gray-500 mt-1">Avg Completion</p>
            </Card>
          </div>
        </section>
      )}
    </div>
  )
}
