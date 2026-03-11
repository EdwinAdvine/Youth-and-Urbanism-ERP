import { useState } from 'react'
import { Button, Card, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import { useCrewSchedule, useCreateCrewAssignment, useLogHours, usePushTimesheet } from '../../api/manufacturing_labor'

const shiftColors: Record<string, string> = { morning: 'blue', afternoon: 'yellow', night: 'purple' }
const roleColors: Record<string, string> = { operator: 'gray', lead: 'blue', supervisor: 'green' }

function getWeekDates() {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0],
  }
}

export default function CrewSchedulingPage() {
  const [week, setWeek] = useState(getWeekDates())
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [form, setForm] = useState({
    work_order_id: '',
    workstation_id: '',
    employee_id: '',
    shift: 'morning',
    assignment_date: new Date().toISOString().split('T')[0],
    role: 'operator',
  })

  const { data: schedule, isLoading } = useCrewSchedule(week.from, week.to)
  const createAssignment = useCreateCrewAssignment()
  const pushTimesheet = usePushTimesheet()

  const handleAdd = async () => {
    if (!form.work_order_id || !form.workstation_id || !form.employee_id) {
      return toast({ title: 'WO, workstation, and employee required', variant: 'destructive' })
    }
    try {
      await createAssignment.mutateAsync(form)
      toast({ title: 'Crew assigned' })
      setAddOpen(false)
    } catch {
      toast({ title: 'Failed to assign crew', variant: 'destructive' })
    }
  }

  const handlePushTimesheet = async () => {
    if (selected.length === 0) return toast({ title: 'Select assignments to push', variant: 'destructive' })
    try {
      const result = await pushTimesheet.mutateAsync(selected)
      toast({ title: `Pushed ${result.pushed} timesheets to HR` })
      setSelected([])
    } catch {
      toast({ title: 'Failed to push timesheet', variant: 'destructive' })
    }
  }

  const days = Object.keys(schedule || {}).sort()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Crew Scheduling</h1>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <Button variant="outline" onClick={handlePushTimesheet} loading={pushTimesheet.isPending}>
              Push {selected.length} to HR
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)}>+ Assign Crew</Button>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <input type="date" className="border rounded px-3 py-2 text-sm" value={week.from} onChange={e => setWeek({ ...week, from: e.target.value })} />
        <span className="text-gray-400">to</span>
        <input type="date" className="border rounded px-3 py-2 text-sm" value={week.to} onChange={e => setWeek({ ...week, to: e.target.value })} />
      </div>

      {isLoading && <Card className="p-8 text-center">Loading schedule...</Card>}

      {!isLoading && days.length === 0 && (
        <Card className="p-8 text-center text-gray-500">No crew assignments for this week.</Card>
      )}

      <div className="space-y-4">
        {days.map(day => (
          <Card key={day}>
            <div className="px-4 py-2 bg-gray-50 border-b font-semibold text-sm">
              {new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            <div className="divide-y">
              {schedule?.[day]?.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={e => setSelected(prev => e.target.checked ? [...prev, a.id] : prev.filter(i => i !== a.id))}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <div className="font-mono text-xs">{a.employee_id.slice(0, 8)}...</div>
                      <Badge variant={roleColors[a.role] || 'gray'} className="text-xs">{a.role}</Badge>
                    </div>
                    <div>
                      <Badge variant={shiftColors[a.shift] || 'gray'} className="text-xs">{a.shift}</Badge>
                    </div>
                    <div className="text-gray-500">{a.hours_worked}h worked</div>
                    <div>
                      {a.timesheet_pushed ? (
                        <span className="text-xs text-green-600">✓ Pushed to HR</span>
                      ) : (
                        <span className="text-xs text-gray-400">Not pushed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Assign Crew">
        <div className="space-y-4">
          <Input label="Work Order ID" value={form.work_order_id} onChange={e => setForm({ ...form, work_order_id: e.target.value })} placeholder="WO UUID" />
          <Input label="Workstation ID" value={form.workstation_id} onChange={e => setForm({ ...form, workstation_id: e.target.value })} placeholder="Workstation UUID" />
          <Input label="Employee ID" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} placeholder="HR Employee UUID" />
          <Input label="Assignment Date" type="date" value={form.assignment_date} onChange={e => setForm({ ...form, assignment_date: e.target.value })} />
          <div>
            <label className="text-sm font-medium">Shift</label>
            <select className="mt-1 block w-full border rounded px-3 py-2 text-sm" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
              {['morning', 'afternoon', 'night'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <select className="mt-1 block w-full border rounded px-3 py-2 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {['operator', 'lead', 'supervisor'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={createAssignment.isPending}>Assign</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
