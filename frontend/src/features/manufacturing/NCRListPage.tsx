import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Input, Modal, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { useNCRs, useCreateNCR, type NCR, type NCRCreate } from '../../api/manufacturing_quality'

const severityColors: Record<string, string> = { minor: 'yellow', major: 'orange', critical: 'red' }
const statusColors: Record<string, string> = { open: 'red', investigating: 'blue', resolved: 'green', closed: 'gray' }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NCRListPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<NCRCreate>({ description: '', severity: 'major' })

  const { data: ncrs, isLoading } = useNCRs({
    ...(statusFilter && { status: statusFilter }),
    ...(severityFilter && { severity: severityFilter }),
  })
  const createNCR = useCreateNCR()

  const handleCreate = async () => {
    if (!form.description) return toast({ title: 'Description is required', variant: 'destructive' })
    try {
      const ncr = await createNCR.mutateAsync(form)
      toast({ title: `NCR ${ncr.ncr_number} created` })
      setModalOpen(false)
      setForm({ description: '', severity: 'major' })
    } catch {
      toast({ title: 'Failed to create NCR', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Non-Conformance Reports</h1>
        <Button onClick={() => setModalOpen(true)}>+ New NCR</Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['open', 'investigating', 'resolved', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
          <option value="">All Severities</option>
          {['minor', 'major', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>NCR #</th>
              <th>Description</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Qty Affected</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
            ) : ncrs?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No NCRs found</td></tr>
            ) : ncrs?.map((ncr: NCR) => (
              <tr key={ncr.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/manufacturing/ncr/${ncr.id}`)}>
                <td className="font-mono text-sm">{ncr.ncr_number}</td>
                <td className="max-w-xs truncate">{ncr.description}</td>
                <td><Badge variant={severityColors[ncr.severity] || 'gray'}>{ncr.severity}</Badge></td>
                <td><Badge variant={statusColors[ncr.status] || 'gray'}>{ncr.status}</Badge></td>
                <td>{ncr.quantity_affected}</td>
                <td>{formatDate(ncr.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Non-Conformance Report">
        <div className="space-y-4">
          <Input label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the non-conformance" />
          <Select label="Severity" value={form.severity || 'major'} onChange={e => setForm({ ...form, severity: e.target.value })}>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </Select>
          <Input label="Quantity Affected" type="number" value={String(form.quantity_affected || 0)} onChange={e => setForm({ ...form, quantity_affected: Number(e.target.value) })} />
          <Input label="Work Order ID" value={form.work_order_id || ''} onChange={e => setForm({ ...form, work_order_id: e.target.value || undefined })} placeholder="Optional WO UUID" />
          <Input label="Supplier ID" value={form.supplier_id || ''} onChange={e => setForm({ ...form, supplier_id: e.target.value || undefined })} placeholder="Optional Supplier UUID" />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createNCR.isPending}>Create NCR</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
