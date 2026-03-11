import { useState, useMemo } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useShiftTemplates,
  useCreateShiftTemplate,
  useUpdateShiftTemplate,
  useDeleteShiftTemplate,
  useShiftAssignments,
  useCreateShiftAssignment,
  useBulkCreateShiftAssignments,
  useSwapShift,
  useShiftCalendar,
  type ShiftTemplate,
  type ShiftTemplateCreatePayload,
  type ShiftAssignment,
  type ShiftAssignmentCreatePayload,
  type BulkShiftAssignmentPayload,
} from '../../api/hr_phase1'
import { useEmployees } from '../../api/hr'

const defaultTemplateForm: ShiftTemplateCreatePayload = {
  name: '',
  start_time: '09:00',
  end_time: '17:00',
  break_duration_minutes: 30,
  is_overnight: false,
  color: '#51459d',
}

const defaultAssignForm: ShiftAssignmentCreatePayload = {
  employee_id: '',
  shift_template_id: '',
  assignment_date: '',
  notes: '',
}

const defaultBulkForm: BulkShiftAssignmentPayload = {
  employee_ids: [],
  shift_template_id: '',
  start_date: '',
  end_date: '',
}

export default function ShiftSchedulingPage() {
  const { data: templates, isLoading: templatesLoading } = useShiftTemplates()
  const createTemplate = useCreateShiftTemplate()
  const updateTemplate = useUpdateShiftTemplate()
  const deleteTemplate = useDeleteShiftTemplate()
  const { data: empData } = useEmployees({ limit: 500 })

  // Templates modal
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState<ShiftTemplateCreatePayload>(defaultTemplateForm)

  // Calendar state
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week')
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })

  const calendarRange = useMemo(() => {
    const base = new Date(calendarDate)
    const start = new Date(base)
    const end = new Date(base)
    if (calendarView === 'week') {
      const day = start.getDay()
      start.setDate(start.getDate() - day)
      end.setDate(start.getDate() + 6)
    } else {
      start.setDate(1)
      end.setMonth(end.getMonth() + 1, 0)
    }
    return {
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    }
  }, [calendarDate, calendarView])

  const { data: calendarData, isLoading: calendarLoading } = useShiftCalendar(calendarRange)
  const { data: assignmentsData } = useShiftAssignments({
    start_date: calendarRange.start_date,
    end_date: calendarRange.end_date,
  })
  const createAssignment = useCreateShiftAssignment()
  const bulkCreate = useBulkCreateShiftAssignments()
  const swapShift = useSwapShift()

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState<ShiftAssignmentCreatePayload>(defaultAssignForm)

  // Bulk assign modal
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkForm, setBulkForm] = useState<BulkShiftAssignmentPayload>(defaultBulkForm)
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState<string[]>([])

  // Swap modal
  const [swapAssignment, setSwapAssignment] = useState<ShiftAssignment | null>(null)
  const [swapWithEmployeeId, setSwapWithEmployeeId] = useState('')

  // Template CRUD handlers
  function openCreateTemplate() {
    setEditingTemplate(null)
    setTemplateForm(defaultTemplateForm)
    setShowTemplateModal(true)
  }

  function openEditTemplate(t: ShiftTemplate) {
    setEditingTemplate(t)
    setTemplateForm({
      name: t.name,
      start_time: t.start_time,
      end_time: t.end_time,
      break_duration_minutes: t.break_duration_minutes,
      is_overnight: t.is_overnight,
      color: t.color ?? '#51459d',
    })
    setShowTemplateModal(true)
  }

  function handleTemplateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingTemplate) {
      updateTemplate.mutate(
        { templateId: editingTemplate.id, data: templateForm },
        {
          onSuccess: () => { toast('success', 'Template updated'); setShowTemplateModal(false) },
          onError: () => toast('error', 'Failed to update template'),
        }
      )
    } else {
      createTemplate.mutate(templateForm, {
        onSuccess: () => { toast('success', 'Template created'); setShowTemplateModal(false) },
        onError: () => toast('error', 'Failed to create template'),
      })
    }
  }

  function handleDeleteTemplate(t: ShiftTemplate) {
    if (!confirm(`Delete template "${t.name}"?`)) return
    deleteTemplate.mutate(t.id, {
      onSuccess: () => toast('success', 'Template deleted'),
      onError: () => toast('error', 'Failed to delete template'),
    })
  }

  // Assignment handlers
  function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault()
    createAssignment.mutate(assignForm, {
      onSuccess: () => { toast('success', 'Shift assigned'); setShowAssignModal(false) },
      onError: () => toast('error', 'Failed to assign shift'),
    })
  }

  function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault()
    bulkCreate.mutate(
      { ...bulkForm, employee_ids: bulkEmployeeIds },
      {
        onSuccess: () => { toast('success', 'Bulk shifts assigned'); setShowBulkModal(false) },
        onError: () => toast('error', 'Failed to assign bulk shifts'),
      }
    )
  }

  function handleSwapSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!swapAssignment) return
    swapShift.mutate(
      { assignmentId: swapAssignment.id, swapWithEmployeeId },
      {
        onSuccess: () => { toast('success', 'Shift swapped'); setSwapAssignment(null); setSwapWithEmployeeId('') },
        onError: () => toast('error', 'Failed to swap shift'),
      }
    )
  }

  function toggleBulkEmployee(empId: string) {
    setBulkEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    )
  }

  // Calendar date helpers
  const calendarDays = useMemo(() => {
    const days: string[] = []
    const start = new Date(calendarRange.start_date)
    const end = new Date(calendarRange.end_date)
    const cur = new Date(start)
    while (cur <= end) {
      days.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }, [calendarRange])

  const templateColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (t: ShiftTemplate) => (
        <p className="font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
      ),
    },
    {
      key: 'start_time',
      label: 'Start Time',
      render: (t: ShiftTemplate) => t.start_time,
    },
    {
      key: 'end_time',
      label: 'End Time',
      render: (t: ShiftTemplate) => t.end_time,
    },
    {
      key: 'break_duration_minutes',
      label: 'Break (min)',
      render: (t: ShiftTemplate) => t.break_duration_minutes,
    },
    {
      key: 'is_overnight',
      label: 'Overnight',
      render: (t: ShiftTemplate) => (
        <span className={t.is_overnight ? 'text-warning' : 'text-gray-400'}>
          {t.is_overnight ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'color',
      label: 'Color',
      render: (t: ShiftTemplate) => (
        <div
          className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600"
          style={{ backgroundColor: t.color ?? '#51459d' }}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (t: ShiftTemplate) => (
        <Badge variant={t.is_active ? 'success' : 'default'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (t: ShiftTemplate) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditTemplate(t)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteTemplate(t)}>Delete</Button>
        </div>
      ),
    },
  ]

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shift Scheduling</h1>
        <p className="text-sm text-gray-500 mt-1">Manage shift templates and employee schedules</p>
      </div>

      {/* Shift Templates Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shift Templates</h2>
          <Button onClick={openCreateTemplate}>Create Template</Button>
        </div>
        <Card padding={false}>
          <Table
            columns={templateColumns}
            data={(templates as ShiftTemplate[]) ?? []}
            keyExtractor={(t) => t.id}
            emptyText="No shift templates found."
          />
        </Card>
      </div>

      {/* Schedule Calendar Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Schedule Calendar</h2>
          <div className="flex items-center gap-3">
            <Select
              options={[
                { value: 'week', label: 'Week View' },
                { value: 'month', label: 'Month View' },
              ]}
              value={calendarView}
              onChange={(e) => setCalendarView(e.target.value as 'week' | 'month')}
              className="w-36"
            />
            <Input
              type="date"
              value={calendarDate}
              onChange={(e) => setCalendarDate(e.target.value)}
              className="w-40"
            />
            <Button onClick={() => { setAssignForm(defaultAssignForm); setShowAssignModal(true) }}>Assign Shift</Button>
            <Button variant="secondary" onClick={() => { setBulkForm(defaultBulkForm); setBulkEmployeeIds([]); setShowBulkModal(true) }}>Bulk Assign</Button>
          </div>
        </div>
        <Card>
          {calendarLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid gap-px bg-gray-200 dark:bg-gray-700" style={{ gridTemplateColumns: `200px repeat(${calendarDays.length}, minmax(100px, 1fr))` }}>
                <div className="bg-gray-50 dark:bg-gray-800 p-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Employee
                </div>
                {calendarDays.map((day) => (
                  <div key={day} className="bg-gray-50 dark:bg-gray-800 p-2 text-sm font-medium text-center text-gray-700 dark:text-gray-300">
                    {new Date(day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                ))}
                {calendarData && Array.isArray(calendarData) ? (
                  (calendarData as Array<{ employee_id: string; employee_name: string; shifts: Array<{ date: string; template_name: string; color: string; assignment_id: string }> }>).map((row) => (
                    <>
                      <div key={`emp-${row.employee_id}`} className="bg-white dark:bg-gray-900 p-2 text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                        {row.employee_name}
                      </div>
                      {calendarDays.map((day) => {
                        const shift = row.shifts?.find((s) => s.date === day)
                        return (
                          <div key={`${row.employee_id}-${day}`} className="bg-white dark:bg-gray-900 p-1 min-h-[48px]">
                            {shift && (
                              <div
                                className="text-xs px-1.5 py-1 rounded text-white truncate"
                                style={{ backgroundColor: shift.color || '#51459d' }}
                              >
                                {shift.template_name}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  ))
                ) : (
                  <div className="col-span-full bg-white dark:bg-gray-900 p-6 text-center text-gray-400 text-sm">
                    No schedule data available for this period
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Assignment list with swap buttons */}
          {assignmentsData && Array.isArray(assignmentsData) && (assignmentsData as ShiftAssignment[]).length > 0 && (
            <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignments</h3>
              {(assignmentsData as ShiftAssignment[]).map((a) => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-[10px] border border-gray-100 dark:border-gray-700">
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {a.employee_id} - {new Date(a.assignment_date).toLocaleDateString()}
                    {a.shift_template && <span className="ml-2 text-gray-500">({a.shift_template.name})</span>}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={a.status === 'scheduled' ? 'info' : a.status === 'completed' ? 'success' : 'default'}>
                      {a.status}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => { setSwapAssignment(a); setSwapWithEmployeeId('') }}>
                      Swap
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Template Create/Edit Modal */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={editingTemplate ? 'Edit Shift Template' : 'Create Shift Template'} size="lg">
        <form onSubmit={handleTemplateSubmit} className="space-y-4">
          <Input label="Name" required value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Time" type="time" required value={templateForm.start_time} onChange={(e) => setTemplateForm((p) => ({ ...p, start_time: e.target.value }))} />
            <Input label="End Time" type="time" required value={templateForm.end_time} onChange={(e) => setTemplateForm((p) => ({ ...p, end_time: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Break (minutes)"
              type="number"
              value={templateForm.break_duration_minutes ?? 30}
              onChange={(e) => setTemplateForm((p) => ({ ...p, break_duration_minutes: Number(e.target.value) }))}
            />
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateForm.is_overnight ?? false}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, is_overnight: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                Overnight Shift
              </label>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
              <input
                type="color"
                value={templateForm.color ?? '#51459d'}
                onChange={(e) => setTemplateForm((p) => ({ ...p, color: e.target.value }))}
                className="w-full h-10 rounded-[10px] border border-gray-200 dark:border-gray-700 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
            <Button type="submit" loading={createTemplate.isPending || updateTemplate.isPending}>
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Shift Modal */}
      <Modal open={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Shift">
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <Select
            label="Employee"
            required
            options={[
              { value: '', label: 'Select employee...' },
              ...(empData?.items?.map((e: { id: string; first_name: string; last_name: string }) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
            ]}
            value={assignForm.employee_id}
            onChange={(e) => setAssignForm((p) => ({ ...p, employee_id: e.target.value }))}
          />
          <Select
            label="Shift Template"
            required
            options={[
              { value: '', label: 'Select template...' },
              ...((templates as ShiftTemplate[]) ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
            value={assignForm.shift_template_id}
            onChange={(e) => setAssignForm((p) => ({ ...p, shift_template_id: e.target.value }))}
          />
          <Input
            label="Date"
            type="date"
            required
            value={assignForm.assignment_date}
            onChange={(e) => setAssignForm((p) => ({ ...p, assignment_date: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button type="submit" loading={createAssignment.isPending}>Assign</Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal open={showBulkModal} onClose={() => setShowBulkModal(false)} title="Bulk Assign Shifts" size="lg">
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Employees ({bulkEmployeeIds.length} selected)
            </label>
            <div className="max-h-40 overflow-y-auto border rounded-[10px] border-gray-200 dark:border-gray-700 p-2 space-y-1">
              {empData?.items?.map((emp: { id: string; first_name: string; last_name: string }) => (
                <label key={emp.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={bulkEmployeeIds.includes(emp.id)}
                    onChange={() => toggleBulkEmployee(emp.id)}
                    className="rounded border-gray-300"
                  />
                  {emp.first_name} {emp.last_name}
                </label>
              ))}
            </div>
          </div>
          <Select
            label="Shift Template"
            required
            options={[
              { value: '', label: 'Select template...' },
              ...((templates as ShiftTemplate[]) ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
            value={bulkForm.shift_template_id}
            onChange={(e) => setBulkForm((p) => ({ ...p, shift_template_id: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={bulkForm.start_date}
              onChange={(e) => setBulkForm((p) => ({ ...p, start_date: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              required
              value={bulkForm.end_date}
              onChange={(e) => setBulkForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowBulkModal(false)}>Cancel</Button>
            <Button type="submit" loading={bulkCreate.isPending} disabled={bulkEmployeeIds.length === 0}>Bulk Assign</Button>
          </div>
        </form>
      </Modal>

      {/* Swap Shift Modal */}
      <Modal open={!!swapAssignment} onClose={() => setSwapAssignment(null)} title="Swap Shift">
        <form onSubmit={handleSwapSubmit} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Swap shift on {swapAssignment ? new Date(swapAssignment.assignment_date).toLocaleDateString() : ''} with another employee.
          </p>
          <Select
            label="Swap With Employee"
            required
            options={[
              { value: '', label: 'Select employee...' },
              ...(empData?.items?.map((e: { id: string; first_name: string; last_name: string }) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
            ]}
            value={swapWithEmployeeId}
            onChange={(e) => setSwapWithEmployeeId(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setSwapAssignment(null)}>Cancel</Button>
            <Button type="submit" loading={swapShift.isPending} disabled={!swapWithEmployeeId}>Swap</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
