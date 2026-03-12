import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Input, Modal, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { useECOs, useCreateECO, type ECO, type ECOCreate } from '../../api/manufacturing_eco'
import { useBOMs } from '../../api/manufacturing'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const statusColors: Record<string, BadgeVariant> = {
  draft: 'default',
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  implemented: 'primary',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ECOListPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ECOCreate>({ title: '', bom_id: '', change_type: 'revision', priority: 'medium' })

  const { data: ecos, isLoading } = useECOs(statusFilter ? { status: statusFilter } : undefined)
  const { data: boms } = useBOMs({ limit: 100 })
  const createECO = useCreateECO()

  const handleCreate = async () => {
    if (!form.title || !form.bom_id) return toast('error', 'Title and BOM are required')
    try {
      const eco = await createECO.mutateAsync(form)
      toast('success', `ECO ${eco.eco_number} created`)
      setModalOpen(false)
      setForm({ title: '', bom_id: '', change_type: 'revision', priority: 'medium' })
    } catch {
      toast('error', 'Failed to create ECO')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Engineering Change Orders</h1>
        <Button onClick={() => setModalOpen(true)}>+ New ECO</Button>
      </div>

      <div className="flex gap-3 items-center">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['draft', 'submitted', 'under_review', 'approved', 'rejected', 'implemented'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </Select>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-3 px-4">ECO #</th>
              <th className="text-left py-3 px-4">Title</th>
              <th className="text-left py-3 px-4">Change Type</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Priority</th>
              <th className="text-left py-3 px-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
            ) : ecos?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No ECOs found</td></tr>
            ) : ecos?.map((eco: ECO) => (
              <tr key={eco.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/manufacturing/eco/${eco.id}`)}>
                <td className="font-mono text-sm">{eco.eco_number}</td>
                <td>{eco.title}</td>
                <td className="capitalize">{eco.change_type}</td>
                <td><Badge variant={statusColors[eco.status] || 'default'}>{eco.status.replace('_', ' ')}</Badge></td>
                <td className="capitalize">{eco.priority}</td>
                <td>{formatDate(eco.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Engineering Change Order">
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="ECO title" />
          <Select label="BOM" value={form.bom_id} onChange={e => setForm({ ...form, bom_id: e.target.value })}>
            <option value="">Select BOM</option>
            {boms?.boms?.map((b: any) => <option key={b.id} value={b.id}>{b.bom_number} — {b.name}</option>)}
          </Select>
          <Select label="Change Type" value={form.change_type || 'revision'} onChange={e => setForm({ ...form, change_type: e.target.value })}>
            <option value="revision">Revision</option>
            <option value="new_version">New Version</option>
            <option value="obsolete">Obsolete</option>
          </Select>
          <Select label="Priority" value={form.priority || 'medium'} onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
          <Input label="Reason" value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Reason for change" />
          <Input label="Impact Analysis" value={form.impact_analysis || ''} onChange={e => setForm({ ...form, impact_analysis: e.target.value })} placeholder="Impact analysis" />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createECO.isPending}>Create ECO</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
