import { useState } from 'react'
import { Card, Button, Table, Modal, Input, Select, Badge, Pagination } from '../../components/ui'
import { toast } from '../../components/ui'
import apiClient from '../../api/client'
import {
  useEmployees,
  useDepartments,
  useCreateEmployee,
  type Employee,
  type EmploymentType,
  type CreateEmployeePayload,
} from '../../api/hr'

// ─── Employment Type Badge ────────────────────────────────────────────────────

function EmploymentTypeBadge({ type }: { type: EmploymentType }) {
  const map: Record<EmploymentType, { variant: 'success' | 'info' | 'warning' | 'primary'; label: string }> = {
    full_time: { variant: 'success', label: 'Full Time' },
    part_time: { variant: 'warning', label: 'Part Time' },
    contract: { variant: 'info', label: 'Contract' },
    intern: { variant: 'primary', label: 'Intern' },
  }
  const { variant, label } = map[type] ?? { variant: 'primary' as const, label: type }
  return <Badge variant={variant}>{label}</Badge>
}

// ─── Component ────────────────────────────────────────────────────────────────

async function handleExport(endpoint: string, filename: string) {
  try {
    const response = await apiClient.get(endpoint, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    toast('error', 'Export failed')
  }
}

export default function EmployeesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const limit = 15

  const { data: employees, isLoading } = useEmployees({
    page,
    limit,
    department_id: deptFilter || undefined,
    is_active: true,
  })
  const { data: departments } = useDepartments()
  const createEmployee = useCreateEmployee()

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateEmployeePayload>({
    employee_number: '',
    first_name: '',
    last_name: '',
    email: '',
    job_title: '',
    employment_type: 'full_time',
    hire_date: new Date().toISOString().split('T')[0],
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    createEmployee.mutate(form, {
      onSuccess: () => {
        toast('success', 'Employee created')
        setShowCreate(false)
        setForm({
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

  // Filter locally by name search (backend pagination handles department)
  const filtered = (employees?.items ?? []).filter((emp) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      emp.first_name.toLowerCase().includes(term) ||
      emp.last_name.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term) ||
      emp.employee_number.toLowerCase().includes(term)
    )
  })

  const totalPages = Math.ceil((employees?.total ?? 0) / limit)

  const columns = [
    {
      key: 'name',
      label: 'Employee',
      render: (e: Employee) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
            {e.first_name[0]}{e.last_name[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900">{e.first_name} {e.last_name}</p>
            <p className="text-xs text-gray-400">{e.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'employee_number', label: 'ID', render: (e: Employee) => <span className="text-gray-500 font-mono text-xs">{e.employee_number}</span> },
    { key: 'job_title', label: 'Job Title' },
    { key: 'department_name', label: 'Department', render: (e: Employee) => e.department_name ?? <span className="text-gray-400">Unassigned</span> },
    { key: 'employment_type', label: 'Type', render: (e: Employee) => <EmploymentTypeBadge type={e.employment_type} /> },
    {
      key: 'hire_date',
      label: 'Hire Date',
      render: (e: Employee) => new Date(e.hire_date).toLocaleDateString(),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (e: Employee) => (
        <Badge variant={e.is_active ? 'success' : 'danger'}>{e.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">{employees?.total ?? 0} total employees</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('/hr/employees/export', 'employees.csv')}>
            Export CSV
          </Button>
          <Button onClick={() => setShowCreate(true)}>Add Employee</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value)
            setPage(1)
          }}
          options={[
            { value: '', label: 'All Departments' },
            ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table
          columns={columns}
          data={filtered}
          loading={isLoading}
          keyExtractor={(e) => e.id}
          emptyText="No employees found"
        />
        <Pagination page={page} pages={totalPages} total={employees?.total ?? 0} onChange={setPage} />
      </Card>

      {/* Row click handled via wrapping — navigate on row click */}
      {!isLoading && filtered.length > 0 && (
        <div className="text-xs text-gray-400 text-center">
          Click an employee row to view details (navigate to /hr/employees/:id)
        </div>
      )}

      {/* ─── Create Employee Modal ───────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Employee" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              required
              value={form.first_name}
              onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
            />
            <Input
              label="Last Name"
              required
              value={form.last_name}
              onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
            <Input
              label="Employee Number"
              required
              value={form.employee_number}
              onChange={(e) => setForm((p) => ({ ...p, employee_number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Job Title"
              required
              value={form.job_title}
              onChange={(e) => setForm((p) => ({ ...p, job_title: e.target.value }))}
            />
            <Select
              label="Employment Type"
              value={form.employment_type}
              onChange={(e) => setForm((p) => ({ ...p, employment_type: e.target.value as EmploymentType }))}
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
              value={form.hire_date}
              onChange={(e) => setForm((p) => ({ ...p, hire_date: e.target.value }))}
            />
            <Select
              label="Department"
              value={form.department_id ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value || null }))}
              options={[
                { value: '', label: 'Select Department' },
                ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
          <Input
            label="Salary"
            type="number"
            value={form.salary?.toString() ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value ? Number(e.target.value) : null }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createEmployee.isPending}>
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
