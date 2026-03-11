import { useState } from 'react'
import { Card, Spinner, Select } from '../../components/ui'
import { useCampaigns, useCampaignAnalytics, type Campaign } from '../../api/crm'

function BarChartHorizontal({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-sm text-gray-600 w-28">{item.label}</span>
          <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${item.color}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-700 w-16 text-right">{item.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function CampaignAnalyticsPage() {
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns()
  const [selectedId, setSelectedId] = useState('')
  const { data: analytics, isLoading: analyticsLoading } = useCampaignAnalytics(selectedId)

  if (campaignsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Campaign Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Performance metrics for your campaigns</p>
      </div>

      <Select
        label="Select Campaign"
        options={[
          { value: '', label: 'Choose a campaign...' },
          ...(campaigns?.map((c: Campaign) => ({ value: c.id, label: c.name })) ?? []),
        ]}
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-72"
      />

      {!selectedId ? (
        <Card>
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-medium">Select a campaign to view analytics</p>
          </div>
        </Card>
      ) : analyticsLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : analytics ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <p className="text-sm text-gray-500">Total Contacts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.total_contacts.toLocaleString()}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Open Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.open_rate.toFixed(1)}%</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Click Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.click_rate.toFixed(1)}%</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.conversion_rate.toFixed(1)}%</p>
            </Card>
          </div>

          {/* Funnel Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Campaign Funnel</h3>
            <BarChartHorizontal
              data={[
                { label: 'Sent', value: analytics.sent, color: 'bg-blue-500' },
                { label: 'Opened', value: analytics.opened, color: 'bg-cyan-500' },
                { label: 'Clicked', value: analytics.clicked, color: 'bg-primary' },
                { label: 'Converted', value: analytics.converted, color: 'bg-green-500' },
                { label: 'Unsubscribed', value: analytics.unsubscribed, color: 'bg-red-400' },
              ]}
            />
          </Card>

          {/* Summary table */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Metric</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Count</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">% of Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Total Contacts', count: analytics.total_contacts, pct: null },
                    { label: 'Sent', count: analytics.sent, pct: analytics.sent > 0 ? 100 : 0 },
                    { label: 'Opened', count: analytics.opened, pct: analytics.open_rate },
                    { label: 'Clicked', count: analytics.clicked, pct: analytics.click_rate },
                    { label: 'Converted', count: analytics.converted, pct: analytics.conversion_rate },
                    { label: 'Unsubscribed', count: analytics.unsubscribed, pct: analytics.sent > 0 ? (analytics.unsubscribed / analytics.sent) * 100 : 0 },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-gray-50">
                      <td className="py-2 px-3 font-medium">{row.label}</td>
                      <td className="py-2 px-3 text-right">{row.count.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{row.pct != null ? `${row.pct.toFixed(1)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-400">No analytics data available</div>
        </Card>
      )}
    </div>
  )
}
