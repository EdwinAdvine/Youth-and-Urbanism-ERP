import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { Button, Card, Badge, Spinner, Input, Table, toast } from '../../components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommissionEntry {
  id: string
  cashier_id: string
  cashier_name: string
  session_id: string
  session_number: string
  transaction_id: string
  transaction_number: string
  rule_name: string
  amount: string
  status: 'calculated' | 'approved' | 'paid'
  created_at: string
}

interface CommissionSummary {
  total_calculated: string
  total_approved: string
  total_paid: string
  entry_count: number
}

interface CommissionReportResponse {
  entries: CommissionEntry[]
  summary: CommissionSummary
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useCommissionReport(params: { date_from?: string; date_to?: string; status?: string }) {
  return useQuery({
    queryKey: ['pos', 'commission-report', params],
    queryFn: async () => {
      const { data } = await apiClient.get<CommissionReportResponse>('/pos/commission-report', { params })
      return data
    },
  })
}

function useBatchApproveCommissions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await apiClient.post('/pos/commissions/batch-approve', { ids })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos', 'commission-report'] }),
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return isNaN(n) ? '0.00' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const statusVariant: Record<string, 'info' | 'warning' | 'success'> = {
  calculated: 'info',
  approved: 'warning',
  paid: 'success',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommissionReportPage() {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isLoading } = useCommissionReport({
    date_from: dateFrom,
    date_to: dateTo,
    status: statusFilter || undefined,
  })
  const batchApprove = useBatchApproveCommissions()

  const entries = data?.entries ?? []
  const summary = data?.summary

  const calculatedEntries = entries.filter((e) => e.status === 'calculated')
  const allCalculatedSelected = calculatedEntries.length > 0 && calculatedEntries.every((e) => selected.has(e.id))

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allCalculatedSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(calculatedEntries.map((e) => e.id)))
    }
  }

  async function handleBatchApprove() {
    const ids = Array.from(selected)
    if (ids.length === 0) {
      toast('warning', 'No commissions selected')
      return
    }
    try {
      await batchApprove.mutateAsync(ids)
      toast('success', `${ids.length} commission(s) approved`)
      setSelected(new Set())
    } catch {
      toast('error', 'Failed to approve commissions')
    }
  }

  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={allCalculatedSelected}
          onChange={toggleSelectAll}
          className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
        />
      ) as unknown as string,
      render: (e: CommissionEntry) =>
        e.status === 'calculated' ? (
          <input
            type="checkbox"
            checked={selected.has(e.id)}
            onChange={() => toggleSelect(e.id)}
            className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
          />
        ) : null,
    },
    {
      key: 'cashier_name',
      label: 'Cashier',
      render: (e: CommissionEntry) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{e.cashier_name}</span>
      ),
    },
    {
      key: 'session_number',
      label: 'Session',
      render: (e: CommissionEntry) => (
        <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">{e.session_number}</span>
      ),
    },
    {
      key: 'transaction_number',
      label: 'Transaction',
      render: (e: CommissionEntry) => (
        <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">{e.transaction_number}</span>
      ),
    },
    {
      key: 'rule_name',
      label: 'Rule',
      render: (e: CommissionEntry) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">{e.rule_name}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      className: 'text-right',
      render: (e: CommissionEntry) => (
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fmt(e.amount)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (e: CommissionEntry) => (
        <Badge variant={statusVariant[e.status] ?? 'default'}>{e.status}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (e: CommissionEntry) => (
        <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString()}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Commission Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            View and approve earned commissions.
          </p>
        </div>
        {selected.size > 0 && (
          <Button onClick={handleBatchApprove} loading={batchApprove.isPending}>
            Approve {selected.size} Selected
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            >
              <option value="">All</option>
              <option value="calculated">Calculated</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Summary */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Entries</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{summary.entry_count}</p>
              </Card>
              <Card>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Calculated</p>
                <p className="text-3xl font-bold text-cyan-600 mt-1">{fmt(summary.total_calculated)}</p>
              </Card>
              <Card>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Approved</p>
                <p className="text-3xl font-bold text-[#ffa21d] mt-1">{fmt(summary.total_approved)}</p>
              </Card>
              <Card>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Paid</p>
                <p className="text-3xl font-bold text-[#6fd943] mt-1">{fmt(summary.total_paid)}</p>
              </Card>
            </div>
          )}

          {/* Table */}
          <Card padding={false}>
            <Table
              columns={columns}
              data={entries}
              keyExtractor={(e) => e.id}
              emptyText="No commission entries for the selected period."
            />
          </Card>
        </>
      )}
    </div>
  )
}
