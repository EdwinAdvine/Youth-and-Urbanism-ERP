import { useState } from 'react'
import { useDeals } from '../../api/crm'
import { Badge, Card, Table, Pagination } from '../../components/ui'
import type { Deal } from '../../api/crm'
import ScheduleFollowupDialog from './ScheduleFollowupDialog'
import ScheduleMeetingDialog from './ScheduleMeetingDialog'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default function DealsPage() {
  const [page, setPage] = useState(1)
  const limit = 20
  const { data, isLoading } = useDeals({ page, limit })

  const [followupDeal, setFollowupDeal] = useState<Deal | null>(null)
  const [meetingDeal, setMeetingDeal] = useState<Deal | null>(null)

  const deals = data?.items ?? []
  const totalPages = Math.ceil((data?.total ?? 0) / limit)

  // Compute totals
  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)

  const columns = [
    {
      key: 'title',
      label: 'Deal Title',
      render: (row: Deal) => <span className="font-medium text-gray-900 dark:text-gray-100">{row.title}</span>,
    },
    {
      key: 'contact_name',
      label: 'Contact',
      render: (row: Deal) => row.contact_name || '---',
    },
    {
      key: 'value',
      label: 'Value',
      className: 'text-right',
      render: (row: Deal) => (
        <span className="font-semibold text-primary">{formatCurrency(row.value)}</span>
      ),
    },
    {
      key: 'close_date',
      label: 'Close Date',
      render: (row: Deal) => new Date(row.close_date).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Deal) => (
        <Badge variant={row.status === 'won' ? 'success' : row.status === 'lost' ? 'danger' : 'default'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Deal) => (
        <div className="flex gap-1">
          <button
            className="text-xs text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              setFollowupDeal(row)
            }}
          >
            Follow-up
          </button>
          <span className="text-gray-300">|</span>
          <button
            className="text-xs text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              setMeetingDeal(row)
            }}
          >
            Meeting
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Deals</h1>
        <p className="text-sm text-gray-500 mt-1">Closed deals and their outcomes</p>
      </div>

      {/* Totals Summary */}
      {deals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Deals</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{data?.total ?? deals.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Value (This Page)</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totalValue)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Average Deal Size</p>
            <p className="text-2xl font-bold text-success mt-1">
              {deals.length > 0 ? formatCurrency(totalValue / deals.length) : '$0'}
            </p>
          </Card>
        </div>
      )}

      {/* Deals Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <Table
            columns={columns}
            data={deals}
            loading={isLoading}
            emptyText="No deals closed yet"
            keyExtractor={(row) => row.id}
          />
        </div>

        {/* Totals Row */}
        {deals.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 text-sm">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              Page Total: {deals.length} deal{deals.length !== 1 ? 's' : ''}
            </span>
            <span className="font-bold text-primary text-base">{formatCurrency(totalValue)}</span>
          </div>
        )}

        <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
      </Card>

      {/* CRM Cross-Module Dialogs */}
      {followupDeal && (
        <ScheduleFollowupDialog
          open={!!followupDeal}
          onClose={() => setFollowupDeal(null)}
          entityType="deal"
          entityId={followupDeal.id}
          entityName={followupDeal.title}
        />
      )}
      {meetingDeal && (
        <ScheduleMeetingDialog
          open={!!meetingDeal}
          onClose={() => setMeetingDeal(null)}
          entityType="deal"
          entityId={meetingDeal.id}
          entityName={meetingDeal.title}
        />
      )}
    </div>
  )
}
