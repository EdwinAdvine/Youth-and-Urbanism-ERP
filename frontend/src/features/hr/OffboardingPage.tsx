import { useState } from 'react'
import { Card, Button, Select, Badge, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useEmployees, useUpdateEmployee } from '../../api/hr'

interface OffboardingItem {
  id: string
  category: string
  label: string
  completed: boolean
}

const DEFAULT_CHECKLIST: OffboardingItem[] = [
  { id: 'resignation', category: 'Documentation', label: 'Resignation/termination letter collected', completed: false },
  { id: 'exit_interview', category: 'Documentation', label: 'Exit interview conducted', completed: false },
  { id: 'nda_review', category: 'Documentation', label: 'NDA and non-compete reviewed', completed: false },
  { id: 'final_paycheck', category: 'Finance', label: 'Final paycheck calculated', completed: false },
  { id: 'expense_claims', category: 'Finance', label: 'Outstanding expense claims settled', completed: false },
  { id: 'benefits_end', category: 'Finance', label: 'Benefits termination processed', completed: false },
  { id: 'loan_recovery', category: 'Finance', label: 'Company loans/advances recovered', completed: false },
  { id: 'laptop', category: 'Equipment', label: 'Laptop returned', completed: false },
  { id: 'phone', category: 'Equipment', label: 'Company phone returned', completed: false },
  { id: 'badge_return', category: 'Equipment', label: 'ID badge / access card returned', completed: false },
  { id: 'keys', category: 'Equipment', label: 'Office keys returned', completed: false },
  { id: 'email_disable', category: 'IT / Access', label: 'Email account disabled', completed: false },
  { id: 'system_access', category: 'IT / Access', label: 'System access revoked (ERP, VPN, etc.)', completed: false },
  { id: 'data_backup', category: 'IT / Access', label: 'Employee data backed up', completed: false },
  { id: 'knowledge_transfer', category: 'Transition', label: 'Knowledge transfer completed', completed: false },
  { id: 'handover', category: 'Transition', label: 'Project/task handover completed', completed: false },
  { id: 'team_notified', category: 'Transition', label: 'Team and stakeholders notified', completed: false },
]

export default function OffboardingPage() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const { data: empData } = useEmployees({ limit: 500, is_active: true })
  const updateEmployee = useUpdateEmployee()

  const [checklist, setChecklist] = useState<OffboardingItem[]>(DEFAULT_CHECKLIST)
  const [lastDay, setLastDay] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  function toggleItem(id: string) {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)))
  }

  const categories = [...new Set(checklist.map((c) => c.category))]
  const completedCount = checklist.filter((c) => c.completed).length
  const totalCount = checklist.length

  function handleComplete() {
    if (!selectedEmployeeId) return
    if (!window.confirm('This will deactivate the employee. Are you sure?')) return

    updateEmployee.mutate(
      { id: selectedEmployeeId, is_active: false } as { id: string; is_active: boolean },
      {
        onSuccess: () => {
          toast('success', 'Employee offboarding completed')
          setSelectedEmployeeId('')
          setChecklist(DEFAULT_CHECKLIST)
          setLastDay('')
          setReason('')
          setNotes('')
        },
        onError: () => toast('error', 'Failed to complete offboarding'),
      }
    )
  }

  const selectedEmployee = empData?.items?.find((e) => e.id === selectedEmployeeId)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Employee Offboarding</h1>
        <p className="text-sm text-gray-500 mt-1">Structured checklist for employee departures</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Employee selection + details */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Departing Employee</h3>
          <Select
            label="Select Employee"
            options={[
              { value: '', label: 'Choose an employee...' },
              ...(empData?.items?.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
            ]}
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          />

          {selectedEmployee && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950 rounded-[10px]">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                </div>
                <div>
                  <p className="font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                  <p className="text-xs text-gray-500">{selectedEmployee.job_title}</p>
                </div>
              </div>
              <Input label="Last Working Day" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
              <Select
                label="Reason"
                options={[
                  { value: '', label: 'Select reason...' },
                  { value: 'resignation', label: 'Resignation' },
                  { value: 'termination', label: 'Termination' },
                  { value: 'retirement', label: 'Retirement' },
                  { value: 'contract_end', label: 'Contract End' },
                  { value: 'mutual', label: 'Mutual Agreement' },
                  { value: 'other', label: 'Other' },
                ]}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Right: Checklist */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedEmployeeId ? (
            <Card>
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg font-medium">Select an employee to begin offboarding</p>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={completedCount === totalCount ? 'success' : 'warning'}>
                    {completedCount} / {totalCount}
                  </Badge>
                  <div className="w-48 bg-gray-100 dark:bg-gray-900 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(completedCount / totalCount) * 100}%` }}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleComplete}
                  loading={updateEmployee.isPending}
                  disabled={completedCount < totalCount}
                >
                  Complete Offboarding
                </Button>
              </div>

              {categories.map((category) => (
                <Card key={category}>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">{category}</h3>
                  <div className="space-y-2">
                    {checklist
                      .filter((item) => item.category === category)
                      .map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-[10px] border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleItem(item.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className={`text-sm ${item.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
