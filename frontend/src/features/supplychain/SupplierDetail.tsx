import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  cn, Button, Spinner, Badge, Card, Table, Modal, Input, toast,
} from '../../components/ui'
import {
  useSupplier, useUpdateSupplier,
  useRequisitions, useGRNs, useReturns,
  type UpdateSupplierPayload,
  type GoodsReceivedNote, type SupplierReturn,
} from '../../api/supplychain'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  converted_to_po: 'primary',
  inspecting: 'warning',
  accepted: 'success',
  partial: 'warning',
  pending_approval: 'info',
  shipped: 'info',
  completed: 'success',
}

type TabId = 'info' | 'requisitions' | 'grns' | 'returns'

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('info')
  const [showEdit, setShowEdit] = useState(false)

  const { data: supplier, isLoading } = useSupplier(id ?? '')
  useRequisitions({ limit: 50 })
  const { data: grnsData, isLoading: grnsLoading } = useGRNs({ limit: 50 })
  const { data: returnsData, isLoading: returnsLoading } = useReturns({ limit: 50 })
  const updateMutation = useUpdateSupplier()

  const [editForm, setEditForm] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    payment_terms: '',
    payment_terms_days: '30',
    rating: '',
    notes: '',
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Supplier not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/supply-chain/suppliers')}>
          Back to Suppliers
        </Button>
      </div>
    )
  }

  const openEdit = () => {
    setEditForm({
      name: supplier.name,
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      payment_terms: supplier.payment_terms || '',
      payment_terms_days: String(supplier.payment_terms_days),
      rating: supplier.rating ? String(supplier.rating) : '',
      notes: supplier.notes || '',
    })
    setShowEdit(true)
  }

  const handleUpdate = async () => {
    if (!editForm.name.trim()) {
      toast('warning', 'Supplier name is required')
      return
    }
    const payload: UpdateSupplierPayload = {
      id: supplier.id,
      name: editForm.name.trim(),
      contact_name: editForm.contact_name.trim() || undefined,
      email: editForm.email.trim() || undefined,
      phone: editForm.phone.trim() || undefined,
      address: editForm.address.trim() || undefined,
      payment_terms: editForm.payment_terms.trim() || undefined,
      payment_terms_days: Number(editForm.payment_terms_days) || 30,
      rating: editForm.rating ? Number(editForm.rating) : undefined,
      notes: editForm.notes.trim() || undefined,
    }
    try {
      await updateMutation.mutateAsync(payload)
      toast('success', 'Supplier updated')
      setShowEdit(false)
    } catch {
      toast('error', 'Failed to update supplier')
    }
  }

  // Filter related records by supplier_id
  const supplierGRNs = grnsData?.grns?.filter((g) => g.supplier_id === supplier.id) ?? []
  const supplierReturns = returnsData?.returns?.filter((r) => r.supplier_id === supplier.id) ?? []

  const tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Information' },
    { id: 'requisitions', label: 'Requisitions' },
    { id: 'grns', label: 'GRNs' },
    { id: 'returns', label: 'Returns' },
  ]

  const grnColumns = [
    {
      key: 'grn_number',
      label: 'GRN #',
      render: (row: GoodsReceivedNote) => <span className="text-[#51459d] font-medium">{row.grn_number}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: GoodsReceivedNote) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>{row.status.replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      key: 'received_date',
      label: 'Received',
      render: (row: GoodsReceivedNote) => <span className="text-gray-500 text-xs">{formatDate(row.received_date)}</span>,
    },
  ]

  const returnColumns = [
    {
      key: 'return_number',
      label: 'Return #',
      render: (row: SupplierReturn) => <span className="text-[#51459d] font-medium">{row.return_number}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: SupplierReturn) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>{row.status.replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      key: 'total_value',
      label: 'Value',
      render: (row: SupplierReturn) => <span className="text-gray-700 dark:text-gray-300">{formatCurrency(row.total_value)}</span>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: SupplierReturn) => <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>,
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/supply-chain/suppliers')}
            className="p-2 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{supplier.name}</h1>
              <Badge variant={supplier.is_active ? 'success' : 'default'}>
                {supplier.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">{supplier.code}</p>
          </div>
        </div>
        <Button onClick={openEdit}>Edit Supplier</Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'text-[#51459d] border-[#51459d]'
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Contact Details</h2>
            <dl className="space-y-3">
              {[
                { label: 'Contact Name', value: supplier.contact_name },
                { label: 'Email', value: supplier.email },
                { label: 'Phone', value: supplier.phone },
                { label: 'Address', value: supplier.address },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{item.label}</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.value || '-'}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Payment & Rating</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Payment Terms</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{supplier.payment_terms || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Payment Terms Days</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{supplier.payment_terms_days} days</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Rating</dt>
                <dd className="text-sm font-medium text-[#ffa21d]">
                  {supplier.rating ? '★'.repeat(supplier.rating) + '☆'.repeat(5 - supplier.rating) : '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Tags</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {supplier.tags?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {supplier.tags.map((tag) => (
                        <Badge key={tag} variant="default">{tag}</Badge>
                      ))}
                    </div>
                  ) : '-'}
                </dd>
              </div>
            </dl>
          </Card>
          {supplier.notes && (
            <Card className="lg:col-span-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Notes</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{supplier.notes}</p>
            </Card>
          )}
          <Card className="lg:col-span-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Meta</h2>
            <dl className="flex gap-8">
              <div>
                <dt className="text-xs text-gray-500">Created</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300">{formatDate(supplier.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Updated</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300">{formatDate(supplier.updated_at)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'requisitions' && (
        <Card>
          <p className="text-sm text-gray-500 mb-4">
            Requisitions are linked to suppliers at the line-item level. View all requisitions from the main list.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/supply-chain/requisitions')}>
            Go to Requisitions
          </Button>
        </Card>
      )}

      {activeTab === 'grns' && (
        <Card padding={false}>
          <div className="p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Goods Received Notes ({supplierGRNs.length})
            </h2>
          </div>
          <Table<GoodsReceivedNote>
            columns={grnColumns}
            data={supplierGRNs}
            loading={grnsLoading}
            emptyText="No GRNs for this supplier"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      {activeTab === 'returns' && (
        <Card padding={false}>
          <div className="p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Supplier Returns ({supplierReturns.length})
            </h2>
          </div>
          <Table<SupplierReturn>
            columns={returnColumns}
            data={supplierReturns}
            loading={returnsLoading}
            emptyText="No returns for this supplier"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Supplier" size="lg">
        <div className="space-y-4">
          <Input
            label="Name *"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Name"
              value={editForm.contact_name}
              onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <Input
              label="Payment Terms Days"
              type="number"
              min="0"
              value={editForm.payment_terms_days}
              onChange={(e) => setEditForm({ ...editForm, payment_terms_days: e.target.value })}
            />
          </div>
          <Input
            label="Address"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Payment Terms"
              value={editForm.payment_terms}
              onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })}
            />
            <Input
              label="Rating (1-5)"
              type="number"
              min="1"
              max="5"
              value={editForm.rating}
              onChange={(e) => setEditForm({ ...editForm, rating: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdate} loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
