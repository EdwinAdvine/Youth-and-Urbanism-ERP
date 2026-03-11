import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button, Input, Select } from '../../../components/ui'
import { toast } from '../../../components/ui'
import {
  useCourses,
  useRecommendedCourses,
  useCreateEnrollment,
  type Course,
} from '@/api/hr_lms'

// ─── Level badge colours ──────────────────────────────────────────────────────

const levelVariant: Record<Course['level'], 'success' | 'warning' | 'danger'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
}

const levelLabel: Record<Course['level'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

// ─── Thumbnail placeholder colours ───────────────────────────────────────────

const categoryColors = [
  'bg-[#51459d]/10 text-[#51459d]',
  'bg-[#3ec9d6]/10 text-[#3ec9d6]',
  'bg-[#6fd943]/10 text-[#6fd943]',
  'bg-[#ffa21d]/10 text-[#ffa21d]',
  'bg-[#ff3a6e]/10 text-[#ff3a6e]',
]

function thumbnailColor(category: string | null): string {
  if (!category) return categoryColors[0]
  const idx = Math.abs(category.charCodeAt(0)) % categoryColors.length
  return categoryColors[idx]
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden animate-pulse">
      <div className="h-36 bg-gray-100 dark:bg-gray-700" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700 rounded-full" />
          <div className="h-5 w-20 bg-gray-100 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-[10px]" />
      </div>
    </div>
  )
}

// ─── Course card ─────────────────────────────────────────────────────────────

interface CourseCardProps {
  course: Course
  onEnroll: (id: string) => void
  enrollingId: string | null
}

function CourseCard({ course, onEnroll, enrollingId }: CourseCardProps) {
  const navigate = useNavigate()
  const skills = course.skills_taught?.slice(0, 3) ?? []

  return (
    <div
      className="relative bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
    >
      {/* Mandatory ribbon */}
      {course.is_mandatory && (
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-[#ff3a6e] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Mandatory
          </span>
        </div>
      )}

      {/* Thumbnail */}
      {course.thumbnail_url ? (
        <img
          src={course.thumbnail_url}
          alt={course.title}
          className="h-36 w-full object-cover cursor-pointer"
          onClick={() => navigate(`/hr/lms/courses/${course.id}`)}
        />
      ) : (
        <div
          className={`h-36 flex items-center justify-center cursor-pointer ${thumbnailColor(course.category)}`}
          onClick={() => navigate(`/hr/lms/courses/${course.id}`)}
        >
          <span className="text-4xl select-none">📚</span>
        </div>
      )}

      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Title */}
        <h3
          className="font-semibold text-gray-900 dark:text-gray-100 leading-tight cursor-pointer hover:text-primary line-clamp-2"
          onClick={() => navigate(`/hr/lms/courses/${course.id}`)}
        >
          {course.title}
        </h3>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {course.category && (
            <Badge variant="primary">{course.category}</Badge>
          )}
          <Badge variant={levelVariant[course.level]}>
            {levelLabel[course.level]}
          </Badge>
        </div>

        {/* Duration + enrollments */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>⏱ {course.duration_hours}h</span>
          {course.enrollment_count != null && (
            <span>👥 {course.enrollment_count} enrolled</span>
          )}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skills.map((sk) => (
              <span
                key={sk}
                className="text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5"
              >
                {sk}
              </span>
            ))}
            {(course.skills_taught?.length ?? 0) > 3 && (
              <span className="text-[11px] text-gray-400">
                +{(course.skills_taught?.length ?? 0) - 3} more
              </span>
            )}
          </div>
        )}

        {/* Enroll button */}
        <div className="mt-auto">
          <Button
            className="w-full"
            size="sm"
            onClick={() => onEnroll(course.id)}
            loading={enrollingId === course.id}
          >
            Enroll
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Recommended course chip ──────────────────────────────────────────────────

function RecommendedChip({ course }: { course: Course }) {
  const navigate = useNavigate()
  return (
    <div
      className="flex items-center gap-3 bg-[#51459d]/5 border border-[#51459d]/20 rounded-[10px] px-4 py-3 cursor-pointer hover:bg-[#51459d]/10 transition-colors min-w-[220px]"
      onClick={() => navigate(`/hr/lms/courses/${course.id}`)}
    >
      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-lg shrink-0 ${thumbnailColor(course.category)}`}>
        📚
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{course.title}</p>
        <p className="text-xs text-gray-500">{course.duration_hours}h · {levelLabel[course.level]}</p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CourseCatalogPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState<Course['level'] | ''>('')
  const [mandatory, setMandatory] = useState(false)
  const [published, setPublished] = useState(true)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  const { data, isLoading } = useCourses({
    search: search || undefined,
    category: category || undefined,
    level: level || undefined,
    is_mandatory: mandatory || undefined,
    is_published: published || undefined,
  })

  const { data: recommended, isLoading: recLoading } = useRecommendedCourses()
  const createEnrollment = useCreateEnrollment()

  function handleEnroll(courseId: string) {
    setEnrollingId(courseId)
    createEnrollment.mutate(
      { course_id: courseId },
      {
        onSuccess: () => {
          toast('success', 'Enrolled successfully!')
          setEnrollingId(null)
        },
        onError: () => {
          toast('error', 'Failed to enroll. You may already be enrolled.')
          setEnrollingId(null)
        },
      },
    )
  }

  const courses = data?.items ?? []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Course Catalog</h1>
        <p className="text-sm text-gray-500 mt-1">Browse and enroll in learning courses</p>
      </div>

      {/* Recommended for You */}
      {!recLoading && (recommended?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
            ⭐ Recommended for You
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recommended!.map((c) => (
              <RecommendedChip key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <div className="w-44">
          <Input
            placeholder="Category..."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            value={level}
            onChange={(e) => setLevel(e.target.value as Course['level'] | '')}
            options={[
              { value: '', label: 'All Levels' },
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30"
            checked={mandatory}
            onChange={(e) => setMandatory(e.target.checked)}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Mandatory only</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Published only</span>
        </label>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500 text-sm">No courses found matching your filters.</p>
          </div>
        </Card>
      ) : (
        <>
          <p className="text-sm text-gray-500">{data?.total ?? courses.length} courses found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onEnroll={handleEnroll}
                enrollingId={enrollingId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
