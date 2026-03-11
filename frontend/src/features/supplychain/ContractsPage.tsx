import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useContracts,
  useCreateContract,
  useUpdateContract,
  useDeleteContract,
  type Contract,
  type CreateContractPayload,
} from '../../api/supplychain_ext'

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  draft: 'default',
  active: 'success',
  expired: 'warning',
  terminated: 'danger',
  renewed: 'info',
}

const emptyForm: CreateContractPayload = {
  supplier_id: '',
  title: '',
  description: '',
  contract_type: 'supply',
  start_date: '',
  end_date: '',
  total_value: undefined,
  currency: 'USD',
  payment_terms: '',
  auto_renew: false,
}

export default function ContractsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20
  const { data, isLoading, error } = useContracts({ status: statusFilter || undefined, skip: (page - 1) * limit, limit })
  const createContract = useCreateContract()
  const updateContract = useUpdateContract()
  const deleteContract = useDeleteContract()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [form, setForm] = useState<CreateContractPayload>(emptyForm)

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowModal(false) }

  const handleEdit = (c: Contract) => {
    setEditing(c)
    setForm({
      supplier_id: c.supplier_id,
      title: c.title,
      description: c.description || '',
      contract_type: c.contract_type,
      start_date: c.start_date.slice(0, 10),
      end_date: c.end_date.slice(0, 10),
      total_value: c.total_value || undefined,
      currency: c.currency,
      payment_terms: c.payment_terms || '',
      auto_renew: c.auto_renew,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateContract.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Contract updated')
      } else {
        await createContract.mutateAsync(form)
        toast('success', 'Contract created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save contract')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contract?')) return
    try {
      await deleteContract.mutateAsync(id)
      toast('success', 'Contract deleted')
    } catch {
      toast('error', 'Failed to delete contract')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load contracts</div>

  const columns = [
    { key: 'contract_number', label: 'Contract #', render: (r: Contract) => <span className="font-mono font-medium text-gray-900">{r.contract_number}</span> },
    { key: 'title', label: 'Title', render: (r: Contract) => <span className="font-medium text-gray-900">{r.title}</span> },
    { key: 'supplier', label: 'Supplier', render: (r: Contract) => <span className="text-sm">{r.supplier_name || r.supplier_id}</span> },
    { key: 'type', label: 'Type', render: (r: Contract) => <Badge variant="primary">{r.contract_type}</Badge> },
    { key: 'value', label: 'Value', render: (r: Contract) => <span className="text-sm font-medium">{r.total_value ? `${r.currency} ${r.total_value.toLocaleString()}` : '-'}</span> },
    { key: 'period', label: 'Period', render: (r: Contract) => <span className="text-xs text-gray-500">{new Date(r.start_date).toLocaleDateString()} - {new Date(r.end_date).toLocaleDateString()}</span> },
    { key: 'status', label: 'Status', render: (r: Contract) => <Badge variant={statusColors[r.status]}>{r.status}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (r: Contract) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage supplier contracts and agreements</p>
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            options={[{ value: '', label: 'All Status' }, { value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'expired', label: 'Expired' }]} />
          <Button onClick={() => { resetForm(); setShowModal(true) }}>New Contract</Button>
        </div>
      </div>

      <Card padding={false}>
        <Table columns={columns} data={data?.contracts ?? []} loading={isLoading} keyExtractor={(r) => r.id} emptyText="No contracts found" />
      </Card>

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Contract' : 'New Contract'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Supplier ID" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} required />
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-3 gap-4">
            <Select label="Type" value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value as 'supply' | 'service' | 'framework' })}
              options={[{ value: 'supply', label: 'Supply' }, { value: 'service', label: 'Service' }, { value: 'framework', label: 'Framework' }]} />
            <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            <Input label="End Date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Total Value" type="number" step="0.01" value={form.total_value ?? ''} onChange={(e) => setForm({ ...form, total_value: e.target.value ? parseFloat(e.target.value) : undefined })} />
            <Input label="Currency" value={form.currency || 'USD'} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            <Input label="Payment Terms" value={form.payment_terms || ''} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} placeholder="e.g. Net 30" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="auto-renew" checked={form.auto_renew} onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} className="rounded" />
            <label htmlFor="auto-renew" className="text-sm text-gray-700">Auto-renew</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createContract.isPending || updateContract.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
