import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useWarehouses, useWarehouseZones, useCreateZone, useWarehouseBins, useCreateBin, type WarehouseZone, type WarehouseBin } from '../../api/inventory'

const ZONE_TYPE_OPTIONS = [
  { value: 'receiving', label: 'Receiving' },
  { value: 'storage', label: 'Storage' },
  { value: 'picking', label: 'Picking' },
  { value: 'packing', label: 'Packing' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'quality', label: 'Quality' },
]

const ZONE_TYPE_COLORS: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  receiving: 'info', storage: 'default', picking: 'warning', packing: 'warning', shipping: 'success', quality: 'info',
}

export default function WarehouseZonesPage() {
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedZone, setSelectedZone] = useState('')
  const [zoneModal, setZoneModal] = useState(false)
  const [binModal, setBinModal] = useState(false)
  const [zoneForm, setZoneForm] = useState({ name: '', zone_type: 'storage', description: '' })
  const [binForm, setBinForm] = useState({ bin_code: '', bin_type: 'standard' })

  const { data: warehouses } = useWarehouses()
  const { data: zones, isLoading: zonesLoading } = useWarehouseZones(selectedWarehouse)
  const { data: bins, isLoading: binsLoading } = useWarehouseBins(selectedZone)
  const createZone = useCreateZone()
  const createBin = useCreateBin()

  const warehouseOptions = (warehouses ?? []).map(w => ({ value: w.id, label: w.name }))

  async function handleCreateZone() {
    if (!selectedWarehouse || !zoneForm.name) {
      toast('warning', 'Select a warehouse and enter zone name')
      return
    }
    try {
      await createZone.mutateAsync({ warehouse_id: selectedWarehouse, ...zoneForm })
      toast('success', 'Zone created')
      setZoneModal(false)
      setZoneForm({ name: '', zone_type: 'storage', description: '' })
    } catch {
      toast('error', 'Failed to create zone')
    }
  }

  async function handleCreateBin() {
    if (!selectedZone || !binForm.bin_code) {
      toast('warning', 'Select a zone and enter bin code')
      return
    }
    try {
      await createBin.mutateAsync({ zone_id: selectedZone, warehouse_id: selectedWarehouse, ...binForm })
      toast('success', 'Bin created')
      setBinModal(false)
      setBinForm({ bin_code: '', bin_type: 'standard' })
    } catch {
      toast('error', 'Failed to create bin')
    }
  }

  const zoneColumns = [
    { key: 'name', label: 'Zone', render: (row: WarehouseZone) => <button className="font-medium text-primary hover:underline" onClick={() => setSelectedZone(row.id)}>{row.name}</button> },
    { key: 'zone_type', label: 'Type', render: (row: WarehouseZone) => <Badge variant={ZONE_TYPE_COLORS[row.zone_type] ?? 'default'}>{row.zone_type}</Badge> },
    { key: 'description', label: 'Description', render: (row: WarehouseZone) => <span className="text-sm text-gray-500">{row.description ?? '—'}</span> },
  ]

  const binColumns = [
    { key: 'bin_code', label: 'Bin Code', render: (row: WarehouseBin) => <span className="font-mono font-medium">{row.bin_code}</span> },
    { key: 'bin_type', label: 'Type' },
    { key: 'max_weight', label: 'Max Weight', render: (row: WarehouseBin) => row.max_weight ? `${row.max_weight} kg` : '—' },
    { key: 'is_active', label: 'Status', render: (row: WarehouseBin) => <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge> },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Warehouse Zones & Bins</h1>
          <p className="text-sm text-gray-500 mt-1">Manage zones and bin locations within warehouses</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="w-64">
          <Select label="" options={[{ value: '', label: 'Select warehouse...' }, ...warehouseOptions]} value={selectedWarehouse} onChange={(e) => { setSelectedWarehouse(e.target.value); setSelectedZone('') }} />
        </div>
        {selectedWarehouse && (
          <Button size="sm" variant="outline" onClick={() => setZoneModal(true)}>Add Zone</Button>
        )}
        {selectedZone && (
          <Button size="sm" variant="outline" onClick={() => setBinModal(true)}>Add Bin</Button>
        )}
      </div>

      {selectedWarehouse && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Zones {selectedZone && <span className="text-sm font-normal text-gray-500">— click a zone to view its bins</span>}</h2>
          </div>
          <Table<WarehouseZone>
            columns={zoneColumns}
            data={zones ?? []}
            loading={zonesLoading}
            emptyText="No zones in this warehouse."
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      {selectedZone && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Bins in {zones?.find(z => z.id === selectedZone)?.name ?? 'Zone'}</h2>
          </div>
          <Table<WarehouseBin>
            columns={binColumns}
            data={bins ?? []}
            loading={binsLoading}
            emptyText="No bins in this zone."
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      <Modal open={zoneModal} onClose={() => setZoneModal(false)} title="Add Zone" size="sm">
        <div className="space-y-4">
          <Input label="Zone Name *" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="e.g. Bulk Storage A" />
          <Select label="Zone Type" options={ZONE_TYPE_OPTIONS} value={zoneForm.zone_type} onChange={(e) => setZoneForm({ ...zoneForm, zone_type: e.target.value })} />
          <Input label="Description" value={zoneForm.description} onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })} placeholder="Optional" />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setZoneModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateZone} loading={createZone.isPending}>Create Zone</Button>
          </div>
        </div>
      </Modal>

      <Modal open={binModal} onClose={() => setBinModal(false)} title="Add Bin" size="sm">
        <div className="space-y-4">
          <Input label="Bin Code *" value={binForm.bin_code} onChange={(e) => setBinForm({ ...binForm, bin_code: e.target.value })} placeholder="A-01-01" />
          <Select label="Bin Type" options={[{ value: 'standard', label: 'Standard' }, { value: 'bulk', label: 'Bulk' }, { value: 'refrigerated', label: 'Refrigerated' }, { value: 'hazmat', label: 'Hazmat' }]} value={binForm.bin_type} onChange={(e) => setBinForm({ ...binForm, bin_type: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setBinModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateBin} loading={createBin.isPending}>Create Bin</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
