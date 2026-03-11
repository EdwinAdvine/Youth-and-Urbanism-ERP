import { useState } from 'react'
import { Button, Card, Input, Spinner, Badge } from '../../components/ui'
import { useBalanceSheet } from '../../api/finance'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

interface SectionProps {
  title: string
  items: { account_id: string; account_code: string; account_name: string; balance: number }[]
  total: number
  color: string
}

function Section({ title, items, total, color }: SectionProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No {title.toLowerCase()} accounts with balances</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.account_id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400">{item.account_code}</span>
                <span className="text-sm text-gray-700">{item.account_name}</span>
              </div>
              <span className={`text-sm font-medium ${color}`}>{formatCurrency(item.balance)}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Total {title}</span>
            <span className={`text-base font-bold ${color}`}>{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function BalanceSheetPage() {
  const todayStr = new Date().toISOString().split('T')[0]
  const [asOf, setAsOf] = useState(todayStr)
  const [queryDate, setQueryDate] = useState(todayStr)

  const { data: report, isLoading } = useBalanceSheet(queryDate)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Balance Sheet</h1>
        <p className="text-sm text-gray-500 mt-1">Assets = Liabilities + Equity</p>
      </div>

      <Card>
        <div className="flex items-end gap-4">
          <Input label="As of Date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Button size="sm" onClick={() => setQueryDate(asOf)}>Generate</Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : report ? (
        <div className="space-y-6">
          <Section title="Assets" items={report.assets} total={report.total_assets} color="text-blue-600" />
          <Section title="Liabilities" items={report.liabilities} total={report.total_liabilities} color="text-red-600" />
          <Section title="Equity" items={report.equity} total={report.total_equity} color="text-purple-600" />

          {/* Summary */}
          <Card>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Total Assets</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(report.total_assets)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Total Liabilities + Equity</span>
                <span className="text-lg font-bold text-purple-600">{formatCurrency(report.total_liabilities_and_equity)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex items-center justify-center">
                {report.is_balanced ? (
                  <Badge variant="success">Balanced</Badge>
                ) : (
                  <Badge variant="danger">
                    Out of balance by {formatCurrency(Math.abs(report.total_assets - report.total_liabilities_and_equity))}
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
