import { useState } from 'react'
import { cn, Spinner, Badge, Card, Table } from '../../components/ui'
import { useTrialBalance, useCashFlowReport, type TrialBalanceRow } from '../../api/finance'

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
  const [activeTab, setActiveTab] = useState<'trial-balance' | 'cash-flow'>('trial-balance')
  const [cfFrom, setCfFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [cfTo, setCfTo] = useState(() => new Date().toISOString().slice(0, 10))

  const { data: trialBalance, isLoading } = useTrialBalance()
  const { data: cashFlow, isLoading: cfLoading } = useCashFlowReport(cfFrom, cfTo)

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

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border border-gray-200 rounded-[10px] w-fit overflow-hidden">
        <button
          onClick={() => setActiveTab('trial-balance')}
          className={cn('px-4 py-2 text-sm font-medium transition-colors', activeTab === 'trial-balance' ? 'bg-[#51459d] text-white' : 'text-gray-600 hover:bg-gray-50')}
        >
          Trial Balance
        </button>
        <button
          onClick={() => setActiveTab('cash-flow')}
          className={cn('px-4 py-2 text-sm font-medium transition-colors', activeTab === 'cash-flow' ? 'bg-[#51459d] text-white' : 'text-gray-600 hover:bg-gray-50')}
        >
          Cash Flow
        </button>
      </div>

      {activeTab === 'trial-balance' && (
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
      )}

      {activeTab === 'cash-flow' && (
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Cash Flow Report</h2>
            <p className="text-xs text-gray-500 mt-1">Operating, investing, and financing activities</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <input type="date" value={cfFrom} onChange={(e) => setCfFrom(e.target.value)} className="border border-gray-200 rounded-[8px] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#51459d]/40" />
            <label className="text-xs text-gray-500">To</label>
            <input type="date" value={cfTo} onChange={(e) => setCfTo(e.target.value)} className="border border-gray-200 rounded-[8px] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#51459d]/40" />
          </div>
        </div>

        {cfLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
        ) : !cashFlow ? (
          <div className="py-12 text-center text-gray-400 text-sm">No cash flow data available</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Operating Activities */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Operating Activities</h3>
              <table className="w-full text-sm">
                <tbody>
                  {(cashFlow.operating ?? []).map((item: { description: string; amount: number }, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">{item.description}</td>
                      <td className={cn('py-2 text-right font-medium', item.amount >= 0 ? 'text-gray-900' : 'text-[#ff3a6e]')}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-2 font-semibold text-gray-900">Total Operating</td>
                    <td className="py-2 text-right font-bold text-gray-900">{formatCurrency((cashFlow.operating ?? []).reduce((s: number, i: { amount: number }) => s + i.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Investing Activities */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Investing Activities</h3>
              <table className="w-full text-sm">
                <tbody>
                  {(cashFlow.investing ?? []).map((item: { description: string; amount: number }, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">{item.description}</td>
                      <td className={cn('py-2 text-right font-medium', item.amount >= 0 ? 'text-gray-900' : 'text-[#ff3a6e]')}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-2 font-semibold text-gray-900">Total Investing</td>
                    <td className="py-2 text-right font-bold text-gray-900">{formatCurrency((cashFlow.investing ?? []).reduce((s: number, i: { amount: number }) => s + i.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Financing Activities */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Financing Activities</h3>
              <table className="w-full text-sm">
                <tbody>
                  {(cashFlow.financing ?? []).map((item: { description: string; amount: number }, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">{item.description}</td>
                      <td className={cn('py-2 text-right font-medium', item.amount >= 0 ? 'text-gray-900' : 'text-[#ff3a6e]')}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-2 font-semibold text-gray-900">Total Financing</td>
                    <td className="py-2 text-right font-bold text-gray-900">{formatCurrency((cashFlow.financing ?? []).reduce((s: number, i: { amount: number }) => s + i.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Net Change */}
            <div className="p-5 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-gray-900">Net Change in Cash</span>
                <span className={cn('text-lg font-bold', (cashFlow.net_change ?? 0) >= 0 ? 'text-[#6fd943]' : 'text-[#ff3a6e]')}>
                  {formatCurrency(cashFlow.net_change ?? 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>
      )}
    </div>
  )
}
