import { Link } from 'react-router-dom'
import { useCRMStats, usePipeline, useLeads } from '../../api/crm'
import { cn, Card, Spinner, Badge } from '../../components/ui'
import QuickActivityLog from './QuickActivityLog'

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'bg-info',
  proposal: 'bg-primary',
  negotiation: 'bg-warning',
  closed_won: 'bg-success',
  closed_lost: 'bg-danger',
}

const STATUS_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  new: 'info',
  contacted: 'primary',
  qualified: 'success',
  unqualified: 'danger',
  converted: 'warning',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default function CRMDashboard() {
  const { data: stats } = useCRMStats()
  const { data: pipeline, isLoading: pipelineLoading } = usePipeline()
  const { data: recentLeads, isLoading: leadsLoading } = useLeads({ page: 1, limit: 5 })

  const statCards = [
    {
      label: 'New Leads This Month',
      value: stats?.new_leads_this_month ?? 0,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      label: 'Pipeline Value',
      value: formatCurrency(stats?.pipeline_value ?? 0),
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Deals Closed This Month',
      value: `${stats?.deals_closed_this_month ?? 0} (${formatCurrency(stats?.deals_closed_value ?? 0)})`,
      color: 'text-success',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Conversion Rate',
      value: `${((stats?.conversion_rate ?? 0) * 100).toFixed(1)}%`,
      color: 'text-warning',
      bgColor: 'bg-orange-50',
    },
  ]

  // Compute max pipeline value for funnel scaling
  const pipelineStages = (pipeline?.stages ?? []).filter(
    (s) => s.stage !== 'closed_won' && s.stage !== 'closed_lost'
  )
  const maxStageValue = Math.max(...pipelineStages.map((s) => s.total_value), 1)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CRM Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your sales pipeline and activity</p>
        </div>
        <div className="flex gap-2">
          <Link to="/crm/contacts">
            <button className="px-4 py-2 text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Contacts
            </button>
          </Link>
          <Link to="/crm/leads">
            <button className="px-4 py-2 text-sm rounded-[10px] bg-primary text-white hover:bg-primary-600">
              Leads
            </button>
          </Link>
          <Link to="/crm/pipeline">
            <button className="px-4 py-2 text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Pipeline
            </button>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <div className="flex items-start gap-4">
              <div className={cn('w-10 h-10 rounded-[10px] flex items-center justify-center', card.bgColor)}>
                <span className={cn('text-lg font-bold', card.color)}>
                  {card.label === 'New Leads This Month' && '#'}
                  {card.label === 'Pipeline Value' && '$'}
                  {card.label === 'Deals Closed This Month' && '!'}
                  {card.label === 'Conversion Rate' && '%'}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
                <p className={cn('text-xl font-bold mt-1', card.color)}>{card.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pipeline Funnel */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Pipeline Funnel</h2>
        {pipelineLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : pipelineStages.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No opportunities in the pipeline yet</p>
        ) : (
          <div className="space-y-3">
            {pipelineStages.map((stage) => {
              const width = Math.max((stage.total_value / maxStageValue) * 100, 8)
              return (
                <div key={stage.stage} className="flex items-center gap-4">
                  <div className="w-28 text-sm font-medium text-gray-700 dark:text-gray-300 text-right shrink-0">
                    {STAGE_LABELS[stage.stage] ?? stage.stage}
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        'h-10 rounded-[10px] flex items-center px-3 text-white text-sm font-medium transition-all',
                        STAGE_COLORS[stage.stage] ?? 'bg-gray-400'
                      )}
                      style={{ width: `${width}%` }}
                    >
                      {stage.count} &middot; {formatCurrency(stage.total_value)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Recent Leads */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Leads</h2>
          <Link to="/crm/leads" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {leadsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !recentLeads?.items?.length ? (
          <p className="text-gray-400 text-sm text-center py-8">No leads yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Title
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Contact
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Est. Value
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.items.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="py-3 px-6 font-medium text-gray-900 dark:text-gray-100">{lead.title}</td>
                    <td className="py-3 px-6 text-gray-600 dark:text-gray-400">{lead.contact_name ?? '---'}</td>
                    <td className="py-3 px-6">
                      <Badge variant={STATUS_BADGE[lead.status] ?? 'default'}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-6 text-right text-gray-700 dark:text-gray-300">
                      {lead.estimated_value != null ? formatCurrency(lead.estimated_value) : '---'}
                    </td>
                    <td className="py-3 px-6 text-gray-500">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Activity FAB for mobile */}
      <QuickActivityLog />
    </div>
  )
}
