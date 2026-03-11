import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useWorkStations,
  useCreateWorkStation,
  useUpdateWorkStation,
  type WorkStation,
  type CreateWorkStationPayload,
} from '../../api/manufacturing'
import { useWarehouses, type Warehouse } from '../../api/inventory'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

interface WSFormState {
  name: string
  code: string
  description: string
  capacity_per_hour: string
  hourly_rate: string
  warehouse_id: string
}

const defaultForm: WSFormState = {
  name: '',
  code: '',
  description: '',
  capacity_per_hour: '',
  hourly_rate: '0',
  warehouse_id: '',
}

export default function WorkStationsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWS, setEditingWS] = useState<WorkStation | null>(null)
  const [form, setForm] = useState<WSFormState>(defaultForm)

  const { data: workstations, isLoading } = useWorkStations()
  const { data: warehouses } = useWarehouses()
  const createWS = useCreateWorkStation()
  const updateWS = useUpdateWorkStation()

  function openCreate() {
    setEditingWS(null)
    setForm(defaultForm)
    setModalOpen(true)
  }

  function openEdit(ws: WorkStation) {
    setEditingWS(ws)
    setForm({
      name: ws.name,
      code: ws.code,
      description: ws.description ?? '',
      capacity_per_hour: ws.capacity_per_hour != null ? String(ws.capacity_per_hour) : '',
      hourly_rate: String(ws.hourly_rate),
      warehouse_id: ws.warehouse_id ?? '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingWS(null)
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast('warning', 'Name is required')
      return
    }
    if (!form.code.trim()) {
      toast('warning', 'Code is required')
      return
    }

    const payload: CreateWorkStationPayload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim() || undefined,
      capacity_per_hour: form.capacity_per_hour ? Number(form.capacity_per_hour) : undefined,
      hourly_rate: Number(form.hourly_rate) || 0,
      warehouse_id: form.warehouse_id || undefined,
    }

    try {
      if (editingWS) {
        await updateWS.mutateAsync({ id: editingWS.id, ...payload })
        toast('success', 'Workstation updated')
      } else {
        await createWS.mutateAsync(payload)
        toast('success', 'Workstation created')
      }
      closeModal()
    } catch {
      toast('error', editingWS ? 'Failed to update workstation' : 'Failed to create workstation')
    }
  }

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row: WorkStation) => <span className="font-mono text-sm text-primary font-medium">{row.code}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      render: (row: WorkStation) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: WorkStation) => (
        <span className="text-gray-500 text-sm max-w-[200px] truncate block">{row.description ?? '--'}</span>
      ),
    },
    {
      key: 'capacity_per_hour',
      label: 'Capacity/hr',
      render: (row: WorkStation) => row.capacity_per_hour ?? <span className="text-gray-400">--</span>,
    },
    {
      key: 'hourly_rate',
      label: 'Hourly Rate',
      render: (row: WorkStation) => formatCurrency(row.hourly_rate),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: WorkStation) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: WorkStation) => (
        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
      ),
    },
  ]

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Work Stations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage manufacturing work stations and production lines</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Work Station
        </Button>
      </div>

      <div className="mb-4">
        <span className="text-sm text-gray-500">{workstations?.length ?? 0} workstations</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<WorkStation>
          columns={columns}
          data={workstations ?? []}
          loading={isLoading}
          emptyText="No work stations found"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingWS ? 'Edit Work Station' : 'New Work Station'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Assembly Line A"
            />
            <Input
              label="Code *"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. WS-ASM-A"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Capacity / Hour"
              type="number"
              min="0"
              step="0.01"
              value={form.capacity_per_hour}
              onChange={(e) => setForm({ ...form, capacity_per_hour: e.target.value })}
              placeholder="Units per hour"
            />
            <Input
              label="Hourly Rate"
              type="number"
              min="0"
              step="0.01"
              value={form.hourly_rate}
              onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
            <select
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              value={form.warehouse_id}
              onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
            >
              <option value="">No warehouse assigned</option>
              {(warehouses ?? []).map((wh: Warehouse) => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={closeModal}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              loading={createWS.isPending || updateWS.isPending}
            >
              {editingWS ? 'Save Changes' : 'Create Work Station'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
