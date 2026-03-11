import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Badge, Button, Spinner, Input, Select } from '../../../components/ui'
import { toast } from '../../../components/ui'
import {
  useCourse,
  useCourseModules,
  useCreateCourse,
  useUpdateCourse,
  useCreateCourseModule,
  useUpdateCourseModule,
  useDeleteCourseModule,
  type Course,
  type CourseModule,
  type CreateCoursePayload,
  type CreateCourseModulePayload,
  type QuizQuestion,
} from '@/api/hr_lms'

// ─── Types ────────────────────────────────────────────────────────────────────

const MODULE_TYPES: { value: CourseModule['module_type']; label: string; icon: string }[] = [
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'document', label: 'Document', icon: '📄' },
  { value: 'quiz', label: 'Quiz', icon: '✍️' },
  { value: 'scorm', label: 'SCORM', icon: '🔗' },
]

// ─── Default form values ──────────────────────────────────────────────────────

const defaultCourseForm: CreateCoursePayload = {
  title: '',
  description: '',
  category: '',
  level: 'beginner',
  duration_hours: 1,
  pass_score: 70,
  is_mandatory: false,
  is_published: false,
  skills_taught: [],
}

const defaultModuleForm: CreateCourseModulePayload = {
  title: '',
  module_type: 'video',
  duration_minutes: 10,
  is_required: true,
  content_url: '',
  quiz_questions: [],
}

const defaultQuestion: QuizQuestion = {
  question: '',
  options: ['', '', '', ''],
  correct_index: 0,
  points: 10,
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
          />
        </div>
      </div>
    </label>
  )
}

// ─── Quiz question editor ─────────────────────────────────────────────────────

interface QuizEditorProps {
  questions: QuizQuestion[]
  onChange: (qs: QuizQuestion[]) => void
}

