import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Badge, Select, Input, Spinner } from '../../components/ui'
import apiClient from '@/api/client'

interface FreightCost {
  id: string
  transport_order_reference: string
  transport_order_id: string
  cost_type: string
  amount: number
  currency: string
  is_invoiced: boolean
  invoice_number: string | null
  notes: string | null
}

interface GroupedCosts {
  transport_order_reference: string
  transport_order_id: string
  costs: FreightCost[]
  total: number
}

const costTypeColors: Record<string, string> = {
  freight: 'text-primary',
  fuel_surcharge: 'text-warning',
  handling: 'text-info',
  customs: 'text-danger',
  insurance: 'text-success',
}

function groupByOrder(costs: FreightCost[]): GroupedCosts[] {
  const map = new Map<string, GroupedCosts>()
  for (const c of costs) {
    const key = c.transport_order_id
    if (!map.has(key)) {
      map.set(key, {
        transport_order_id: key,
        transport_order_reference: c.transport_order_reference,
        costs: [],
        total: 0,
      })
    }
    const group = map.get(key)!
    group.costs.push(c)
    group.total += c.amount
  }
  return Array.from(map.values())
}

export default function FreightAuditPage() {
  const [invoicedFilter, setInvoicedFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sc', 'freight-costs', invoicedFilter, dateFrom, dateTo],
    queryFn: () =>
      apiClient
        .get('/supply-chain/logistics/freight-costs', {
          params: {
            ...(invoicedFilter !== '' ? { is_invoiced: invoicedFilter === 'true' } : {}),
            ...(dateFrom ? { date_from: dateFrom } : {}),
            ...(dateTo ? { date_to: dateTo } : {}),
          },
        })
        .then((r) => r.data),
  })

  const costs: FreightCost[] = data?.items ?? data ?? []
  const grouped = groupByOrder(costs)

  const grandTotal = costs.reduce((sum, c) => sum + c.amount, 0)
  const currency = costs[0]?.currency ?? 'USD'

  const costTypeBreakdown = costs.reduce<Record<string, number>>((acc, c) => {
    acc[c.cost_type] = (acc[c.cost_type] ?? 0) + c.amount
    return acc
  }, {})

  const detailColumns = [
    {
      key: 'type',
      label: 'Cost Type',
      render: (r: FreightCost) => (
        <span className={`text-sm font-medium capitalize ${costTypeColors[r.cost_type] ?? 'text-gray-700'}`}>
          {r.cost_type.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (r: FreightCost) => (
        <span className="text-sm font-mono">
          {r.currency} {r.amount.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'invoiced',
      label: 'Invoiced',
      render: (r: FreightCost) => (
        <Badge variant={r.is_invoiced ? 'success' : 'default'}>
          {r.is_invoiced ? `Yes — ${r.invoice_number ?? ''}` : 'No'}
        </Badge>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (r: FreightCost) => (
        <span className="text-sm text-gray-500">{r.notes || '-'}</span>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Freight Audit</h1>
          <p className="text-sm text-gray-500 mt-1">Review and audit all freight costs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          value={invoicedFilter}
          onChange={(e) => setInvoicedFilter(e.target.value)}
          options={[
            { value: '', label: 'All Invoiced Status' },
            { value: 'true', label: 'Invoiced' },
            { value: 'false', label: 'Not Invoiced' },
          ]}
        />
        <Input
          type="date"
          label="From"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          label="To"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {/* Summary Cards */}
      {costs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(costTypeBreakdown).map(([type, amount]) => (
            <Card key={type}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${costTypeColors[type] ?? 'text-gray-500'}`}>
                {type.replace(/_/g, ' ')}
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                {currency} {amount.toFixed(2)}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Grand Total */}
      {costs.length > 0 && (
        <Card>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Grand Total</span>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {currency} {grandTotal.toFixed(2)}
            </span>
          </div>
        </Card>
      )}

      {/* Grouped by Transport Order */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : grouped.length === 0 ? (
        <Card>
          <p className="text-center text-gray-400 py-8">No freight costs found</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <Card key={group.transport_order_id} padding={false}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() =>
                  setExpandedOrderId(
                    expandedOrderId === group.transport_order_id ? null : group.transport_order_id
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                    {group.transport_order_reference}
                  </span>
                  <span className="text-sm text-gray-500">
                    {group.costs.length} line{group.costs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {currency} {group.total.toFixed(2)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {expandedOrderId === group.transport_order_id ? '▲' : '▼'}
                  </span>
                </div>
              </button>
              {expandedOrderId === group.transport_order_id && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <Table
                    columns={detailColumns}
                    data={group.costs}
                    keyExtractor={(r) => r.id}
                    emptyText=""
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
