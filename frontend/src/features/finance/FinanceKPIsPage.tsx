import { useState } from 'react'
import {
  cn,
  Button,
  Input,
  Card,
  Spinner,
} from '../../components/ui'
import { useFinanceKPIs } from '../../api/finance'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPct(pct: number) {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

function getFirstDayOfMonth() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string
  value: string
  change: number
  subtitle?: string
  colorClass?: string
}

function KPICard({ label, value, change, subtitle, colorClass = 'text-gray-900 dark:text-gray-100' }: KPICardProps) {
  const isPositive = change >= 0
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={cn('text-2xl font-bold mt-1', colorClass)}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
          isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-danger'
        )}>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isPositive ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            )}
          </svg>
          {formatPct(change)}
        </div>
      </div>

      {/* Mini sparkline placeholder bar */}
      <div className="mt-4 h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isPositive ? 'bg-green-400' : 'bg-red-400'
          )}
          style={{ width: `${Math.min(Math.abs(change) * 2, 100)}%` }}
        />
      </div>
    </Card>
  )
}

// ─── Ratio Card ──────────────────────────────────────────────────────────────

function RatioCard({ label, value, description }: { label: string; value: number; description: string }) {
  const color = value >= 1.5 ? 'text-green-700' : value >= 1 ? 'text-amber-600' : 'text-danger'
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={cn('text-3xl font-bold mt-1', color)}>{value.toFixed(2)}</p>
      <p className="text-xs text-gray-400 mt-2">{description}</p>
      <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            value >= 1.5 ? 'bg-green-400' : value >= 1 ? 'bg-amber-400' : 'bg-red-400'
          )}
          style={{ width: `${Math.min(value * 33, 100)}%` }}
        />
      </div>
    </Card>
  )
}

// ─── FinanceKPIsPage ─────────────────────────────────────────────────────────

export default function FinanceKPIsPage() {
  const [fromDate, setFromDate] = useState(getFirstDayOfMonth())
  const [toDate, setToDate] = useState(getToday())

  const { data, isLoading, error } = useFinanceKPIs(fromDate, toDate)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Finance KPIs</h1>
          <p className="text-sm text-gray-500 mt-1">Key performance indicators and financial health metrics</p>
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
        <p className="text-sm text-danger py-4">Failed to load KPIs.</p>
      ) : data ? (
        <div className="space-y-6">
          {/* Primary KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Revenue"
              value={formatCurrency(data.revenue)}
              change={data.revenue_change_pct}
              subtitle={`Previous: ${formatCurrency(data.revenue_prev_period)}`}
              colorClass="text-green-700"
            />
            <KPICard
              label="Expenses"
              value={formatCurrency(data.expenses)}
              change={data.expenses_change_pct}
              subtitle={`Previous: ${formatCurrency(data.expenses_prev_period)}`}
              colorClass="text-danger"
            />
            <KPICard
              label="Profit"
              value={formatCurrency(data.profit)}
              change={data.profit_change_pct}
              subtitle={`Previous: ${formatCurrency(data.profit_prev_period)}`}
              colorClass={data.profit >= 0 ? 'text-green-700' : 'text-danger'}
            />
            <KPICard
              label="Cash Position"
              value={formatCurrency(data.cash_position)}
              change={data.cash_position_change_pct}
              subtitle={`Previous: ${formatCurrency(data.cash_position_prev_period)}`}
              colorClass="text-primary"
            />
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <p className="text-sm text-gray-500">Accounts Receivable</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(data.accounts_receivable)}</p>
              <p className="text-xs text-gray-400 mt-1">Money owed to you</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Accounts Payable</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(data.accounts_payable)}</p>
              <p className="text-xs text-gray-400 mt-1">Money you owe</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Gross Margin</p>
              <p className={cn(
                'text-2xl font-bold mt-1',
                data.gross_margin_pct >= 30 ? 'text-green-700' : data.gross_margin_pct >= 15 ? 'text-amber-600' : 'text-danger'
              )}>
                {data.gross_margin_pct.toFixed(1)}%
              </p>
              <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    data.gross_margin_pct >= 30 ? 'bg-green-400' : data.gross_margin_pct >= 15 ? 'bg-amber-400' : 'bg-red-400'
                  )}
                  style={{ width: `${Math.min(data.gross_margin_pct, 100)}%` }}
                />
              </div>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Net Margin</p>
              <p className={cn(
                'text-2xl font-bold mt-1',
                data.net_margin_pct >= 20 ? 'text-green-700' : data.net_margin_pct >= 10 ? 'text-amber-600' : 'text-danger'
              )}>
                {data.net_margin_pct.toFixed(1)}%
              </p>
              <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    data.net_margin_pct >= 20 ? 'bg-green-400' : data.net_margin_pct >= 10 ? 'bg-amber-400' : 'bg-red-400'
                  )}
                  style={{ width: `${Math.min(Math.max(data.net_margin_pct, 0), 100)}%` }}
                />
              </div>
            </Card>
          </div>

          {/* Financial ratios */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Financial Ratios</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <RatioCard
                label="Current Ratio"
                value={data.current_ratio}
                description="Current assets / current liabilities. Above 1.5 is healthy."
              />
              <RatioCard
                label="Quick Ratio"
                value={data.quick_ratio}
                description="(Current assets - inventory) / current liabilities. Above 1.0 is healthy."
              />
            </div>
          </div>

          {/* P&L Summary Bar */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Profit & Loss Summary</h3>
            <div className="space-y-3">
              {/* Revenue bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Revenue</span>
                  <span className="font-medium text-green-700">{formatCurrency(data.revenue)}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              {/* Expenses bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Expenses</span>
                  <span className="font-medium text-danger">{formatCurrency(data.expenses)}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full"
                    style={{ width: `${data.revenue > 0 ? (data.expenses / data.revenue) * 100 : 0}%` }}
                  />
                </div>
              </div>
              {/* Profit bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Net Profit</span>
                  <span className={cn('font-bold', data.profit >= 0 ? 'text-green-700' : 'text-danger')}>
                    {formatCurrency(data.profit)}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', data.profit >= 0 ? 'bg-green-500' : 'bg-red-500')}
                    style={{ width: `${data.revenue > 0 ? Math.abs(data.profit / data.revenue) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-4">Select a date range to view KPIs.</p>
      )}
    </div>
  )
}
