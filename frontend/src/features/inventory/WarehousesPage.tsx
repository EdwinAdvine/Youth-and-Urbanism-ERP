import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  type Warehouse,
  type CreateWarehousePayload,
} from '../../api/inventory'

const WAREHOUSE_TYPE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'transit', label: 'Transit' },
  { value: 'drop_ship', label: 'Drop Ship' },
  { value: 'consignment', label: 'Consignment' },
]

interface WarehouseFormState {
  name: string
  location: string
  address: string
  warehouse_type: string
}

const defaultForm: WarehouseFormState = { name: '', location: '', address: '', warehouse_type: 'standard' }

export default function WarehousesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Warehouse | null>(null)
  const [form, setForm] = useState<WarehouseFormState>(defaultForm)

  const { data: warehouses, isLoading } = useWarehouses()
  const createWarehouse = useCreateWarehouse()
  const updateWarehouse = useUpdateWarehouse()
  const deleteWarehouse = useDeleteWarehouse()

  function openCreate() {
    setEditingWarehouse(null)
    setForm(defaultForm)
    setModalOpen(true)
  }

  function openEdit(wh: Warehouse) {
    setEditingWarehouse(wh)
    setForm({
      name: wh.name,
      location: wh.location ?? '',
      address: wh.address ?? '',
      warehouse_type: wh.warehouse_type ?? 'standard',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingWarehouse(null)
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast('warning', 'Warehouse name is required')
      return
    }

    const payload: CreateWarehousePayload = {
      name: form.name.trim(),
      location: form.location.trim() || undefined,
      address: form.address.trim() || undefined,
      warehouse_type: form.warehouse_type,
    }

    try {
      if (editingWarehouse) {
        await updateWarehouse.mutateAsync({ id: editingWarehouse.id, ...payload })
        toast('success', 'Warehouse updated')
      } else {
        await createWarehouse.mutateAsync(payload)
        toast('success', 'Warehouse created')
      }
      closeModal()
    } catch {
      toast('error', editingWarehouse ? 'Failed to update warehouse' : 'Failed to create warehouse')
    }
  }

  async function handleDelete(wh: Warehouse) {
    try {
      await deleteWarehouse.mutateAsync(wh.id)
      toast('success', 'Warehouse deleted')
      setConfirmDelete(null)
    } catch {
      toast('error', 'Failed to delete warehouse')
    }
  }

  async function handleToggleActive(wh: Warehouse) {
    try {
      await updateWarehouse.mutateAsync({ id: wh.id, is_active: !wh.is_active })
      toast('success', wh.is_active ? 'Warehouse deactivated' : 'Warehouse activated')
    } catch {
      toast('error', 'Failed to update warehouse')
    }
  }

  const columns = [
    { key: 'name', label: 'Name', render: (row: Warehouse) => <span className="font-medium text-gray-900">{row.name}</span> },
    {
      key: 'warehouse_type',
      label: 'Type',
      render: (row: Warehouse) => {
        const colors: Record<string, 'primary' | 'info' | 'warning' | 'success'> = { standard: 'primary', transit: 'info', drop_ship: 'warning', consignment: 'success' }
        return <Badge variant={colors[row.warehouse_type] ?? 'default'}>{row.warehouse_type?.replace('_', ' ')}</Badge>
      },
    },
    {
      key: 'location',
      label: 'Location',
      render: (row: Warehouse) => row.location ?? <span className="text-gray-400">—</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: Warehouse) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: Warehouse) =>
        new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
    {
      key: 'actions',
      label: '',
      render: (row: Warehouse) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleActive(row)}
            className="text-gray-500 hover:text-gray-700"
          >
            {row.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(row)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Warehouses</h1>
          <p className="text-sm text-gray-500 mt-1">Manage storage locations and warehouses</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Warehouse
        </Button>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
        <Table<Warehouse>
          columns={columns}
          data={warehouses ?? []}
          loading={isLoading}
          emptyText="No warehouses found. Create one to get started."
          keyExtractor={(row) => row.id}
        />
        </div>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingWarehouse ? 'Edit Warehouse' : 'New Warehouse'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Main Warehouse, North Store"
          />
          <Input
            label="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. 123 Industrial Road, Nairobi"
          />
          <Select
            label="Warehouse Type"
            options={WAREHOUSE_TYPE_OPTIONS}
            value={form.warehouse_type}
            onChange={(e) => setForm({ ...form, warehouse_type: e.target.value })}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Full warehouse address"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={closeModal}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              loading={createWarehouse.isPending || updateWarehouse.isPending}
            >
              {editingWarehouse ? 'Save Changes' : 'Create Warehouse'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Warehouse"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold">{confirmDelete?.name}</span>? This will fail if the warehouse has stock.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleteWarehouse.isPending}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
