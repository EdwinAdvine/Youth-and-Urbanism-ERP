import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Spinner, Badge, Card, Table, Select, Pagination } from '../../components/ui'
import { toast } from '../../components/ui'
import { useInvoices, type Invoice } from '../../api/finance'
import apiClient from '../../api/client'

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'danger' | 'warning'> = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'warning',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
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

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const limit = 10

  const { data, isLoading } = useInvoices({
    page,
    limit,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  })

  // If navigated with ?action=new, redirect to invoice detail for creation
  React.useEffect(() => {
    if (searchParams.get('action') === 'new') {
      navigate('/finance/invoices/new', { replace: true })
    }
  }, [searchParams, navigate])

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (row: Invoice) => (
        <button
          onClick={() => navigate(`/finance/invoices/${row.id}`)}
          className="text-primary font-medium hover:underline"
        >
          {row.invoice_number}
        </button>
      ),
    },
    { key: 'customer_name', label: 'Customer' },
    {
      key: 'invoice_type',
      label: 'Type',
      render: (row: Invoice) => (
        <Badge variant={row.invoice_type === 'sales' ? 'primary' : 'info'}>{row.invoice_type}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Invoice) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>{row.status}</Badge>
      ),
    },
    {
      key: 'total',
      label: 'Amount',
      render: (row: Invoice) => <span className="font-medium">{formatCurrency(row.total)}</span>,
    },
    {
      key: 'issue_date',
      label: 'Issue Date',
      render: (row: Invoice) =>
        new Date(row.issue_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (row: Invoice) =>
        new Date(row.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Manage sales and purchase invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('/finance/invoices/export', 'invoices.csv')}>
            Export CSV
          </Button>
          <Button onClick={() => navigate('/finance/invoices/new')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Invoice
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-40">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          />
        </div>
        <div className="w-40">
          <Select
            options={TYPE_OPTIONS}
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          />
        </div>
        <span className="text-sm text-gray-500">{data?.total ?? 0} invoices</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <Table<Invoice>
            columns={columns}
            data={data?.items ?? []}
            loading={isLoading}
            emptyText="No invoices found"
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
    </div>
  )
}
