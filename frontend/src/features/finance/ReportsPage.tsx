import { cn, Spinner, Badge, Card, Table } from '../../components/ui'
import { useTrialBalance, type TrialBalanceRow } from '../../api/finance'

const TYPE_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  asset: 'info',
  liability: 'danger',
  equity: 'primary',
  revenue: 'success',
  expense: 'warning',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function ReportsPage() {
  const { data: trialBalance, isLoading } = useTrialBalance()

  const totalDebits = (trialBalance ?? []).reduce((sum, row) => sum + row.debit_total, 0)
  const totalCredits = (trialBalance ?? []).reduce((sum, row) => sum + row.credit_total, 0)

  const columns = [
    {
      key: 'account_code',
      label: 'Code',
      className: 'w-24',
    },
    {
      key: 'account_name',
      label: 'Account Name',
    },
    {
      key: 'account_type',
      label: 'Type',
      render: (row: TrialBalanceRow) => (
        <Badge variant={TYPE_BADGE[row.account_type] ?? 'default'}>{row.account_type}</Badge>
      ),
    },
    {
      key: 'debit_total',
      label: 'Debit',
      className: 'text-right',
      render: (row: TrialBalanceRow) => (
        <span className={cn('font-medium', row.debit_total > 0 ? 'text-gray-900' : 'text-gray-400')}>
          {formatCurrency(row.debit_total)}
        </span>
      ),
    },
    {
      key: 'credit_total',
      label: 'Credit',
      className: 'text-right',
      render: (row: TrialBalanceRow) => (
        <span className={cn('font-medium', row.credit_total > 0 ? 'text-gray-900' : 'text-gray-400')}>
          {formatCurrency(row.credit_total)}
        </span>
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Financial reports and summaries</p>
      </div>

      {/* Trial Balance */}
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Trial Balance</h2>
          <p className="text-xs text-gray-500 mt-1">Summary of all account balances</p>
        </div>

        <Table<TrialBalanceRow>
          columns={columns}
          data={trialBalance ?? []}
          loading={isLoading}
          emptyText="No data available"
          keyExtractor={(row) => row.account_id}
        />

        {/* Summary Totals */}
        {(trialBalance ?? []).length > 0 && (
          <div className="border-t-2 border-gray-200 px-4 py-3">
            <div className="flex items-center">
              <div className="flex-1" />
              <div className="flex-1" />
              <div className="flex-1" />
              <div className={cn('w-32 text-right pr-4')}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Debits</p>
                <p className="text-base font-bold text-gray-900">{formatCurrency(totalDebits)}</p>
              </div>
              <div className={cn('w-32 text-right pr-4')}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Credits</p>
                <p className="text-base font-bold text-gray-900">{formatCurrency(totalCredits)}</p>
              </div>
            </div>
            {Math.abs(totalDebits - totalCredits) < 0.01 ? (
              <div className="mt-2 text-center">
                <Badge variant="success">Balanced</Badge>
              </div>
            ) : (
              <div className="mt-2 text-center">
                <Badge variant="danger">
                  Out of balance by {formatCurrency(Math.abs(totalDebits - totalCredits))}
                </Badge>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
