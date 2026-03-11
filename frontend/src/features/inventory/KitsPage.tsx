import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useKits, useCreateKit, useInventoryItems, type Kit } from '../../api/inventory'
import apiClient from '../../api/client'

export default function KitsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [checkModal, setCheckModal] = useState<{ open: boolean; kit: Kit | null; data: Record<string, unknown> | null }>({ open: false, kit: null, data: null })
  const [form, setForm] = useState({ kit_item_id: '', description: '' })
  const [components, setComponents] = useState<{ component_item_id: string; quantity: string; is_optional: boolean }[]>([])
  const [checkWarehouse, setCheckWarehouse] = useState('')
  const [checkQty, setCheckQty] = useState('1')

  const { data: kits, isLoading } = useKits()
  const { data: items } = useInventoryItems()
  const createKit = useCreateKit()

  const itemOptions = (items?.items ?? []).map(i => ({ value: i.id, label: `${i.name} (${i.sku})` }))

  function addComponent() {
    setComponents([...components, { component_item_id: '', quantity: '1', is_optional: false }])
  }

  function removeComponent(index: number) {
    setComponents(components.filter((_, i) => i !== index))
  }

  async function handleCreate() {
    if (!form.kit_item_id || components.length === 0) {
      toast('warning', 'Kit item and at least one component are required')
      return
    }
    try {
      await createKit.mutateAsync({
        kit_item_id: form.kit_item_id,
        description: form.description || undefined,
        components: components.filter(c => c.component_item_id).map(c => ({
          component_item_id: c.component_item_id,
          quantity: parseFloat(c.quantity),
          is_optional: c.is_optional,
        })),
      })
      toast('success', 'Kit created')
      setModalOpen(false)
      setForm({ kit_item_id: '', description: '' })
      setComponents([])
    } catch {
      toast('error', 'Failed to create kit')
    }
  }

  async function handleCheckAvailability(kit: Kit) {
    try {
      const { data } = await apiClient.get(`/inventory/kits/${kit.id}/check-availability`, { params: { warehouse_id: checkWarehouse, quantity: parseInt(checkQty) } })
      setCheckModal({ open: true, kit, data })
    } catch {
      toast('error', 'Failed to check availability')
    }
  }

  const columns = [
    { key: 'kit_item_name', label: 'Kit', render: (row: Kit) => <span className="font-medium">{row.kit_item_name ?? row.kit_item_id}</span> },
    { key: 'components', label: 'Components', render: (row: Kit) => <span>{row.components.length} component{row.components.length !== 1 ? 's' : ''}</span> },
    { key: 'description', label: 'Description', render: (row: Kit) => <span className="text-sm text-gray-500">{row.description ?? '—'}</span> },
    { key: 'is_active', label: 'Status', render: (row: Kit) => <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', label: '',
      render: (row: Kit) => <Button size="sm" variant="ghost" onClick={() => handleCheckAvailability(row)}>Check Availability</Button>,
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kits & Bundles</h1>
          <p className="text-sm text-gray-500 mt-1">Define product kits assembled from multiple components</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New Kit</Button>
      </div>

      <Card padding={false}>
        <Table<Kit>
          columns={columns}
          data={kits ?? []}
          loading={isLoading}
          emptyText="No kits defined."
          keyExtractor={(row) => row.id}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Kit" size="sm">
        <div className="space-y-4">
          <Select label="Kit Item *" options={[{ value: '', label: 'Select kit item...' }, ...itemOptions]} value={form.kit_item_id} onChange={(e) => setForm({ ...form, kit_item_id: e.target.value })} />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Components</label>
              <Button size="sm" variant="ghost" onClick={addComponent}>+ Add</Button>
            </div>
            <div className="space-y-2">
              {components.map((comp, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Select label="" options={[{ value: '', label: 'Item...' }, ...itemOptions]} value={comp.component_item_id} onChange={(e) => setComponents(components.map((c, i) => i === index ? { ...c, component_item_id: e.target.value } : c))} />
                  </div>
                  <input type="number" value={comp.quantity} onChange={(e) => setComponents(components.map((c, i) => i === index ? { ...c, quantity: e.target.value } : c))} className="w-16 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-sm" min="0.01" step="0.01" />
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeComponent(index)}>×</Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createKit.isPending}>Create Kit</Button>
          </div>
        </div>
      </Modal>

      <Modal open={checkModal.open} onClose={() => setCheckModal({ open: false, kit: null, data: null })} title="Kit Availability Check" size="sm">
        {checkModal.data && (
          <div className="space-y-3">
            <Badge variant={(checkModal.data as any).can_assemble ? 'success' : 'danger'}>
              {(checkModal.data as any).can_assemble ? 'Can Assemble' : 'Cannot Assemble'}
            </Badge>
            <div className="space-y-2">
              {((checkModal.data as any).components ?? []).map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{c.component}</span>
                  <span className={c.sufficient ? 'text-green-600' : 'text-red-600'}>
                    {c.available}/{c.needed} {c.optional ? '(optional)' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
