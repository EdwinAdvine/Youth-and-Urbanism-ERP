import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Input, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useBOMs,
  useCreateBOM,
  useDeleteBOM,
  type BOM,
  type CreateBOMPayload,
  type BOMItemPayload,
} from '../../api/manufacturing'
import { useInventoryItems } from '../../api/inventory'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface BOMFormState {
  name: string
  finished_item_id: string
  quantity_produced: string
  notes: string
  items: BOMItemPayload[]
}

const defaultForm: BOMFormState = {
  name: '',
  finished_item_id: '',
  quantity_produced: '1',
  notes: '',
  items: [],
}

export default function BOMListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<BOMFormState>(defaultForm)
  const [newItemId, setNewItemId] = useState('')
  const [newItemQty, setNewItemQty] = useState('1')

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useBOMs({ search: search || undefined, skip, limit })
  const { data: inventoryItems } = useInventoryItems({ limit: 100 })
  const createBOM = useCreateBOM()
  const deleteBOM = useDeleteBOM()

  const addItemLine = () => {
    if (!newItemId || !newItemQty) return
    setForm({
      ...form,
      items: [
        ...form.items,
        {
          item_id: newItemId,
          quantity_required: parseFloat(newItemQty),
          unit_of_measure: 'unit',
          scrap_percentage: 0,
          sort_order: form.items.length,
        },
      ],
    })
    setNewItemId('')
    setNewItemQty('1')
  }

  const removeItemLine = (idx: number) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
  }

  const handleCreate = async () => {
    if (!form.name || !form.finished_item_id || form.items.length === 0) {
      toast('error', 'Name, finished item, and at least one material are required')
      return
    }
    try {
      const payload: CreateBOMPayload = {
        name: form.name,
        finished_item_id: form.finished_item_id,
        quantity_produced: parseInt(form.quantity_produced) || 1,
        notes: form.notes || undefined,
        items: form.items,
      }
      await createBOM.mutateAsync(payload)
      toast('success', 'BOM created')
      setModalOpen(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to create BOM')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteBOM.mutateAsync(id)
      toast('success', 'BOM deactivated')
    } catch {
      toast('error', 'Failed to delete BOM')
    }
  }

  const getItemName = (id: string) => {
    const item = inventoryItems?.items?.find((i) => i.id === id)
    return item?.name ?? id
  }

  const columns = [
    {
      key: 'bom_number',
      label: 'BOM #',
      render: (row: BOM) => (
        <button className="font-medium text-primary hover:underline" onClick={() => navigate(`/manufacturing/bom/${row.id}`)}>
          {row.bom_number}
        </button>
      ),
    },
    { key: 'name', label: 'Name' },
    {
      key: 'finished_item_name',
      label: 'Finished Item',
      render: (row: BOM) => <span className="text-gray-700 dark:text-gray-300">{row.finished_item_name ?? '-'}</span>,
    },
    { key: 'quantity_produced', label: 'Qty/Batch' },
    { key: 'version', label: 'Ver.' },
    {
      key: 'is_default',
      label: 'Default',
      render: (row: BOM) => row.is_default ? <Badge variant="primary">Yes</Badge> : <span className="text-gray-400">No</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: BOM) => <Badge variant={row.is_active ? 'success' : 'danger'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: BOM) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      label: '',
      render: (row: BOM) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => navigate(`/manufacturing/bom/${row.id}`)}>
            View
          </Button>
          {row.is_active && (
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(row.id)}>
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bills of Materials</h1>
          <p className="text-sm text-gray-500 mt-1">Recipes and formulas for production</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/manufacturing')}>
            Dashboard
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New BOM
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search by name or BOM number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="max-w-md"
        />
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<BOM>
          columns={columns}
          data={data?.boms ?? []}
          loading={isLoading}
          emptyText="No BOMs found"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Create BOM Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Bill of Materials">
        <div className="space-y-4">
          <Input
            label="BOM Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Wooden Chair Assembly"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Finished Item</label>
            <select
              className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.finished_item_id}
              onChange={(e) => setForm({ ...form, finished_item_id: e.target.value })}
            >
              <option value="">Select finished item...</option>
              {inventoryItems?.items?.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
              ))}
            </select>
          </div>
          <Input
            label="Quantity Produced per Batch"
            type="number"
            value={form.quantity_produced}
            onChange={(e) => setForm({ ...form, quantity_produced: e.target.value })}
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {/* BOM Items */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Raw Materials</h3>
            {form.items.length > 0 && (
              <div className="space-y-2 mb-3">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-950 rounded-lg px-3 py-2">
                    <span className="flex-1">{getItemName(item.item_id)}</span>
                    <span className="font-medium">x{item.quantity_required}</span>
                    <button className="text-red-500 hover:text-red-700" onClick={() => removeItemLine(idx)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={newItemId}
                onChange={(e) => setNewItemId(e.target.value)}
              >
                <option value="">Select material...</option>
                {inventoryItems?.items?.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
                ))}
              </select>
              <Input
                type="number"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                className="w-20"
                placeholder="Qty"
              />
              <Button variant="outline" size="sm" onClick={addItemLine}>
                Add
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createBOM.isPending}>
              {createBOM.isPending ? 'Creating...' : 'Create BOM'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