function QuizEditor({ questions, onChange }: QuizEditorProps) {
  function addQuestion() {
    onChange([...questions, { ...defaultQuestion, options: ['', '', '', ''] }])
  }

  function updateQuestion(idx: number, patch: Partial<QuizQuestion>) {
    const updated = questions.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    onChange(updated)
  }

  function updateOption(qi: number, oi: number, value: string) {
    const updated = questions.map((q, i) => {
      if (i !== qi) return q
      const opts = [...q.options]
      opts[oi] = value
      return { ...q, options: opts }
    })
    onChange(updated)
  }

  function removeQuestion(idx: number) {
    onChange(questions.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Quiz Questions ({questions.length})
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          + Add Question
        </Button>
      </div>
      {questions.map((q, qi) => (
        <div
          key={qi}
          className="border border-gray-100 dark:border-gray-700 rounded-[10px] p-3 space-y-2 bg-gray-50 dark:bg-gray-800/40"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                placeholder={`Question ${qi + 1}`}
                value={q.question}
                onChange={(e) => updateQuestion(qi, { question: e.target.value })}
              />
            </div>
            <Button type="button" variant="ghost" size="sm" className="text-danger mt-0.5" onClick={() => removeQuestion(qi)}>
              ✕
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={q.correct_index === oi}
                  onChange={() => updateQuestion(qi, { correct_index: oi })}
                  className="w-3.5 h-3.5 text-primary"
                  title={`Mark option ${oi + 1} as correct`}
                />
                <input
                  type="text"
                  placeholder={`Option ${oi + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                  className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-gray-900 dark:text-gray-100"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">Points:</label>
            <input
              type="number"
              min={1}
              value={q.points}
              onChange={(e) => updateQuestion(qi, { points: Number(e.target.value) })}
              className="w-16 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-900 dark:text-gray-100"
            />
            <Select
              value={String(q.correct_index)}
              onChange={(e) => updateQuestion(qi, { correct_index: Number(e.target.value) })}
              options={q.options.map((_, oi) => ({ value: String(oi), label: `Correct: Option ${oi + 1}` }))}
              className="text-xs py-1 h-7"
            />
          </div>
        </div>
      ))}
      {questions.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center py-2">No questions yet. Click "+ Add Question" to begin.</p>
      )}
    </div>
  )
}

// ─── Module row ───────────────────────────────────────────────────────────────

interface ModuleRowProps {
  mod: CourseModule
  courseId: string
  onEdited: () => void
}

function ModuleRow({ mod, courseId, onEdited }: ModuleRowProps) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CreateCourseModulePayload>({
    title: mod.title,
    module_type: mod.module_type,
    duration_minutes: mod.duration_minutes,
    is_required: mod.is_required,
    content_url: mod.content_url ?? '',
    quiz_questions: mod.quiz_questions ?? [],
  })

  const updateModule = useUpdateCourseModule()
  const deleteModule = useDeleteCourseModule()

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    updateModule.mutate(
      { courseId, moduleId: mod.id, ...form, content_url: form.content_url || null },
      {
        onSuccess: () => {
          toast('success', 'Module updated')
          setEditing(false)
          onEdited()
        },
        onError: () => toast('error', 'Failed to update module'),
      },
    )
  }

  function handleDelete() {
    if (!confirm(`Delete module "${mod.title}"?`)) return
    deleteModule.mutate(
      { courseId, moduleId: mod.id },
      {
        onSuccess: () => { toast('success', 'Module deleted'); onEdited() },
        onError: () => toast('error', 'Failed to delete module'),
      },
    )
  }

  const typeInfo = MODULE_TYPES.find((t) => t.value === mod.module_type)

  if (!editing) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] group">
        {/* drag handle (visual only) */}
        <span className="text-gray-300 cursor-grab text-sm select-none">⠿⠿</span>
        <span className="text-base">{typeInfo?.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{mod.title}</p>
          <p className="text-xs text-gray-400">{mod.duration_minutes}min · {typeInfo?.label}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {mod.is_required && <Badge variant="danger" className="text-[10px]">Required</Badge>}
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={handleDelete}
            loading={deleteModule.isPending}
          >
            Delete
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleUpdate}
      className="border border-primary/30 bg-[#51459d]/5 dark:bg-[#51459d]/10 rounded-[10px] p-3 space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />
        <Select
          label="Type"
          value={form.module_type}
          onChange={(e) => setForm((p) => ({ ...p, module_type: e.target.value as CourseModule['module_type'] }))}
          options={MODULE_TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Duration (minutes)"
          type="number"
          min={1}
          value={form.duration_minutes}
          onChange={(e) => setForm((p) => ({ ...p, duration_minutes: Number(e.target.value) }))}
        />
        <Input
          label="Content URL"
          value={form.content_url ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, content_url: e.target.value }))}
        />
      </div>
      <Toggle
        label="Required module"
        checked={form.is_required ?? true}
        onChange={(v) => setForm((p) => ({ ...p, is_required: v }))}
      />
      {form.module_type === 'quiz' && (
        <QuizEditor
          questions={form.quiz_questions ?? []}
          onChange={(qs) => setForm((p) => ({ ...p, quiz_questions: qs }))}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        <Button type="submit" size="sm" loading={updateModule.isPending}>Save Module</Button>
      </div>
    </form>
  )
}

// ─── Add module form ──────────────────────────────────────────────────────────

function AddModuleForm({ courseId, onAdded }: { courseId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateCourseModulePayload>({ ...defaultModuleForm })
  const createModule = useCreateCourseModule()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createModule.mutate(
      { courseId, ...form, content_url: form.content_url || null },
      {
        onSuccess: () => {
          toast('success', 'Module added')
          setForm({ ...defaultModuleForm })
          setOpen(false)
          onAdded()
        },
        onError: () => toast('error', 'Failed to add module'),
      },
    )
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        + Add Module
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-primary/30 bg-[#51459d]/5 dark:bg-[#51459d]/10 rounded-[10px] p-3 space-y-3">
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">New Module</p>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />
        <Select
          label="Type"
          value={form.module_type}
          onChange={(e) => setForm((p) => ({ ...p, module_type: e.target.value as CourseModule['module_type'] }))}
          options={MODULE_TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Duration (minutes)"
          type="number"
          min={1}
          value={form.duration_minutes}
          onChange={(e) => setForm((p) => ({ ...p, duration_minutes: Number(e.target.value) }))}
        />
        <Input
          label="Content URL"
          value={form.content_url ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, content_url: e.target.value }))}
        />
      </div>
      <Toggle
        label="Required module"
        checked={form.is_required ?? true}
        onChange={(v) => setForm((p) => ({ ...p, is_required: v }))}
      />
      {form.module_type === 'quiz' && (
        <QuizEditor
          questions={form.quiz_questions ?? []}
          onChange={(qs) => setForm((p) => ({ ...p, quiz_questions: qs }))}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" loading={createModule.isPending}>Add Module</Button>
      </div>
    </form>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CourseBuilderPage() {
  const { courseId } = useParams<{ courseId?: string }>()
  const navigate = useNavigate()
  const isEditing = !!courseId

  // ─── Course data (edit mode) ─────────────────────────────────────────────
  const { data: existingCourse, isLoading: courseLoading } = useCourse(courseId ?? '')
  const { data: existingModules, isLoading: modulesLoading } = useCourseModules(courseId ?? '')

  const createCourse = useCreateCourse()
  const updateCourse = useUpdateCourse()

  // ─── Course form ─────────────────────────────────────────────────────────
  const [form, setForm] = useState<CreateCoursePayload>({ ...defaultCourseForm })
  const [skillInput, setSkillInput] = useState('')

  useEffect(() => {
    if (existingCourse) {
      setForm({
        title: existingCourse.title,
        description: existingCourse.description ?? '',
        category: existingCourse.category ?? '',
        level: existingCourse.level,
        duration_hours: existingCourse.duration_hours,
        pass_score: existingCourse.pass_score,
        is_mandatory: existingCourse.is_mandatory,
        is_published: existingCourse.is_published,
        skills_taught: existingCourse.skills_taught ?? [],
      })
    }
  }, [existingCourse])

  function addSkill() {
    const sk = skillInput.trim()
    if (!sk) return
    if (!(form.skills_taught ?? []).includes(sk)) {
      setForm((p) => ({ ...p, skills_taught: [...(p.skills_taught ?? []), sk] }))
    }
    setSkillInput('')
  }

  function removeSkill(sk: string) {
    setForm((p) => ({ ...p, skills_taught: (p.skills_taught ?? []).filter((s) => s !== sk) }))
  }

  function handleSave(publish: boolean) {
    const payload = { ...form, is_published: publish }
    if (isEditing && courseId) {
      updateCourse.mutate(
        { id: courseId, ...payload },
        {
          onSuccess: () => {
            toast('success', publish ? 'Course published!' : 'Draft saved')
          },
          onError: () => toast('error', 'Failed to save course'),
        },
      )
    } else {
      createCourse.mutate(payload, {
        onSuccess: (course) => {
          toast('success', publish ? 'Course published!' : 'Draft saved')
          navigate(`/hr/lms/builder/${course.id}`)
        },
        onError: () => toast('error', 'Failed to create course'),
      })
    }
  }

  const isSaving = createCourse.isPending || updateCourse.isPending

  if (isEditing && (courseLoading || modulesLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const modules = (existingModules ?? []).slice().sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Course' : 'New Course'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEditing ? `Editing: ${existingCourse?.title ?? ''}` : 'Create a new learning course'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            loading={isSaving}
          >
            Save Draft
          </Button>
          <Button
            onClick={() => handleSave(true)}
            loading={isSaving}
          >
            Save &amp; Publish
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left: Course settings form */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Course Settings</h2>
          <div className="space-y-4">
            <Input
              label="Title"
              required
              placeholder="e.g. Introduction to Cybersecurity"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                rows={4}
                placeholder="Describe what learners will gain from this course..."
                value={form.description ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Category"
                placeholder="e.g. IT Security"
                value={form.category ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
              <Select
                label="Level"
                value={form.level ?? 'beginner'}
                onChange={(e) => setForm((p) => ({ ...p, level: e.target.value as Course['level'] }))}
                options={[
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'intermediate', label: 'Intermediate' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Duration (hours)"
                type="number"
                min={0.5}
                step={0.5}
                value={form.duration_hours}
                onChange={(e) => setForm((p) => ({ ...p, duration_hours: Number(e.target.value) }))}
              />
              <Input
                label="Pass Score (%)"
                type="number"
                min={1}
                max={100}
                value={form.pass_score}
                onChange={(e) => setForm((p) => ({ ...p, pass_score: Number(e.target.value) }))}
              />
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skills Taught</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a skill and press Enter"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                  className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <Button type="button" variant="outline" size="sm" onClick={addSkill}>Add</Button>
              </div>
              {(form.skills_taught ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.skills_taught!.map((sk) => (
                    <span
                      key={sk}
                      className="inline-flex items-center gap-1 text-xs bg-[#51459d]/10 text-[#51459d] rounded-full px-2.5 py-0.5"
                    >
                      {sk}
                      <button
                        type="button"
                        onClick={() => removeSkill(sk)}
                        className="text-[#51459d]/60 hover:text-[#51459d] font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
              <Toggle
                label="Mandatory for all employees"
                checked={form.is_mandatory ?? false}
                onChange={(v) => setForm((p) => ({ ...p, is_mandatory: v }))}
              />
              <Toggle
                label="Published (visible to learners)"
                checked={form.is_published ?? false}
                onChange={(v) => setForm((p) => ({ ...p, is_published: v }))}
              />
            </div>
          </div>
        </Card>

        {/* Right: Modules panel */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Modules {isEditing && <span className="text-gray-400 font-normal text-sm">({modules.length})</span>}
            </h2>
            {!isEditing && (
              <p className="text-xs text-gray-400 italic">Save the course first to add modules</p>
            )}
          </div>

          {!isEditing ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">🧱</p>
              <p className="text-sm">Create the course to unlock the modules panel.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {modules.length === 0 && (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-2xl mb-1">📭</p>
                  <p className="text-sm">No modules yet. Add your first module below.</p>
                </div>
              )}
              {modules.map((mod) => (
                <ModuleRow
                  key={mod.id}
                  mod={mod}
                  courseId={courseId!}
                  onEdited={() => {}}
                />
              ))}
              <AddModuleForm courseId={courseId!} onAdded={() => {}} />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
