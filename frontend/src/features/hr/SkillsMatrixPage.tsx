import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useSkillsMatrix,
  useSkillGapAnalysis,
  type SkillsMatrixEntry,
  type SkillGapEntry,
} from '../../api/hr_phase1'

const categoryOptions = [
  { value: '', label: 'All Categories' },
  { value: 'technical', label: 'Technical' },
  { value: 'soft', label: 'Soft' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'domain', label: 'Domain' },
]

const departmentOptions = [
  { value: '', label: 'All Departments' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'finance', label: 'Finance' },
  { value: 'operations', label: 'Operations' },
]

function ProficiencyStars({ value }: { value: number }) {
  const rounded = Math.round(value)
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-sm ${star <= rounded ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
          >
            ★
          </span>
        ))}
      </div>
      <Badge variant={value >= 4 ? 'success' : value >= 3 ? 'info' : value >= 2 ? 'warning' : 'default'}>
        {value.toFixed(1)}
      </Badge>
    </div>
  )
}

export default function SkillsMatrixPage() {
  const [departmentId, setDepartmentId] = useState('')
  const [category, setCategory] = useState('')
  const [skillName, setSkillName] = useState('')
  const [gapDeptId, setGapDeptId] = useState('')
  const [showGapModal, setShowGapModal] = useState(false)

  const { data: matrixData, isLoading } = useSkillsMatrix({
    department_id: departmentId || undefined,
    category: category || undefined,
    skill_name: skillName || undefined,
  })

  const { data: gapData, isLoading: gapLoading } = useSkillGapAnalysis(gapDeptId)

  function openGapAnalysis(deptId: string) {
    setGapDeptId(deptId)
    setShowGapModal(true)
  }

  function handleExport() {
    const items: SkillsMatrixEntry[] = matrixData ?? []
    if (items.length === 0) {
      toast('warning', 'No data to export')
      return
    }
    const header = 'Skill Name,Category,Employees,Avg Proficiency'
    const rows = items.map(
      (r) => `"${r.skill_name}","${r.category}",${r.employee_count},${r.avg_proficiency.toFixed(2)}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'skills_matrix.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast('success', 'Export downloaded')
  }

  const categoryVariant: Record<string, 'primary' | 'info' | 'warning' | 'success'> = {
    technical: 'primary',
    soft: 'info',
    leadership: 'warning',
    domain: 'success',
  }

  const columns = [
    {
      key: 'skill_name',
      label: 'Skill Name',
      render: (r: SkillsMatrixEntry) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{r.skill_name}</span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (r: SkillsMatrixEntry) => (
        <Badge variant={categoryVariant[r.category] ?? 'default'}>
          {r.category}
        </Badge>
      ),
    },
    {
      key: 'employee_count',
      label: 'Employees',
      render: (r: SkillsMatrixEntry) => (
        <span className="text-gray-700 dark:text-gray-300">{r.employee_count}</span>
      ),
    },
    {
      key: 'avg_proficiency',
      label: 'Avg Proficiency',
      render: (r: SkillsMatrixEntry) => <ProficiencyStars value={r.avg_proficiency} />,
    },
  ]

  const gapColumns = [
    {
      key: 'skill_name',
      label: 'Skill',
      render: (r: SkillGapEntry) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{r.skill_name}</span>
      ),
    },
    {
      key: 'current_avg',
      label: 'Current Avg',
      render: (r: SkillGapEntry) => r.current_avg.toFixed(1),
    },
    {
      key: 'needed_level',
      label: 'Needed Level',
      render: (r: SkillGapEntry) => r.needed_level.toFixed(1),
    },
    {
      key: 'gap',
      label: 'Gap',
      render: (r: SkillGapEntry) => (
        <Badge variant={r.gap >= 2 ? 'danger' : r.gap >= 1 ? 'warning' : 'info'}>
          -{r.gap.toFixed(1)}
        </Badge>
      ),
    },
    {
      key: 'employees_with_skill',
      label: 'Employees w/ Skill',
      render: (r: SkillGapEntry) => r.employees_with_skill,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Skills Matrix</h1>
          <p className="text-sm text-gray-500 mt-1">Organization-wide skills overview and gap analysis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>Export CSV</Button>
          <Button onClick={() => openGapAnalysis(departmentId || departmentOptions[1]?.value || 'engineering')}>
            Gap Analysis
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select
          options={departmentOptions}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="w-48"
        />
        <Select
          options={categoryOptions}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-48"
        />
        <Input
          placeholder="Search skill name..."
          value={skillName}
          onChange={(e) => setSkillName(e.target.value)}
          className="w-56"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={(matrixData as SkillsMatrixEntry[]) ?? []}
          keyExtractor={(r) => `${r.skill_name}-${r.category}`}
          emptyText="No skills data found."
        />
      </Card>

      {/* Gap Analysis by Department */}
      {departmentId && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Department Gap Analysis
            </h2>
            <Button variant="ghost" size="sm" onClick={() => openGapAnalysis(departmentId)}>
              View Details
            </Button>
          </div>
        </Card>
      )}

      <Modal open={showGapModal} onClose={() => setShowGapModal(false)} title="Skill Gap Analysis" size="xl">
        {gapLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Skills where current proficiency falls below the needed level.
            </p>
            <Table
              columns={gapColumns}
              data={(gapData as SkillGapEntry[]) ?? []}
              keyExtractor={(r) => r.skill_name}
              emptyText="No skill gaps identified."
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
