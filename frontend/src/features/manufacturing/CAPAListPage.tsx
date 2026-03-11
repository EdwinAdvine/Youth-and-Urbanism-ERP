import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Input, Modal, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { useCAPAs, useCreateCAPA, type CAPA, type CAPACreate } from '../../api/manufacturing_quality'

const statusColors: Record<string, string> = { open: 'red', in_progress: 'blue', verification: 'yellow', closed: 'green' }

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CAPAListPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CAPACreate>({ description: '', capa_type: 'corrective', priority: 'medium' })

  const { data: capas, isLoading } = useCAPAs(statusFilter ? { status: statusFilter } : undefined)
  const createCAPA = useCreateCAPA()

  const handleCreate = async () => {
    if (!form.description) return toast({ title: 'Description is required', variant: 'destructive' })
    try {
      const capa = await createCAPA.mutateAsync(form)
      toast({ title: `CAPA ${capa.capa_number} created` })
      setModalOpen(false)
      setForm({ description: '', capa_type: 'corrective', priority: 'medium' })
    } catch {
      toast({ title: 'Failed to create CAPA', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Corrective & Preventive Actions</h1>
        <Button onClick={() => setModalOpen(true)}>+ New CAPA</Button>
      </div>

      <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
        <option value="">All Statuses</option>
        {['open', 'in_progress', 'verification', 'closed'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </Select>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>CAPA #</th>
              <th>Type</th>
              <th>Description</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Due Date</th>
              <th>Verified</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>
            ) : capas?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">No CAPAs found</td></tr>
            ) : capas?.map((capa: CAPA) => (
              <tr key={capa.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/manufacturing/capa/${capa.id}`)}>
                <td className="font-mono text-sm">{capa.capa_number}</td>
                <td className="capitalize">{capa.capa_type}</td>
                <td className="max-w-xs truncate">{capa.description}</td>
                <td><Badge variant={statusColors[capa.status] || 'gray'}>{capa.status.replace('_', ' ')}</Badge></td>
                <td className="capitalize">{capa.priority}</td>
                <td>{formatDate(capa.due_date)}</td>
                <td>{capa.effectiveness_verified ? <Badge variant="green">Yes</Badge> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create CAPA">
        <div className="space-y-4">
          <Input label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the corrective/preventive action" />
          <Select label="Type" value={form.capa_type || 'corrective'} onChange={e => setForm({ ...form, capa_type: e.target.value })}>
            <option value="corrective">Corrective</option>
            <option value="preventive">Preventive</option>
          </Select>
          <Select label="Priority" value={form.priority || 'medium'} onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
          <Input label="Due Date" type="date" value={form.due_date || ''} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          <Input label="NCR ID" value={form.ncr_id || ''} onChange={e => setForm({ ...form, ncr_id: e.target.value || undefined })} placeholder="Optional linked NCR UUID" />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createCAPA.isPending}>Create CAPA</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
