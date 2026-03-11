import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Input, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useBatchRecords, useCreateBatchRecord, useApproveBatchRecord, type BatchRecord, type BatchRecordCreate } from '../../api/manufacturing_trace'

const statusColors: Record<string, string> = { in_progress: 'blue', completed: 'yellow', reviewed: 'orange', approved: 'green' }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BatchRecordPage() {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<BatchRecordCreate>({ batch_number: '', work_order_id: '', bom_id: '' })
  const [approveId, setApproveId] = useState<string | null>(null)
  const [signature, setSignature] = useState('')

  const { data: records, isLoading } = useBatchRecords()
  const createRecord = useCreateBatchRecord()
  const approveRecord = useApproveBatchRecord()

  const handleCreate = async () => {
    if (!form.batch_number || !form.work_order_id || !form.bom_id) return toast({ title: 'All fields required', variant: 'destructive' })
    try {
      await createRecord.mutateAsync(form)
      toast({ title: 'Batch record created' })
      setModalOpen(false)
      setForm({ batch_number: '', work_order_id: '', bom_id: '' })
    } catch {
      toast({ title: 'Failed to create', variant: 'destructive' })
    }
  }

  const handleApprove = async () => {
    if (!approveId || !signature) return
    try {
      await approveRecord.mutateAsync({ recordId: approveId, electronic_signature: signature })
      toast({ title: 'Batch record approved' })
      setApproveId(null)
      setSignature('')
    } catch {
      toast({ title: 'Failed to approve', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Electronic Batch Records</h1>
        <Button onClick={() => setModalOpen(true)}>+ New Record</Button>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Batch #</th>
              <th>Status</th>
              <th>Work Order</th>
              <th>Approved By</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
            ) : records?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No batch records</td></tr>
            ) : records?.map((r: BatchRecord) => (
              <tr key={r.id}>
                <td className="font-mono text-sm font-medium">{r.batch_number}</td>
                <td><Badge variant={statusColors[r.status] || 'gray'}>{r.status.replace('_', ' ')}</Badge></td>
                <td className="text-xs">{r.work_order_id.slice(0, 8)}...</td>
                <td className="text-xs">{r.approved_by ? r.approved_by.slice(0, 8) + '...' : '—'}</td>
                <td>{formatDate(r.created_at)}</td>
                <td>
                  {(r.status === 'completed' || r.status === 'reviewed') && (
                    <Button size="sm" onClick={() => setApproveId(r.id)}>Approve</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Batch Record">
        <div className="space-y-4">
          <Input label="Batch Number" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} placeholder="BATCH-2026-001" />
          <Input label="Work Order ID" value={form.work_order_id} onChange={e => setForm({ ...form, work_order_id: e.target.value })} placeholder="Work Order UUID" />
          <Input label="BOM ID" value={form.bom_id} onChange={e => setForm({ ...form, bom_id: e.target.value })} placeholder="BOM UUID" />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createRecord.isPending}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!approveId} onClose={() => setApproveId(null)} title="Approve Batch Record">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Enter your electronic signature to approve this batch record.</p>
          <Input label="Electronic Signature" value={signature} onChange={e => setSignature(e.target.value)} placeholder="Your full name" />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setApproveId(null)}>Cancel</Button>
            <Button onClick={handleApprove} loading={approveRecord.isPending}>Approve</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
