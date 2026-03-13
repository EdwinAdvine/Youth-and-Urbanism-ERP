import React, { useState } from 'react'
import { Button, Spinner, Modal, Input, Card, Table, Pagination, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { usePayments, useCreatePayment, type Payment, type CreatePaymentPayload } from '../../api/finance'
import { useSearchParams, useNavigate } from 'react-router-dom'

const METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'other', label: 'Other' },
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function PaymentsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [page, setPage] = useState(1)
  const limit = 10
  const { data, isLoading } = usePayments({ page, limit })
  const createPayment = useCreatePayment()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CreatePaymentPayload>({
    amount: 0,
    payment_method: 'bank_transfer',
    reference: '',
    invoice_id: null,
    payment_date: new Date().toISOString().split('T')[0],
  })

  // Open modal if navigated with ?action=new
  React.useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setModalOpen(true)
      navigate('/finance/payments', { replace: true })
    }
  }, [searchParams, navigate])

  function resetForm() {
    setForm({
      amount: 0,
      payment_method: 'bank_transfer',
      reference: '',
      invoice_id: null,
      payment_date: new Date().toISOString().split('T')[0],
    })
  }

  async function handleCreate() {
    if (form.amount <= 0) {
      toast('warning', 'Amount must be greater than zero')
      return
    }
    try {
      await createPayment.mutateAsync({
        ...form,
        invoice_id: form.invoice_id || null,
      })
      toast('success', 'Payment recorded')
      resetForm()
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to record payment')
    }
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const columns = [
    {
      key: 'payment_date',
      label: 'Date',
      render: (row: Payment) =>
        new Date(row.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: Payment) => <span className="font-medium text-green-700">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'payment_method',
      label: 'Method',
      render: (row: Payment) => (
        <span className="capitalize">{row.payment_method.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'invoice_id',
      label: 'Invoice',
      render: (row: Payment) =>
        row.invoice_id ? (
          <span className="text-primary">{row.invoice_id}</span>
        ) : (
          <span className="text-gray-400">--</span>
        ),
    },
    { key: 'reference', label: 'Reference' },
    { key: 'status', label: 'Status' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Track and record payments</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Record Payment
        </Button>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <Table<Payment>
            columns={columns}
            data={data?.items ?? []}
            loading={isLoading}
            emptyText="No payments recorded"
            keyExtractor={(row) => row.id}
          />
        </div>
        <Pagination
          page={page}
          pages={totalPages}
          total={data?.total ?? 0}
          onChange={setPage}
        />
      </Card>

      {/* Record Payment Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm() }} title="Record Payment" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              value={String(form.amount)}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              placeholder="0.00"
              min={0}
              step={0.01}
              autoFocus
            />
            <Select
              label="Payment Method"
              options={METHOD_OPTIONS}
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            />
          </div>
          <Input
            label="Payment Date"
            type="date"
            value={form.payment_date ?? ''}
            onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
          />
          <Input
            label="Invoice ID (optional)"
            value={form.invoice_id ?? ''}
            onChange={(e) => setForm({ ...form, invoice_id: e.target.value || null })}
            placeholder="Link to an invoice ID"
          />
          <Input
            label="Reference"
            value={form.reference ?? ''}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="e.g. Bank transaction ref"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setModalOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} loading={createPayment.isPending}>
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
