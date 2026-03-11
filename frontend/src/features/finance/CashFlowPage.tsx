import { useState } from 'react'
import {
  cn,
  Button,
  Input,
  Card,
  Spinner,
  toast,
} from '../../components/ui'
import {
  useCashFlowReport,
  type CashFlowReport,
} from '../../api/finance'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function getFirstDayOfMonth() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

// ─── Section Component ───────────────────────────────────────────────────────

interface SectionProps {
  title: string
  items: { description: string; amount: number }[]
  total: number
  colorClass: string
}

function CashFlowSection({ title, items, total, colorClass }: SectionProps) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No activity in this period</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-sm text-gray-700">{item.description}</span>
              <span className={cn('text-sm font-medium', item.amount >= 0 ? 'text-green-700' : 'text-danger')}>
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className={cn('mt-4 pt-3 border-t-2 flex items-center justify-between', colorClass)}>
        <span className="font-semibold text-gray-900">Total {title}</span>
        <span className={cn('text-lg font-bold', total >= 0 ? 'text-green-700' : 'text-danger')}>
          {formatCurrency(total)}
        </span>
      </div>
    </Card>
  )
}

// ─── CashFlowPage ────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const [fromDate, setFromDate] = useState(getFirstDayOfMonth())
  const [toDate, setToDate] = useState(getToday())

  const { data, isLoading, error } = useCashFlowReport(fromDate, toDate)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash Flow Statement</h1>
          <p className="text-sm text-gray-500 mt-1">Operating, investing, and financing cash flows</p>
        </div>
      </div>

      {/* Date range selector */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="w-44">
          <Input
            label="From"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Input
            label="To"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setFromDate(getFirstDayOfMonth())
            setToDate(getToday())
          }}
        >
          This Month
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const now = new Date()
            setFromDate(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0])
            setToDate(getToday())
          }}
        >
          Year to Date
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger py-4">Failed to load cash flow report.</p>
      ) : data ? (
        <div className="space-y-6">
          {/* Three sections */}
          <CashFlowSection
            title="Operating Activities"
            items={data.operating}
            total={data.total_operating}
            colorClass="border-blue-200"
          />

          <CashFlowSection
            title="Investing Activities"
            items={data.investing}
            total={data.total_investing}
            colorClass="border-amber-200"
          />

          <CashFlowSection
            title="Financing Activities"
            items={data.financing}
            total={data.total_financing}
            colorClass="border-purple-200"
          />

          {/* Net Cash Change */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Net Cash Change</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {fromDate} to {toDate}
                </p>
              </div>
              <span className={cn(
                'text-3xl font-bold',
                data.net_change >= 0 ? 'text-green-700' : 'text-danger'
              )}>
                {formatCurrency(data.net_change)}
              </span>
            </div>

            {/* Breakdown bar */}
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-blue-50 rounded-[10px]">
                <p className="text-xs text-gray-500">Operating</p>
                <p className={cn('text-lg font-bold', data.total_operating >= 0 ? 'text-green-700' : 'text-danger')}>
                  {formatCurrency(data.total_operating)}
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-[10px]">
                <p className="text-xs text-gray-500">Investing</p>
                <p className={cn('text-lg font-bold', data.total_investing >= 0 ? 'text-green-700' : 'text-danger')}>
                  {formatCurrency(data.total_investing)}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-[10px]">
                <p className="text-xs text-gray-500">Financing</p>
                <p className={cn('text-lg font-bold', data.total_financing >= 0 ? 'text-green-700' : 'text-danger')}>
                  {formatCurrency(data.total_financing)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-4">Select a date range to view the cash flow statement.</p>
      )}
    </div>
  )
}
