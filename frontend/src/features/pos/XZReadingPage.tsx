import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Badge, Spinner, Table } from '../../components/ui'
import { useXReading, useZReading } from '../../api/pos'

type TabType = 'x' | 'z'

export default function XZReadingPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [activeTab, setActiveTab] = useState<TabType>('x')

  const { data: xReading, isLoading: xLoading } = useXReading(sessionId ?? '')
  const { data: zReading, isLoading: zLoading } = useZReading(sessionId ?? '')

  const reading = activeTab === 'x' ? xReading : zReading
  const loading = activeTab === 'x' ? xLoading : zLoading

  if (!sessionId) {
    return (
      <div className="text-center py-16 text-gray-400">
        No session ID provided
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fiscal Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          X/Z Readings for session {reading?.session_number ?? sessionId}
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800 w-fit">
        <TabButton
          active={activeTab === 'x'}
          onClick={() => setActiveTab('x')}
          label="X-Reading"
          subtitle="Mid-session snapshot"
        />
        <TabButton
          active={activeTab === 'z'}
          onClick={() => setActiveTab('z')}
          label="Z-Reading"
          subtitle="End-of-day close"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : !reading ? (
        <Card>
          <p className="text-center text-gray-400 py-8">
            {activeTab === 'x' ? 'X-Reading' : 'Z-Reading'} not available for this session
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Session info */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {activeTab === 'x' ? 'X-Reading' : 'Z-Reading'}
              </h3>
              <Badge variant={activeTab === 'x' ? 'info' : 'primary'}>
                {reading.reading_type.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoField label="Session" value={reading.session_number} />
              <InfoField label="Opened At" value={formatDate(reading.opened_at)} />
              <InfoField label="Closed At" value={reading.closed_at ? formatDate(reading.closed_at) : 'Still Open'} />
              <InfoField label="Generated At" value={formatDate(reading.generated_at)} />
            </div>
          </Card>

          {/* Sales summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Gross Sales" value={reading.gross_sales} color="text-gray-900 dark:text-gray-100" />
            <MetricCard label="Net Sales" value={reading.net_sales} color="text-[#51459d]" />
            <MetricCard label="Tax" value={reading.total_tax} color="text-gray-600" />
            <MetricCard label="Discounts" value={reading.total_discounts} color="text-[#ffa21d]" />
            <MetricCard label="Tips" value={reading.total_tips} color="text-[#6fd943]" />
            <MetricCard label="Refunds" value={reading.total_refunds} color="text-[#ff3a6e]" />
          </div>

          {/* Transaction counts */}
          {reading.transaction_counts && Object.keys(reading.transaction_counts).length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Transaction Counts
              </h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(reading.transaction_counts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{status}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Payment method breakdown */}
          {reading.payment_methods && Object.keys(reading.payment_methods).length > 0 && (
            <Card padding={false}>
              <div className="p-5 pb-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Payment Method Breakdown
                </h3>
              </div>
              <Table
                data={Object.entries(reading.payment_methods).map(([method, amount]) => ({
                  method,
                  amount,
                }))}
                keyExtractor={(row) => row.method}
                columns={[
                  {
                    key: 'method',
                    label: 'Payment Method',
                    render: (row) => (
                      <span className="font-medium capitalize text-gray-900 dark:text-gray-100">
                        {row.method.replace(/_/g, ' ')}
                      </span>
                    ),
                  },
                  {
                    key: 'amount',
                    label: 'Amount',
                    className: 'text-right',
                    render: (row) => (
                      <span className="font-semibold">${parseFloat(row.amount).toFixed(2)}</span>
                    ),
                  },
                ]}
              />
            </Card>
          )}

          {/* Cash movements */}
          {reading.cash_movements && Object.keys(reading.cash_movements).length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Cash Movements
              </h3>
              <div className="space-y-2">
                {Object.entries(reading.cash_movements).map(([type, amount]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700 last:border-0"
                  >
                    <span className="text-sm capitalize text-gray-600 dark:text-gray-400">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ${parseFloat(amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Cash drawer reconciliation */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Cash Drawer
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DrawerField
                label="Opening Balance"
                value={reading.opening_balance}
              />
              <DrawerField
                label="Expected Cash"
                value={reading.expected_cash_in_drawer}
              />
              <DrawerField
                label="Actual Cash"
                value={reading.actual_cash_in_drawer}
                fallback="Not counted"
              />
              <DrawerField
                label="Variance"
                value={reading.cash_variance}
                fallback="N/A"
                highlight
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  label,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  label: string
  subtitle: string
}) {
  return (
    <button
      className={`px-5 py-2.5 rounded-md text-sm transition-colors ${
        active
          ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
      onClick={onClick}
    >
      <span className="block font-medium">{label}</span>
      <span className="block text-xs opacity-60">{subtitle}</span>
    </button>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`}>
        ${parseFloat(value).toFixed(2)}
      </p>
    </Card>
  )
}

function DrawerField({
  label,
  value,
  fallback = '--',
  highlight = false,
}: {
  label: string
  value: string | null
  fallback?: string
  highlight?: boolean
}) {
  const numVal = value ? parseFloat(value) : null
  let textColor = 'text-gray-900 dark:text-gray-100'
  if (highlight && numVal !== null) {
    if (numVal > 0) textColor = 'text-[#6fd943]'
    else if (numVal < 0) textColor = 'text-[#ff3a6e]'
  }

  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${textColor}`}>
        {numVal !== null ? `$${numVal.toFixed(2)}` : fallback}
      </p>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
