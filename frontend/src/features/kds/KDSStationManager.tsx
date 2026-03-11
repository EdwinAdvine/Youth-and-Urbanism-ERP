import { useState } from 'react'
import { Button, Card, Badge, Spinner, Modal, Input, Select, Table, toast } from '../../components/ui'
import {
  useKDSStations,
  useCreateKDSStation,
  useUpdateKDSStation,
  useDeleteKDSStation,
  type KDSStation,
} from '../../api/kds'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATION_TYPES = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bar', label: 'Bar' },
  { value: 'grill', label: 'Grill' },
  { value: 'prep', label: 'Prep' },
  { value: 'expo', label: 'Expo' },
  { value: 'dessert', label: 'Dessert' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function KDSStationManager() {
  const { data: stations, isLoading } = useKDSStations()
  const createStation = useCreateKDSStation()
  const updateStation = useUpdateKDSStation()
  const deleteStation = useDeleteKDSStation()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<KDSStation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KDSStation | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [stationType, setStationType] = useState('kitchen')
  const [warehouseId, setWarehouseId] = useState('')

  function resetForm() {
    setName('')
    setStationType('kitchen')
    setWarehouseId('')
    setEditing(null)
  }

  function openCreate() {
    resetForm()
    setModalOpen(true)
  }

  function openEdit(station: KDSStation) {
    setEditing(station)
    setName(station.name)
    setStationType(station.station_type)
    setWarehouseId(station.warehouse_id)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) {
      toast('warning', 'Station name is required')
      return
    }
    if (!warehouseId.trim()) {
      toast('warning', 'Warehouse ID is required')
      return
    }

    const payload = {
      name: name.trim(),
      station_type: stationType,
      warehouse_id: warehouseId.trim(),
    }

    try {
      if (editing) {
        await updateStation.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Station updated')
      } else {
        await createStation.mutateAsync(payload)
        toast('success', 'Station created')
      }
      setModalOpen(false)
      resetForm()
    } catch {
      toast('error', 'Failed to save station')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteStation.mutateAsync(deleteTarget.id)
      toast('success', 'Station deleted')
      setDeleteTarget(null)
    } catch {
      toast('error', 'Failed to delete station')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Station Name',
      render: (s: KDSStation) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{s.name}</span>
      ),
    },
    {
      key: 'station_type',
      label: 'Type',
      render: (s: KDSStation) => (
        <Badge variant="primary" className="capitalize">{s.station_type}</Badge>
      ),
    },
    {
      key: 'warehouse_id',
      label: 'Warehouse',
      render: (s: KDSStation) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">{s.warehouse_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (s: KDSStation) => (
        <Badge variant={s.is_active ? 'success' : 'default'}>
          {s.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (s: KDSStation) => (
        <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (s: KDSStation) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(s)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">KDS Stations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage kitchen display system stations for order routing.
          </p>
        </div>
        <Button onClick={openCreate}>New Station</Button>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table
          columns={columns}
          data={stations ?? []}
          keyExtractor={(s) => s.id}
          emptyText="No KDS stations configured yet."
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm() }}
        title={editing ? 'Edit Station' : 'New Station'}
      >
        <div className="space-y-4">
          <Input
            label="Station Name"
            placeholder="e.g. Main Kitchen, Bar Station"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            label="Station Type"
            value={stationType}
            onChange={(e) => setStationType(e.target.value)}
            options={STATION_TYPES}
          />
          <Input
            label="Warehouse ID"
            placeholder="Warehouse UUID"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setModalOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={createStation.isPending || updateStation.isPending}
            >
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Station"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Existing orders
            routed to this station will not be affected.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteStation.isPending}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
