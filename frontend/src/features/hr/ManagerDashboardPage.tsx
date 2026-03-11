import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useManagerTeam,
  useManagerTeamAttendance,
  useManagerTeamLeave,
  useManagerTeamPerformance,
  useManagerTeamGoals,
  useManagerTeamEngagement,
  useCreateDelegation,
  useManagerDelegations,
  useRevokeDelegation,
  type TeamMember,
  type Delegation,
  type DelegationCreatePayload,
} from '../../api/hr_phase1'

interface AttendanceEntry {
  employee_id: string
  employee_number: string
  check_in: string | null
  check_out: string | null
  status: string
}

interface LeaveEntry {
  id: string
  employee_id: string
  employee_number: string
  leave_type: string
  start_date: string
  end_date: string
  status: string
}

interface GoalsSummary {
  total: number
  completed: number
  in_progress: number
  at_risk: number
}

const defaultDelegationForm: DelegationCreatePayload = {
  delegate_to_id: '',
  scope: '',
  start_date: '',
  end_date: '',
  notes: '',
}

export default function ManagerDashboardPage() {
  const { data: team, isLoading: teamLoading } = useManagerTeam()
  const { data: attendance } = useManagerTeamAttendance()
  const { data: leaveData } = useManagerTeamLeave()
  const { data: performance } = useManagerTeamPerformance()
  const { data: goalsData } = useManagerTeamGoals()
  useManagerTeamEngagement()
  const { data: delegations } = useManagerDelegations()

  const createDelegation = useCreateDelegation()
  const revokeDelegation = useRevokeDelegation()

  const [showDelegationModal, setShowDelegationModal] = useState(false)
  const [delegationForm, setDelegationForm] = useState<DelegationCreatePayload>(defaultDelegationForm)

  const teamMembers = (team as TeamMember[]) ?? []
  const attendanceList = (attendance as AttendanceEntry[]) ?? []
  const leaveList = (leaveData as LeaveEntry[]) ?? []
  const goalsSummary = (goalsData as GoalsSummary) ?? { total: 0, completed: 0, in_progress: 0, at_risk: 0 }
  const delegationList = (delegations as Delegation[]) ?? []

  const presentToday = attendanceList.filter((a) => a.check_in != null).length
  const onLeaveToday = leaveList.filter((l) => l.status === 'approved').length
  const pendingLeave = leaveList.filter((l) => l.status === 'pending')
  const pendingReviewCount = (performance as { pending_reviews?: number })?.pending_reviews ?? 0

  function handleCreateDelegation(e: React.FormEvent) {
    e.preventDefault()
    createDelegation.mutate(
      { ...delegationForm, notes: delegationForm.notes || undefined },
      {
        onSuccess: () => { toast('success', 'Delegation created'); setShowDelegationModal(false); setDelegationForm(defaultDelegationForm) },
        onError: () => toast('error', 'Failed to create delegation'),
      }
    )
  }

  function handleRevoke(delegationId: string) {
    revokeDelegation.mutate(delegationId, {
      onSuccess: () => toast('success', 'Delegation revoked'),
      onError: () => toast('error', 'Failed to revoke delegation'),
    })
  }

  const attendanceColumns = [
    {
      key: 'employee_number',
      label: 'Employee',
      render: (r: AttendanceEntry) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{r.employee_number}</span>
      ),
    },
    {
      key: 'check_in',
      label: 'Check In',
      render: (r: AttendanceEntry) => r.check_in ? new Date(r.check_in).toLocaleTimeString() : '-',
    },
    {
      key: 'check_out',
      label: 'Check Out',
      render: (r: AttendanceEntry) => r.check_out ? new Date(r.check_out).toLocaleTimeString() : '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: AttendanceEntry) => {
        const v: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
          present: 'success', late: 'warning', absent: 'danger',
        }
        return <Badge variant={v[r.status] ?? 'default'}>{r.status}</Badge>
      },
    },
  ]

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manager Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your team's status and performance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Team Size</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{teamMembers.length}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Present Today</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{presentToday}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">On Leave</p>
          <p className="text-3xl font-bold text-orange-500 mt-1">{onLeaveToday}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Reviews</p>
          <p className="text-3xl font-bold text-primary mt-1">{pendingReviewCount}</p>
        </Card>
      </div>

      {/* Section 1: Team Members */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Team Members</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teamMembers.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {m.employee_number?.slice(0, 2).toUpperCase() ?? '??'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{m.employee_number}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.job_title ?? m.employment_type}</p>
              </div>
              <Badge variant={m.is_active ? 'success' : 'danger'}>
                {m.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))}
          {teamMembers.length === 0 && (
            <p className="text-sm text-gray-400 col-span-full text-center py-4">No direct reports found.</p>
          )}
        </div>
      </Card>

      {/* Section 2: Leave Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">On Leave Today</h2>
          {leaveList.filter((l) => l.status === 'approved').length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No one on leave today.</p>
          ) : (
            <div className="space-y-2">
              {leaveList
                .filter((l) => l.status === 'approved')
                .map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/10">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{l.employee_number}</p>
                      <p className="text-xs text-gray-500">{l.leave_type} | {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="warning">On Leave</Badge>
                  </div>
                ))}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Pending Leave Requests</h2>
          {pendingLeave.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No pending leave requests.</p>
          ) : (
            <div className="space-y-2">
              {pendingLeave.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{l.employee_number}</p>
                    <p className="text-xs text-gray-500">{l.leave_type} | {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="default">Pending</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Section 3: Team Attendance */}
      <Card padding={false}>
        <div className="p-6 pb-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Attendance</h2>
          <p className="text-sm text-gray-500 mt-1">Today's attendance for your direct reports</p>
        </div>
        <div className="mt-4">
          <Table
            columns={attendanceColumns}
            data={attendanceList}
            keyExtractor={(r) => r.employee_id}
            emptyText="No attendance records for today."
          />
        </div>
      </Card>

      {/* Section 4: Team Goals */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Team Goals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/30">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{goalsSummary.total}</p>
            <p className="text-xs text-gray-500 mt-1">Total Goals</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/10">
            <p className="text-2xl font-bold text-green-600">{goalsSummary.completed}</p>
            <p className="text-xs text-gray-500 mt-1">Completed</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10">
            <p className="text-2xl font-bold text-blue-600">{goalsSummary.in_progress}</p>
            <p className="text-xs text-gray-500 mt-1">In Progress</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/10">
            <p className="text-2xl font-bold text-red-600">{goalsSummary.at_risk}</p>
            <p className="text-xs text-gray-500 mt-1">At Risk</p>
          </div>
        </div>
      </Card>

      {/* Section 5: Delegations */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delegations</h2>
          <Button size="sm" onClick={() => { setDelegationForm(defaultDelegationForm); setShowDelegationModal(true) }}>
            Create Delegation
          </Button>
        </div>
        {delegationList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No active delegations.</p>
        ) : (
          <div className="space-y-3">
            {delegationList.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Delegated to: {d.delegate_to_id}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Scope: {d.scope} | {new Date(d.start_date).toLocaleDateString()} - {new Date(d.end_date).toLocaleDateString()}
                  </p>
                  {d.notes && <p className="text-xs text-gray-400 mt-1">{d.notes}</p>}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleRevoke(d.id)}
                  loading={revokeDelegation.isPending}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Delegation Modal */}
      <Modal open={showDelegationModal} onClose={() => setShowDelegationModal(false)} title="Create Delegation" size="md">
        <form onSubmit={handleCreateDelegation} className="space-y-4">
          <Input
            label="Delegate To (Employee ID)"
            required
            placeholder="Employee ID to delegate to"
            value={delegationForm.delegate_to_id}
            onChange={(e) => setDelegationForm((p) => ({ ...p, delegate_to_id: e.target.value }))}
          />
          <Input
            label="Scope"
            required
            placeholder="e.g., leave_approval, attendance"
            value={delegationForm.scope}
            onChange={(e) => setDelegationForm((p) => ({ ...p, scope: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={delegationForm.start_date}
              onChange={(e) => setDelegationForm((p) => ({ ...p, start_date: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              required
              value={delegationForm.end_date}
              onChange={(e) => setDelegationForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <Input
            label="Notes"
            placeholder="Optional notes..."
            value={delegationForm.notes ?? ''}
            onChange={(e) => setDelegationForm((p) => ({ ...p, notes: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowDelegationModal(false)}>Cancel</Button>
            <Button type="submit" loading={createDelegation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
