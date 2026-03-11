import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Modal, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { useAssets, useCreateAsset, type AssetCreate } from '../../api/manufacturing_equipment'

const statusColors: Record<string, string> = {
  active: 'green',
  inactive: 'gray',
  disposed: 'red',
  under_maintenance: 'yellow',
}

export default function AssetRegisterPage() {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState<AssetCreate>({
    asset_code: '',
    name: '',
    asset_type: '',
  })

  const { data: assets, isLoading } = useAssets(undefined, statusFilter || undefined)
  const createAsset = useCreateAsset()

  const handleCreate = async () => {
    if (!form.asset_code || !form.name || !form.asset_type) {
      return toast({ title: 'Asset code, name, and type are required', variant: 'destructive' })
    }
    try {
      await createAsset.mutateAsync(form)
      toast({ title: 'Asset registered' })
      setModalOpen(false)
      setForm({ asset_code: '', name: '', asset_type: '' })
    } catch {
      toast({ title: 'Failed to create asset', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Asset Register</h1>
        <Button onClick={() => setModalOpen(true)}>+ Register Asset</Button>
      </div>

      <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-48">
        <option value="">All Statuses</option>
        {['active', 'inactive', 'under_maintenance', 'disposed'].map(s => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </Select>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Asset Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Operating Hours</th>
              <th>Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>
            ) : assets?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">No assets registered</td></tr>
            ) : assets?.map(asset => (
              <tr key={asset.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/manufacturing/assets/${asset.id}`)}>
                <td className="font-mono text-sm font-medium">{asset.asset_code}</td>
                <td className="font-medium">{asset.name}</td>
                <td className="text-sm">{asset.asset_type}</td>
                <td><Badge variant={statusColors[asset.status] || 'gray'}>{asset.status.replace('_', ' ')}</Badge></td>
                <td className="text-sm">{Number(asset.total_operating_hours).toFixed(1)}h</td>
                <td className="text-sm text-gray-500">{asset.location || '—'}</td>
                <td>
                  <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); navigate(`/manufacturing/assets/${asset.id}`) }}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Register Asset">
        <div className="space-y-4">
          <Input label="Asset Code" value={form.asset_code} onChange={e => setForm({ ...form, asset_code: e.target.value })} placeholder="ASSET-001" />
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="CNC Machine #1" />
          <Input label="Type" value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })} placeholder="machine, tool, vehicle..." />
          <Input label="Manufacturer" value={form.manufacturer || ''} onChange={e => setForm({ ...form, manufacturer: e.target.value })} />
          <Input label="Serial Number" value={form.serial_number || ''} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
          <Input label="Location" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createAsset.isPending}>Register</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
