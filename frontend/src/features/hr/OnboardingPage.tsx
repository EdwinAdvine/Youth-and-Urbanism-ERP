import { useState } from 'react'
import { Card, Button, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import { useCreateEmployee, useDepartments, type CreateEmployeePayload, type EmploymentType } from '../../api/hr'

interface OnboardingChecklist {
  id: string
  label: string
  completed: boolean
}

const DEFAULT_CHECKLIST: OnboardingChecklist[] = [
  { id: 'personal', label: 'Personal information collected', completed: false },
  { id: 'contract', label: 'Employment contract signed', completed: false },
  { id: 'equipment', label: 'Equipment assigned (laptop, phone, etc.)', completed: false },
  { id: 'accounts', label: 'System accounts created (email, ERP)', completed: false },
  { id: 'badge', label: 'ID badge / access card issued', completed: false },
  { id: 'policies', label: 'Company policies acknowledged', completed: false },
  { id: 'training', label: 'Orientation training scheduled', completed: false },
  { id: 'mentor', label: 'Buddy/mentor assigned', completed: false },
  { id: 'bank', label: 'Bank details collected for payroll', completed: false },
  { id: 'benefits', label: 'Benefits enrollment completed', completed: false },
]

const STEPS = ['Employee Details', 'Department & Role', 'Onboarding Checklist', 'Review & Submit']

const defaultForm: CreateEmployeePayload = {
  employee_number: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  department_id: null,
  job_title: '',
  employment_type: 'full_time',
  hire_date: new Date().toISOString().slice(0, 10),
  salary: null,
  manager_id: null,
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CreateEmployeePayload>(defaultForm)
  const [checklist, setChecklist] = useState<OnboardingChecklist[]>(DEFAULT_CHECKLIST)

  const { data: departments } = useDepartments()
  const createEmployee = useCreateEmployee()

  function toggleCheckItem(id: string) {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    )
  }

  function canNext(): boolean {
    if (step === 0) return !!(form.first_name && form.last_name && form.email && form.employee_number)
    if (step === 1) return !!(form.job_title && form.employment_type && form.hire_date)
    return true
  }

  function handleSubmit() {
    createEmployee.mutate(form, {
      onSuccess: () => {
        toast('success', 'Employee onboarded successfully')
        setStep(0)
        setForm(defaultForm)
        setChecklist(DEFAULT_CHECKLIST)
      },
      onError: () => toast('error', 'Failed to create employee'),
    })
  }

  const completedCount = checklist.filter((c) => c.completed).length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Onboarding</h1>
        <p className="text-sm text-gray-500 mt-1">Step-by-step wizard for onboarding new employees</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                i <= step ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${i <= step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-primary' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <Card>
        {/* Step 0: Personal Details */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Employee Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" required value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} />
              <Input label="Last Name" required value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Employee Number" required value={form.employee_number} onChange={(e) => setForm((p) => ({ ...p, employee_number: e.target.value }))} />
              <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <Input label="Phone" value={form.phone ?? ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
        )}

        {/* Step 1: Department & Role */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Department & Role</h2>
            <Input label="Job Title" required value={form.job_title} onChange={(e) => setForm((p) => ({ ...p, job_title: e.target.value }))} />
            <Select
              label="Department"
              options={[
                { value: '', label: 'Select department...' },
                ...(departments?.map((d) => ({ value: d.id, label: d.name })) ?? []),
              ]}
              value={form.department_id ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value || null }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Employment Type"
                options={[
                  { value: 'full_time', label: 'Full Time' },
                  { value: 'part_time', label: 'Part Time' },
                  { value: 'contract', label: 'Contract' },
                  { value: 'intern', label: 'Intern' },
                ]}
                value={form.employment_type}
                onChange={(e) => setForm((p) => ({ ...p, employment_type: e.target.value as EmploymentType }))}
              />
              <Input label="Hire Date" type="date" required value={form.hire_date} onChange={(e) => setForm((p) => ({ ...p, hire_date: e.target.value }))} />
            </div>
            <Input
              label="Salary"
              type="number"
              step="0.01"
              value={form.salary ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value ? Number(e.target.value) : null }))}
            />
          </div>
        )}

        {/* Step 2: Checklist */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Onboarding Checklist</h2>
              <Badge variant={completedCount === checklist.length ? 'success' : 'warning'}>
                {completedCount} / {checklist.length} completed
              </Badge>
            </div>
            <div className="space-y-2">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-[10px] border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleCheckItem(item.id)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className={`text-sm ${item.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p><span className="text-gray-500">Name:</span> <span className="font-medium">{form.first_name} {form.last_name}</span></p>
                <p><span className="text-gray-500">Employee #:</span> <span className="font-medium">{form.employee_number}</span></p>
                <p><span className="text-gray-500">Email:</span> <span className="font-medium">{form.email}</span></p>
                <p><span className="text-gray-500">Phone:</span> <span className="font-medium">{form.phone || 'N/A'}</span></p>
              </div>
              <div className="space-y-2">
                <p><span className="text-gray-500">Job Title:</span> <span className="font-medium">{form.job_title}</span></p>
                <p><span className="text-gray-500">Type:</span> <Badge variant="primary">{form.employment_type.replace('_', ' ')}</Badge></p>
                <p><span className="text-gray-500">Hire Date:</span> <span className="font-medium">{form.hire_date}</span></p>
                <p><span className="text-gray-500">Salary:</span> <span className="font-medium">{form.salary ? `$${form.salary.toLocaleString()}` : 'N/A'}</span></p>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500 mb-2">Checklist Progress:</p>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(completedCount / checklist.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{completedCount} of {checklist.length} items completed</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 mt-6 border-t border-gray-100">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Previous
          </Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} loading={createEmployee.isPending}>
              Complete Onboarding
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
