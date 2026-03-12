import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { Button, Badge, Card, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useAsset, useAssetHistory, useUpdateAsset } from '../../api/manufacturing_equipment'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const statusColors: Record<string, BadgeVariant> = {
  active: 'success',
  inactive: 'default',
  disposed: 'danger',
  under_maintenance: 'warning',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AssetDetail() {
  const { assetId } = useParams<{ assetId: string }>()
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<{ status?: string; location?: string; notes?: string }>({})

  const { data: asset, isLoading } = useAsset(assetId!)
  const { data: history } = useAssetHistory(assetId!)
  const updateAsset = useUpdateAsset()

  const handleSave = async () => {
    try {
      await updateAsset.mutateAsync({ id: assetId!, data: editForm })
      toast('success', 'Asset updated')
      setEditOpen(false)
    } catch {
      toast('error', 'Failed to update')
    }
  }

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!asset) return <div className="p-6 text-gray-500">Asset not found</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          <div className="text-gray-500 font-mono text-sm">{asset.asset_code}</div>
        </div>
        <div className="flex gap-2">
          <Badge variant={statusColors[asset.status] || 'default'} className="text-sm">
            {asset.status.replace('_', ' ')}
          </Badge>
          <Button onClick={() => { setEditForm({ status: asset.status, location: asset.location || '', notes: asset.notes || '' }); setEditOpen(true) }}>
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-gray-500">Type</div>
          <div className="font-medium">{asset.asset_type}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500">Manufacturer</div>
          <div className="font-medium">{asset.manufacturer || '—'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500">Operating Hours</div>
          <div className="text-xl font-bold">{Number(asset.total_operating_hours).toFixed(1)}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500">Purchase Cost</div>
          <div className="text-xl font-bold">${Number(asset.purchase_cost).toLocaleString()}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Details</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Serial Number</span><span>{asset.serial_number || '—'}</span>
            <span className="text-gray-500">Model</span><span>{asset.model_number || '—'}</span>
            <span className="text-gray-500">Purchase Date</span><span>{formatDate(asset.purchase_date)}</span>
            <span className="text-gray-500">Warranty Expiry</span><span>{formatDate(asset.warranty_expiry)}</span>
            <span className="text-gray-500">Location</span><span>{asset.location || '—'}</span>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Maintenance History</h2>
          {!history?.maintenance_work_orders?.length ? (
            <div className="text-gray-500 text-sm">No maintenance records</div>
          ) : (
            <div className="space-y-2">
              {history.maintenance_work_orders.slice(0, 5).map(mwo => (
                <div key={mwo.id} className="flex justify-between text-sm border-b pb-1">
                  <span className="font-mono">{mwo.mwo_number}</span>
                  <span className="text-gray-500">{mwo.maintenance_type}</span>
                  <Badge variant={mwo.status === 'completed' ? 'success' : 'warning'} className="text-xs">{mwo.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {history?.downtime_records && history.downtime_records.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b font-semibold">Recent Downtime</div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">Start</th>
                <th className="text-left py-3 px-4">Duration</th>
                <th className="text-left py-3 px-4">Root Cause</th>
              </tr>
            </thead>
            <tbody>
              {history.downtime_records.slice(0, 10).map(dt => (
                <tr key={dt.id}>
                  <td className="py-3 px-4"><Badge variant={dt.downtime_type === 'unplanned' ? 'danger' : 'warning'}>{dt.downtime_type}</Badge></td>
                  <td className="py-3 px-4 text-sm">{dt.category}</td>
                  <td className="py-3 px-4 text-sm">{formatDate(dt.start_time)}</td>
                  <td className="py-3 px-4 text-sm">{dt.duration_minutes ? `${dt.duration_minutes}min` : '—'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 max-w-xs truncate">{dt.root_cause || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Asset">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Status</label>
            <select
              className="mt-1 block w-full border rounded px-3 py-2 text-sm"
              value={editForm.status || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, status: e.target.value })}
            >
              {['active', 'inactive', 'under_maintenance', 'disposed'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <Input label="Location" value={editForm.location || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, location: e.target.value })} />
          <Input label="Notes" value={editForm.notes || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={updateAsset.isPending}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
