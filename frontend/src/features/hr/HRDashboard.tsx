import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button, Spinner, Table, Modal, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useHRDashboardStats,
  useLeaveRequests,
  useCreateEmployee,
  useCreateLeaveRequest,
  useDepartments,
  useMyEmployeeProfile,
  type CreateEmployeePayload,
  type CreateLeaveRequestPayload,
  type LeaveRequest,
  type LeaveStatus,
} from '../../api/hr'

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center text-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </Card>
  )
}

// ─── Leave Status Badge ───────────────────────────────────────────────────────

function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const map: Record<LeaveStatus, { variant: 'warning' | 'success' | 'danger' | 'default'; label: string }> = {
    pending: { variant: 'warning', label: 'Pending' },
    approved: { variant: 'success', label: 'Approved' },
    rejected: { variant: 'danger', label: 'Rejected' },
    cancelled: { variant: 'default', label: 'Cancelled' },
  }
  const { variant, label } = map[status] ?? { variant: 'default' as const, label: status }
  return <Badge variant={variant}>{label}</Badge>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HRDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useHRDashboardStats()
  const { data: recentLeaves, isLoading: leavesLoading } = useLeaveRequests({ page: 1, limit: 5 })
  const { data: departments } = useDepartments()
  const { data: myProfile } = useMyEmployeeProfile()

  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)

  // ─── Add Employee ───────────────────────────────────────────────────────────

  const createEmployee = useCreateEmployee()
  const [empForm, setEmpForm] = useState<CreateEmployeePayload>({
    employee_number: '',
    first_name: '',
    last_name: '',
    email: '',
    job_title: '',
    employment_type: 'full_time',
    hire_date: new Date().toISOString().split('T')[0],
  })

  function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault()
    createEmployee.mutate(empForm, {
      onSuccess: () => {
        toast('success', 'Employee created successfully')
        setShowAddEmployee(false)
        setEmpForm({
          employee_number: '',
          first_name: '',
          last_name: '',
          email: '',
          job_title: '',
          employment_type: 'full_time',
          hire_date: new Date().toISOString().split('T')[0],
        })
      },
      onError: () => toast('error', 'Failed to create employee'),
    })
  }

  // ─── Submit Leave ───────────────────────────────────────────────────────────

  const createLeave = useCreateLeaveRequest()
  const [leaveForm, setLeaveForm] = useState<CreateLeaveRequestPayload>({
    employee_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
  })

  function handleSubmitLeave(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...leaveForm, employee_id: leaveForm.employee_id || myProfile?.id || '' }
    createLeave.mutate(payload, {
      onSuccess: () => {
        toast('success', 'Leave request submitted')
        setShowLeaveModal(false)
        setLeaveForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' })
      },
      onError: () => toast('error', 'Failed to submit leave request'),
    })
  }

  // ─── Recent Leave Columns ───────────────────────────────────────────────────

  const leaveColumns = [
    { key: 'employee_name', label: 'Employee', render: (r: LeaveRequest) => r.employee_name ?? '—' },
    { key: 'leave_type', label: 'Type', render: (r: LeaveRequest) => <span className="capitalize">{r.leave_type.replace('_', ' ')}</span> },
    { key: 'start_date', label: 'From', render: (r: LeaveRequest) => new Date(r.start_date).toLocaleDateString() },
    { key: 'end_date', label: 'To', render: (r: LeaveRequest) => new Date(r.end_date).toLocaleDateString() },
    { key: 'status', label: 'Status', render: (r: LeaveRequest) => <LeaveStatusBadge status={r.status} /> },
  ]

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">HR Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Human Resources overview and quick actions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowLeaveModal(true)}>
            Submit Leave Request
          </Button>
          <Button onClick={() => setShowAddEmployee(true)}>
            Add Employee
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={stats?.total_employees ?? 0}
          color="bg-primary/10 text-primary"
          icon="👥"
        />
        <StatCard
          label="On Leave Today"
          value={stats?.on_leave_today ?? 0}
          color="bg-orange-100 text-orange-600"
          icon="🏖"
        />
        <StatCard
          label="Attendance Rate"
          value={`${stats?.attendance_rate ?? 0}%`}
          color="bg-green-100 text-green-600"
          icon="📊"
        />
        <StatCard
          label="Open Leave Requests"
          value={stats?.open_leave_requests ?? 0}
          color="bg-cyan-100 text-cyan-600"
          icon="📋"
        />
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/employees')}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Employees</p>
          <p className="text-xs text-gray-400 mt-1">Manage employee records</p>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/departments')}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Departments</p>
          <p className="text-xs text-gray-400 mt-1">Org structure</p>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/leave')}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Leave Requests</p>
          <p className="text-xs text-gray-400 mt-1">Review and manage</p>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/attendance')}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Attendance</p>
          <p className="text-xs text-gray-400 mt-1">Check in/out logs</p>
        </Card>
      </div>

      {/* Phase 1 — New Modules */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">People & Performance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/skills-matrix')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Skills Matrix</p>
            <p className="text-xs text-gray-400 mt-1">Org-wide skills & gap analysis</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/goals')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Goals & OKR</p>
            <p className="text-xs text-gray-400 mt-1">Objectives & key results</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/feedback')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Feedback</p>
            <p className="text-xs text-gray-400 mt-1">Continuous peer feedback</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/review-cycles')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">360° Reviews</p>
            <p className="text-xs text-gray-400 mt-1">Review cycles & assignments</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/succession-planning')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Succession Planning</p>
            <p className="text-xs text-gray-400 mt-1">Plan for key positions</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/manager-dashboard')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Manager Dashboard</p>
            <p className="text-xs text-gray-400 mt-1">Team insights & delegation</p>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Compensation & Scheduling</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/compensation-bands')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Compensation Bands</p>
            <p className="text-xs text-gray-400 mt-1">Salary ranges by level</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/merit-planning')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Merit Planning</p>
            <p className="text-xs text-gray-400 mt-1">Budget pools & increases</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/bonuses')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Bonuses</p>
            <p className="text-xs text-gray-400 mt-1">Propose & manage bonuses</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/equity-grants')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Equity Grants</p>
            <p className="text-xs text-gray-400 mt-1">Stock options & RSU vesting</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/shift-scheduling')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Shift Scheduling</p>
            <p className="text-xs text-gray-400 mt-1">Templates & calendar</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/holiday-calendar')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Holiday Calendar</p>
            <p className="text-xs text-gray-400 mt-1">Country-specific holidays</p>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/hr/audit-log')}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Audit Trail</p>
            <p className="text-xs text-gray-400 mt-1">Field-level change history</p>
          </Card>
        </div>
      </div>

      {/* Phase 2 — ATS, LMS, Engagement, Onboarding */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Talent & Learning</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'ATS Dashboard', icon: '🎯', path: '/hr/ats', desc: 'Recruiting pipeline' },
            { label: 'Job Requisitions', icon: '📋', path: '/hr/ats/requisitions', desc: 'Open positions' },
            { label: 'Candidates', icon: '👤', path: '/hr/ats/candidates', desc: 'Candidate database' },
            { label: 'Interviews', icon: '🎤', path: '/hr/ats/interviews', desc: 'Scheduled interviews' },
            { label: 'Learning', icon: '🎓', path: '/hr/learning', desc: 'My learning path' },
            { label: 'Course Catalog', icon: '📚', path: '/hr/courses', desc: 'Browse courses' },
            { label: 'Certifications', icon: '🏆', path: '/hr/certifications', desc: 'Track credentials' },
            { label: 'Build Course', icon: '✏️', path: '/hr/courses/new', desc: 'Create LMS content' },
          ].map((item) => (
            <Card
              key={item.path}
              className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
              onClick={() => navigate(item.path)}
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{item.label}</p>
              <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Engagement & Onboarding</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Engagement', icon: '💬', path: '/hr/engagement', desc: 'Surveys & pulse' },
            { label: 'Recognition', icon: '⭐', path: '/hr/recognition', desc: 'Kudos & badges feed' },
            { label: 'Create Survey', icon: '📊', path: '/hr/surveys/new', desc: 'Build a new survey' },
            { label: 'Onboarding', icon: '🤝', path: '/hr/onboarding-tracker', desc: 'Track new hires' },
            { label: 'Templates', icon: '📝', path: '/hr/onboarding-templates', desc: 'Onboarding checklists' },
            { label: 'Import Data', icon: '📥', path: '/hr/import', desc: 'Rippling/BambooHR/ADP' },
          ].map((item) => (
            <Card
              key={item.path}
              className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
              onClick={() => navigate(item.path)}
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{item.label}</p>
              <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Phase 3 — AI, Workflows, Analytics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">AI Insights</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Flight Risk', icon: '✈️', path: '/hr/ai/flight-risk', desc: 'Attrition prediction' },
            { label: 'Burnout Alerts', icon: '🔥', path: '/hr/ai/burnout', desc: 'Wellbeing monitoring' },
            { label: 'Skills Ontology', icon: '🧠', path: '/hr/ai/skills-ontology', desc: 'Skill taxonomy' },
            { label: 'HR Chatbot', icon: '🤖', path: '/hr/ai/chatbot', desc: 'AI HR assistant' },
            { label: 'Workforce Planning', icon: '📈', path: '/hr/ai/workforce-planning', desc: 'Headcount scenarios' },
          ].map((item) => (
            <Card
              key={item.path}
              className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
              onClick={() => navigate(item.path)}
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{item.label}</p>
              <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Automation & Analytics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Workflows', icon: '⚙️', path: '/hr/workflows', desc: 'Automate HR processes' },
            { label: 'Build Workflow', icon: '🔧', path: '/hr/workflows/builder', desc: 'Visual workflow editor' },
            { label: 'Approvals', icon: '✅', path: '/hr/workflows/approvals', desc: 'Pending decisions' },
            { label: 'People Analytics', icon: '📊', path: '/hr/analytics', desc: 'Custom dashboards' },
            { label: 'DEI Dashboard', icon: '🌍', path: '/hr/analytics/dei', desc: 'Diversity & inclusion' },
            { label: 'Predictive Reports', icon: '🔮', path: '/hr/analytics/predictive', desc: 'AI forecasting' },
            { label: 'Cost Modeling', icon: '💰', path: '/hr/analytics/cost', desc: 'Headcount cost analysis' },
          ].map((item) => (
            <Card
              key={item.path}
              className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
              onClick={() => navigate(item.path)}
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{item.label}</p>
              <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Leave Requests */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Leave Requests</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/hr/leave')}>
            View All
          </Button>
        </div>
        <Table
          columns={leaveColumns}
          data={recentLeaves?.items ?? []}
          loading={leavesLoading}
          keyExtractor={(r) => r.id}
          emptyText="No recent leave requests"
        />
      </Card>

      {/* ─── Add Employee Modal ──────────────────────────────────────────────── */}
      <Modal open={showAddEmployee} onClose={() => setShowAddEmployee(false)} title="Add Employee" size="lg">
        <form onSubmit={handleAddEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              required
              value={empForm.first_name}
              onChange={(e) => setEmpForm((p) => ({ ...p, first_name: e.target.value }))}
            />
            <Input
              label="Last Name"
              required
              value={empForm.last_name}
              onChange={(e) => setEmpForm((p) => ({ ...p, last_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              required
              value={empForm.email}
              onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
            />
            <Input
              label="Employee Number"
              required
              value={empForm.employee_number}
              onChange={(e) => setEmpForm((p) => ({ ...p, employee_number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Job Title"
              required
              value={empForm.job_title}
              onChange={(e) => setEmpForm((p) => ({ ...p, job_title: e.target.value }))}
            />
            <Select
              label="Employment Type"
              value={empForm.employment_type}
              onChange={(e) => setEmpForm((p) => ({ ...p, employment_type: e.target.value as CreateEmployeePayload['employment_type'] }))}
              options={[
                { value: 'full_time', label: 'Full Time' },
                { value: 'part_time', label: 'Part Time' },
                { value: 'contract', label: 'Contract' },
                { value: 'intern', label: 'Intern' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Hire Date"
              type="date"
              required
              value={empForm.hire_date}
              onChange={(e) => setEmpForm((p) => ({ ...p, hire_date: e.target.value }))}
            />
            <Select
              label="Department"
              value={empForm.department_id ?? ''}
              onChange={(e) => setEmpForm((p) => ({ ...p, department_id: e.target.value || null }))}
              options={[
                { value: '', label: 'Select Department' },
                ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddEmployee(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createEmployee.isPending}>
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Leave Request Modal ─────────────────────────────────────────────── */}
      <Modal open={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Submit Leave Request">
        <form onSubmit={handleSubmitLeave} className="space-y-4">
          <Select
            label="Leave Type"
            value={leaveForm.leave_type}
            onChange={(e) => setLeaveForm((p) => ({ ...p, leave_type: e.target.value as CreateLeaveRequestPayload['leave_type'] }))}
            options={[
              { value: 'annual', label: 'Annual Leave' },
              { value: 'sick', label: 'Sick Leave' },
              { value: 'personal', label: 'Personal Leave' },
              { value: 'maternity', label: 'Maternity Leave' },
              { value: 'paternity', label: 'Paternity Leave' },
              { value: 'unpaid', label: 'Unpaid Leave' },
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={leaveForm.start_date}
              onChange={(e) => setLeaveForm((p) => ({ ...p, start_date: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              required
              value={leaveForm.end_date}
              onChange={(e) => setLeaveForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              required
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowLeaveModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createLeave.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
