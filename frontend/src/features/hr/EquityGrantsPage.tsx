import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useEquityGrants,
  useCreateEquityGrant,
  useUpdateEquityGrant,
  useVestingSchedule,
  useVestEquityGrant,
  type EquityGrant,
  type EquityGrantCreatePayload,
  type EquityGrantUpdatePayload,
  type VestingEvent,
} from '../../api/hr_phase1'
import { useEmployees } from '../../api/hr'

const defaultForm: EquityGrantCreatePayload = {
  employee_id: '',
  grant_type: 'stock_option',
  shares: 0,
  strike_price: undefined,
  grant_date: '',
  vesting_start: '',
  vesting_schedule: undefined,
  notes: '',
}

const statusVariant: Record<string, 'info' | 'success' | 'danger' | 'default'> = {
  active: 'info',
  fully_vested: 'success',
  cancelled: 'danger',
  exercised: 'default',
}

export default function EquityGrantsPage() {
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: grants, isLoading } = useEquityGrants({
    employee_id: employeeFilter || undefined,
    grant_type: typeFilter || undefined,
    status: statusFilter || undefined,
  })
  const { data: empData } = useEmployees({ limit: 500 })
  const createGrant = useCreateEquityGrant()
  const updateGrant = useUpdateEquityGrant()
  const vestGrant = useVestEquityGrant()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EquityGrant | null>(null)
  const [form, setForm] = useState<EquityGrantCreatePayload>(defaultForm)
  const [vestingJson, setVestingJson] = useState('')

  const [vestingGrantId, setVestingGrantId] = useState('')
  const { data: vestingEvents } = useVestingSchedule(vestingGrantId)

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setVestingJson('')
    setShowModal(true)
  }

  function openEdit(grant: EquityGrant) {
    setEditing(grant)
    setForm({
      employee_id: grant.employee_id,
      grant_type: grant.grant_type,
      shares: grant.shares,
      strike_price: grant.strike_price ?? undefined,
      grant_date: grant.grant_date.slice(0, 10),
      vesting_start: grant.vesting_start.slice(0, 10),
      vesting_schedule: grant.vesting_schedule ?? undefined,
      notes: grant.notes ?? '',
    })
    setVestingJson(grant.vesting_schedule ? JSON.stringify(grant.vesting_schedule, null, 2) : '')
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let parsedSchedule: Record<string, unknown> | undefined
    if (vestingJson.trim()) {
      try {
        parsedSchedule = JSON.parse(vestingJson)
      } catch {
        toast('error', 'Invalid JSON in vesting schedule')
        return
      }
    }

    if (editing) {
      const updateData: EquityGrantUpdatePayload = {
        shares: form.shares,
        strike_price: form.strike_price,
        vesting_schedule: parsedSchedule,
        notes: form.notes,
      }
      updateGrant.mutate(
        { grantId: editing.id, data: updateData },
        {
          onSuccess: () => { toast('success', 'Equity grant updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update equity grant'),
        }
      )
    } else {
      createGrant.mutate(
        { ...form, vesting_schedule: parsedSchedule },
        {
          onSuccess: () => { toast('success', 'Equity grant created'); setShowModal(false) },
          onError: () => toast('error', 'Failed to create equity grant'),
        }
      )
    }
  }

  function handleVest(grant: EquityGrant) {
    vestGrant.mutate(grant.id, {
      onSuccess: () => toast('success', 'Vesting event processed'),
      onError: () => toast('error', 'Failed to process vesting'),
    })
  }

  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (g: EquityGrant) => (
        <p className="font-medium text-gray-900 dark:text-gray-100">{g.employee_id}</p>
      ),
    },
    {
      key: 'grant_type',
      label: 'Type',
      render: (g: EquityGrant) => (
        <Badge variant="info">{g.grant_type.replace('_', ' ').toUpperCase()}</Badge>
      ),
    },
    {
      key: 'shares',
      label: 'Shares',
      render: (g: EquityGrant) => g.shares.toLocaleString(),
    },
    {
      key: 'strike_price',
      label: 'Strike Price',
      render: (g: EquityGrant) => g.strike_price != null ? `$${g.strike_price.toFixed(2)}` : '-',
    },
    {
      key: 'grant_date',
      label: 'Grant Date',
      render: (g: EquityGrant) => new Date(g.grant_date).toLocaleDateString(),
    },
    {
      key: 'vesting_start',
      label: 'Vesting Start',
      render: (g: EquityGrant) => new Date(g.vesting_start).toLocaleDateString(),
    },
    {
      key: 'vested_shares',
      label: 'Vested',
      render: (g: EquityGrant) => g.vested_shares.toLocaleString(),
    },
    {
      key: 'exercised_shares',
      label: 'Exercised',
      render: (g: EquityGrant) => g.exercised_shares.toLocaleString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (g: EquityGrant) => (
        <Badge variant={statusVariant[g.status] ?? 'default'}>{g.status.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (g: EquityGrant) => (
        <div className="flex items-center justify-end gap-2">
          {g.status === 'active' && (
            <Button variant="ghost" size="sm" onClick={() => handleVest(g)}>Vest</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setVestingGrantId(g.id)}>Schedule</Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>Edit</Button>
        </div>
      ),
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Equity Grants</h1>
          <p className="text-sm text-gray-500 mt-1">Manage employee equity grants and vesting</p>
        </div>
        <Button onClick={openCreate}>Create Grant</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Employees' },
            ...(empData?.items?.map((e: { id: string; first_name: string; last_name: string }) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
          ]}
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="w-48"
        />
        <Select
          options={[
            { value: '', label: 'All Types' },
            { value: 'stock_option', label: 'Stock Option' },
            { value: 'rsu', label: 'RSU' },
            { value: 'espp', label: 'ESPP' },
          ]}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-48"
        />
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'active', label: 'Active' },
            { value: 'fully_vested', label: 'Fully Vested' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'exercised', label: 'Exercised' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={grants ?? []}
          keyExtractor={(g) => g.id}
          emptyText="No equity grants found."
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Equity Grant' : 'Create Equity Grant'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <Select
              label="Employee"
              required
              options={[
                { value: '', label: 'Select employee...' },
                ...(empData?.items?.map((e: { id: string; first_name: string; last_name: string }) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
              ]}
              value={form.employee_id}
              onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
            />
          )}
          <Select
            label="Grant Type"
            required
            options={[
              { value: 'stock_option', label: 'Stock Option' },
              { value: 'rsu', label: 'RSU' },
              { value: 'espp', label: 'ESPP' },
            ]}
            value={form.grant_type}
            onChange={(e) => setForm((p) => ({ ...p, grant_type: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Shares"
              type="number"
              required
              value={form.shares}
              onChange={(e) => setForm((p) => ({ ...p, shares: Number(e.target.value) }))}
            />
            <Input
              label="Strike Price ($)"
              type="number"
              step="0.01"
              value={form.strike_price ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, strike_price: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Grant Date"
              type="date"
              required
              value={form.grant_date}
              onChange={(e) => setForm((p) => ({ ...p, grant_date: e.target.value }))}
            />
            <Input
              label="Vesting Start"
              type="date"
              required
              value={form.vesting_start}
              onChange={(e) => setForm((p) => ({ ...p, vesting_start: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vesting Schedule (JSON)</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={4}
              placeholder='{"cliff_months": 12, "total_months": 48, "frequency": "monthly"}'
              value={vestingJson}
              onChange={(e) => setVestingJson(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={2}
              value={form.notes ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createGrant.isPending || updateGrant.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Vesting Schedule Modal */}
      <Modal open={!!vestingGrantId} onClose={() => setVestingGrantId('')} title="Vesting Schedule" size="lg">
        <div className="space-y-4">
          {vestingEvents && (vestingEvents as VestingEvent[]).length > 0 ? (
            <div className="space-y-3">
              {(vestingEvents as VestingEvent[]).map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-3 rounded-[10px] border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex-shrink-0 w-3 h-3 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {new Date(event.date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {event.shares_vesting.toLocaleString()} shares vesting
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {event.cumulative_vested.toLocaleString()} total
                    </p>
                    <p className="text-xs text-gray-500">{event.percentage_vested.toFixed(1)}% vested</p>
                  </div>
                  <div className="w-24">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(event.percentage_vested, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-gray-400 text-sm">No vesting schedule available</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
