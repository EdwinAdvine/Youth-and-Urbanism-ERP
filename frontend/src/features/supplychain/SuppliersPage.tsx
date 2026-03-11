import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useSuppliers, useCreateSupplier, useDeleteSupplier,
  type Supplier, type CreateSupplierPayload,
} from '../../api/supplychain'
import apiClient from '../../api/client'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

async function handleExport(endpoint: string, filename: string) {
  try {
    const response = await apiClient.get(endpoint, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    toast('error', 'Export failed')
  }
}

interface SupplierFormState {
  name: string
  contact_name: string
  email: string
  phone: string
  address: string
  payment_terms: string
  payment_terms_days: string
  rating: string
  notes: string
}

const defaultForm: SupplierFormState = {
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  payment_terms: '',
  payment_terms_days: '30',
  rating: '',
  notes: '',
}

export default function SuppliersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierFormState>(defaultForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useSuppliers({
    search: search || undefined,
    skip,
    limit,
  })

  const createMutation = useCreateSupplier()
  const deleteMutation = useDeleteSupplier()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast('warning', 'Supplier name is required')
      return
    }
    const payload: CreateSupplierPayload = {
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      payment_terms: form.payment_terms.trim() || undefined,
      payment_terms_days: Number(form.payment_terms_days) || 30,
      rating: form.rating ? Number(form.rating) : undefined,
      notes: form.notes.trim() || undefined,
    }
    try {
      await createMutation.mutateAsync(payload)
      toast('success', 'Supplier created')
      setShowCreate(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to create supplier')
    }
  }

  const handleDelete = async (supplier: Supplier) => {
    try {
      await deleteMutation.mutateAsync(supplier.id)
      toast('success', 'Supplier deactivated')
      setConfirmDelete(null)
    } catch {
      toast('error', 'Failed to delete supplier')
    }
  }

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row: Supplier) => (
        <button
          className="text-[#51459d] font-medium hover:underline"
          onClick={() => navigate(`/supply-chain/suppliers/${row.id}`)}
        >
          {row.code}
        </button>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (row: Supplier) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'contact_name',
      label: 'Contact',
      render: (row: Supplier) => <span className="text-gray-600">{row.contact_name || '-'}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (row: Supplier) => <span className="text-gray-600">{row.email || '-'}</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (row: Supplier) => <span className="text-gray-600">{row.phone || '-'}</span>,
    },
    {
      key: 'payment_terms_days',
      label: 'Terms',
      render: (row: Supplier) => <span className="text-gray-600">{row.payment_terms_days} days</span>,
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (row: Supplier) => (
        row.rating ? (
          <span className="text-[#ffa21d] font-medium">{'★'.repeat(row.rating)}{'☆'.repeat(5 - row.rating)}</span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: Supplier) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: Supplier) => <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row: Supplier) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => navigate(`/supply-chain/suppliers/${row.id}`)}>
            View
          </Button>
          {row.is_active && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(row)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total suppliers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('/supply-chain/suppliers/export', 'suppliers.csv')}>
            Export CSV
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Supplier
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-72">
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <span className="text-sm text-gray-500">{data?.total ?? 0} suppliers</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<Supplier>
          columns={columns}
          data={data?.suppliers ?? []}
          loading={isLoading}
          emptyText="No suppliers found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Supplier" size="lg">
        <div className="space-y-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Supplier name"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Name"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              placeholder="Primary contact"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="supplier@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
            <Input
              label="Payment Terms Days"
              type="number"
              min="0"
              value={form.payment_terms_days}
              onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })}
            />
          </div>
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Full address"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Payment Terms"
              value={form.payment_terms}
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
              placeholder="e.g. Net 30, COD"
            />
            <Input
              label="Rating (1-5)"
              type="number"
              min="1"
              max="5"
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: e.target.value })}
              placeholder="1-5"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create Supplier
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Deactivate Supplier"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to deactivate <span className="font-semibold">{confirmDelete?.name}</span>?
            The supplier will be marked as inactive.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleteMutation.isPending}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
