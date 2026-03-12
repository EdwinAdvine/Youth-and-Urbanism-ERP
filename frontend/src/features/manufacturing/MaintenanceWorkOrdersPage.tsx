import { useState } from 'react'
import { Button, Badge, Card, Modal, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { useMaintenanceWorkOrders, useCreateMWO, useCompleteMWO, type MWOCreate } from '../../api/manufacturing_equipment'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const statusColors: Record<string, BadgeVariant> = { open: 'warning', in_progress: 'info', completed: 'success', cancelled: 'default' }
const typeColors: Record<string, BadgeVariant> = { preventive: 'info', corrective: 'danger', predictive: 'primary', emergency: 'danger' }

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MaintenanceWorkOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [completeId, setCompleteId] = useState<string | null>(null)
  const [form, setForm] = useState<MWOCreate>({ asset_id: '', maintenance_type: 'preventive', description: '' })
  const [completeNotes, setCompleteNotes] = useState('')

  const { data: mwos, isLoading } = useMaintenanceWorkOrders(statusFilter || undefined)
  const createMWO = useCreateMWO()
  const completeMWO = useCompleteMWO()

  const handleCreate = async () => {
    if (!form.asset_id || !form.description) return toast('error', 'Asset ID and description required')
    try {
      await createMWO.mutateAsync(form)
      toast('success', 'Maintenance work order created')
      setCreateOpen(false)
      setForm({ asset_id: '', maintenance_type: 'preventive', description: '' })
    } catch {
      toast('error', 'Failed to create')
    }
  }

  const handleComplete = async () => {
    if (!completeId) return
    try {
      await completeMWO.mutateAsync({ id: completeId, completion_notes: completeNotes || undefined })
      toast('success', 'MWO completed')
      setCompleteId(null)
      setCompleteNotes('')
    } catch {
      toast('error', 'Failed to complete')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Maintenance Work Orders</h1>
        <Button onClick={() => setCreateOpen(true)}>+ Create MWO</Button>
      </div>

      <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-48">
        <option value="">All Statuses</option>
        {['open', 'in_progress', 'completed', 'cancelled'].map(s => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </Select>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-3 px-4">MWO #</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Priority</th>
              <th className="text-left py-3 px-4">Planned Date</th>
              <th className="text-left py-3 px-4">Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>
            ) : mwos?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">No maintenance work orders</td></tr>
            ) : mwos?.map(mwo => (
              <tr key={mwo.id}>
                <td className="font-mono text-sm font-medium">{mwo.mwo_number}</td>
                <td><Badge variant={typeColors[mwo.maintenance_type] || 'default'}>{mwo.maintenance_type}</Badge></td>
                <td><Badge variant={statusColors[mwo.status] || 'default'}>{mwo.status.replace('_', ' ')}</Badge></td>
                <td className={`text-sm font-medium ${mwo.priority === 'high' ? 'text-red-600' : mwo.priority === 'low' ? 'text-gray-400' : ''}`}>
                  {mwo.priority}
                </td>
                <td className="text-sm">{formatDate(mwo.planned_date)}</td>
                <td className="text-sm text-gray-600 max-w-xs truncate">{mwo.description}</td>
                <td>
                  {(mwo.status === 'open' || mwo.status === 'in_progress') && (
                    <Button size="sm" onClick={() => setCompleteId(mwo.id)}>Complete</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Maintenance Work Order">
        <div className="space-y-4">
          <Input label="Asset ID" value={form.asset_id} onChange={e => setForm({ ...form, asset_id: e.target.value })} placeholder="Asset UUID" />
          <div>
            <label className="text-sm font-medium">Type</label>
            <select className="mt-1 block w-full border rounded px-3 py-2 text-sm" value={form.maintenance_type} onChange={e => setForm({ ...form, maintenance_type: e.target.value })}>
              {['preventive', 'corrective', 'predictive', 'emergency'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Priority</label>
            <select className="mt-1 block w-full border rounded px-3 py-2 text-sm" value={form.priority || 'medium'} onChange={e => setForm({ ...form, priority: e.target.value })}>
              {['low', 'medium', 'high'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Input label="Planned Date" type="date" value={form.planned_date || ''} onChange={e => setForm({ ...form, planned_date: e.target.value })} />
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea className="mt-1 block w-full border rounded px-3 py-2 text-sm" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMWO.isPending}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!completeId} onClose={() => setCompleteId(null)} title="Complete MWO">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Mark this maintenance work order as completed.</p>
          <div>
            <label className="text-sm font-medium">Completion Notes</label>
            <textarea className="mt-1 block w-full border rounded px-3 py-2 text-sm" rows={3} value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} placeholder="What was done..." />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setCompleteId(null)}>Cancel</Button>
            <Button onClick={handleComplete} loading={completeMWO.isPending}>Mark Complete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
