import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table } from '../../components/ui'
import { useFinanceStats, useInvoices, type Invoice } from '../../api/finance'

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'danger'> = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'default',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function FinanceDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useFinanceStats()
  const { data: recentInvoices, isLoading: invoicesLoading } = useInvoices({ page: 1, limit: 5 })

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Revenue MTD',
      value: formatCurrency(stats?.revenue_mtd ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Outstanding Invoices',
      value: `${stats?.outstanding_invoices_count ?? 0} (${formatCurrency(stats?.outstanding_invoices_amount ?? 0)})`,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'text-orange-600 bg-orange-50',
    },
    {
      label: 'Payments Today',
      value: formatCurrency(stats?.payments_today ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'text-cyan-600 bg-cyan-50',
    },
    {
      label: 'Total Invoices',
      value: String(stats?.total_invoices ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      color: 'text-primary bg-primary/10',
    },
  ]

  const invoiceColumns = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'customer_name', label: 'Customer' },
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
      key: 'due_date',
      label: 'Due Date',
      render: (row: Invoice) =>
        new Date(row.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500 mt-1">Financial overview and quick actions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/finance/invoices?action=new')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Invoice
          </Button>
          <Button variant="outline" onClick={() => navigate('/finance/payments?action=new')}>
            Record Payment
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-start gap-4">
              <div className={cn('p-3 rounded-[10px]', stat.color)}>
                {stat.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1 truncate">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Invoices */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900">Recent Invoices</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/finance/invoices')}>
            View All
          </Button>
        </div>
        <Table<Invoice>
          columns={invoiceColumns}
          data={recentInvoices?.items ?? []}
          loading={invoicesLoading}
          emptyText="No invoices yet"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
        {[
          { label: 'Accounts', path: '/finance/accounts', desc: 'Chart of accounts' },
          { label: 'Invoices', path: '/finance/invoices', desc: 'Sales & purchase invoices' },
          { label: 'Journal', path: '/finance/journal', desc: 'Journal entries' },
          { label: 'Reports', path: '/finance/reports', desc: 'Trial balance & reports' },
        ].map((item) => (
          <Card key={item.path} className="cursor-pointer hover:shadow-md transition-shadow" padding>
            <div onClick={() => navigate(item.path)}>
              <h3 className="text-sm font-semibold text-gray-900">{item.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
