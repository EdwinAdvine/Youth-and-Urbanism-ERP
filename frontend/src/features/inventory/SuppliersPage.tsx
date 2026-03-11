import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  type Supplier,
  type CreateSupplierPayload,
} from '../../api/inventory'

const defaultForm: CreateSupplierPayload = {
  name: '',
  email: '',
  phone: '',
  address: '',
  contact_person: '',
  payment_terms: '',
  notes: '',
}

export default function SuppliersPage() {
  const [search, setSearch] = useState('')
  const { data: suppliers, isLoading } = useSuppliers({ search: search || undefined })
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()
  const deleteSupplier = useDeleteSupplier()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<CreateSupplierPayload>(defaultForm)

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({
      name: s.name,
      email: s.email ?? '',
      phone: s.phone ?? '',
      address: s.address ?? '',
      contact_person: s.contact_person ?? '',
      payment_terms: s.payment_terms ?? '',
      notes: s.notes ?? '',
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      updateSupplier.mutate(
        { id: editing.id, ...form },
        {
          onSuccess: () => { toast('success', 'Supplier updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update supplier'),
        }
      )
    } else {
      createSupplier.mutate(form, {
        onSuccess: () => { toast('success', 'Supplier created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create supplier'),
      })
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this supplier?')) return
    deleteSupplier.mutate(id, {
      onSuccess: () => toast('success', 'Supplier deleted'),
      onError: () => toast('error', 'Failed to delete supplier'),
    })
  }

  const columns = [
    {
      key: 'name',
      label: 'Supplier',
      render: (s: Supplier) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{s.name}</p>
          {s.contact_person && <p className="text-xs text-gray-400">Contact: {s.contact_person}</p>}
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (s: Supplier) => s.email ?? <span className="text-gray-400">-</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (s: Supplier) => s.phone ?? <span className="text-gray-400">-</span>,
    },
    {
      key: 'payment_terms',
      label: 'Payment Terms',
      render: (s: Supplier) => s.payment_terms ?? <span className="text-gray-400">-</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (s: Supplier) => (
        <Badge variant={s.is_active ? 'success' : 'default'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (s: Supplier) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(s.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your supplier directory</p>
        </div>
        <Button onClick={openCreate}>Add Supplier</Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={suppliers ?? []}
          keyExtractor={(s) => s.id}
          emptyText="No suppliers found. Add one to get started."
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email ?? ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <Input label="Phone" value={form.phone ?? ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <Input label="Contact Person" value={form.contact_person ?? ''} onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))} />
          <Input label="Address" value={form.address ?? ''} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          <Input label="Payment Terms" placeholder="e.g., Net 30, COD" value={form.payment_terms ?? ''} onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createSupplier.isPending || updateSupplier.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
