import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Input, Modal, toast } from '../../components/ui'

interface RoutingStep {
  id: string
  step_number: number
  operation: string
  work_station: string
  duration_minutes: number
  cost: number
  is_active: boolean
  created_at: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

interface RoutingFormState {
  step_number: string
  operation: string
  work_station: string
  duration_minutes: string
  cost: string
}

const defaultForm: RoutingFormState = {
  step_number: '',
  operation: '',
  work_station: '',
  duration_minutes: '',
  cost: '0',
}

// Placeholder data for demonstration
const SAMPLE_ROUTING: RoutingStep[] = [
  { id: '1', step_number: 1, operation: 'Cutting', work_station: 'WS-001', duration_minutes: 30, cost: 15.0, is_active: true, created_at: '2026-01-10T00:00:00Z' },
  { id: '2', step_number: 2, operation: 'Welding', work_station: 'WS-002', duration_minutes: 60, cost: 45.0, is_active: true, created_at: '2026-01-10T00:00:00Z' },
  { id: '3', step_number: 3, operation: 'Assembly', work_station: 'WS-003', duration_minutes: 90, cost: 30.0, is_active: true, created_at: '2026-01-12T00:00:00Z' },
  { id: '4', step_number: 4, operation: 'Quality Check', work_station: 'WS-004', duration_minutes: 20, cost: 10.0, is_active: true, created_at: '2026-01-15T00:00:00Z' },
  { id: '5', step_number: 5, operation: 'Packaging', work_station: 'WS-005', duration_minutes: 15, cost: 8.0, is_active: false, created_at: '2026-01-18T00:00:00Z' },
]

export default function RoutingPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<RoutingStep | null>(null)
  const [form, setForm] = useState<RoutingFormState>(defaultForm)
  const [data, setData] = useState<RoutingStep[]>(SAMPLE_ROUTING)

  const filtered = data.filter(
    (r) =>
      r.operation.toLowerCase().includes(search.toLowerCase()) ||
      r.work_station.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setForm(defaultForm)
    setShowCreate(true)
  }

  const openEdit = (item: RoutingStep) => {
    setForm({
      step_number: String(item.step_number),
      operation: item.operation,
      work_station: item.work_station,
      duration_minutes: String(item.duration_minutes),
      cost: String(item.cost),
    })
    setEditItem(item)
  }

  const handleSave = () => {
    if (!form.operation.trim() || !form.work_station.trim()) {
      toast('warning', 'Operation and work station are required')
      return
    }
    if (editItem) {
      setData((prev) =>
        prev.map((r) =>
          r.id === editItem.id
            ? {
                ...r,
                step_number: Number(form.step_number) || r.step_number,
                operation: form.operation.trim(),
                work_station: form.work_station.trim(),
                duration_minutes: Number(form.duration_minutes) || 0,
                cost: Number(form.cost) || 0,
              }
            : r
        )
      )
      toast('success', 'Routing step updated')
      setEditItem(null)
    } else {
      const newStep: RoutingStep = {
        id: String(Date.now()),
        step_number: Number(form.step_number) || data.length + 1,
        operation: form.operation.trim(),
        work_station: form.work_station.trim(),
        duration_minutes: Number(form.duration_minutes) || 0,
        cost: Number(form.cost) || 0,
        is_active: true,
        created_at: new Date().toISOString(),
      }
      setData((prev) => [...prev, newStep])
      toast('success', 'Routing step created')
      setShowCreate(false)
    }
    setForm(defaultForm)
  }

  const handleDelete = (id: string) => {
    setData((prev) => prev.filter((r) => r.id !== id))
    toast('success', 'Routing step removed')
  }

  const columns = [
    {
      key: 'step_number',
      label: '#',
      render: (row: RoutingStep) => <span className="font-semibold text-gray-900">{row.step_number}</span>,
    },
    {
      key: 'operation',
      label: 'Operation',
      render: (row: RoutingStep) => <span className="font-medium text-gray-900">{row.operation}</span>,
    },
    {
      key: 'work_station',
      label: 'Work Station',
      render: (row: RoutingStep) => <span className="text-gray-600">{row.work_station}</span>,
    },
    {
      key: 'duration_minutes',
      label: 'Duration',
      render: (row: RoutingStep) => <span className="text-gray-700">{row.duration_minutes} min</span>,
    },
    {
      key: 'cost',
      label: 'Cost',
      render: (row: RoutingStep) => <span className="text-gray-700">{formatCurrency(row.cost)}</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: RoutingStep) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: RoutingStep) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => handleDelete(row.id)}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ]

  const modalOpen = showCreate || !!editItem

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Routing</h1>
          <p className="text-sm text-gray-500 mt-1">Manage production routing steps and operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/manufacturing')}>
            Dashboard
          </Button>
          <Button onClick={openCreate}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Step
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-72">
          <Input
            placeholder="Search operations or stations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <span className="text-sm text-gray-500">{filtered.length} steps</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<RoutingStep>
          columns={columns}
          data={filtered}
          loading={false}
          emptyText="No routing steps found"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setShowCreate(false); setEditItem(null) }}
        title={editItem ? 'Edit Routing Step' : 'Add Routing Step'}
      >
        <div className="space-y-4">
          <Input
            label="Step Number"
            type="number"
            value={form.step_number}
            onChange={(e) => setForm({ ...form, step_number: e.target.value })}
            placeholder="1"
          />
          <Input
            label="Operation *"
            value={form.operation}
            onChange={(e) => setForm({ ...form, operation: e.target.value })}
            placeholder="e.g. Cutting, Welding, Assembly"
          />
          <Input
            label="Work Station *"
            value={form.work_station}
            onChange={(e) => setForm({ ...form, work_station: e.target.value })}
            placeholder="e.g. WS-001"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (minutes)"
              type="number"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
              placeholder="30"
            />
            <Input
              label="Cost (USD)"
              type="number"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => { setShowCreate(false); setEditItem(null) }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              {editItem ? 'Update Step' : 'Add Step'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
