import { useState } from 'react'
import {
  useLeaderboard,
  useMyGamificationScore,
} from '@/api/crm_workflows'
import { Badge, Card, Spinner, Select, cn } from '@/components/ui'

interface LeaderboardEntry {
  rank: number
  user_id: string
  total_score: number
  total_deals: number
  total_value: number
  total_activities: number
  total_leads: number
}

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const RANK_STYLES: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Gold' },
  2: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Silver' },
  3: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Bronze' },
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)

export default function LeaderboardPage() {
  const [period, setPeriod] = useState('weekly')

  const { data: leaderboardData, isLoading } = useLeaderboard({ period })
  const { data: myScore, isLoading: myScoreLoading } = useMyGamificationScore({ period })

  const entries: LeaderboardEntry[] = leaderboardData?.entries ?? leaderboardData ?? []

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Sales Leaderboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track performance and compete with your team
          </p>
        </div>
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          options={PERIOD_OPTIONS}
        />
      </div>

      {/* My Score Card */}
      {myScoreLoading ? (
        <Card className="flex items-center justify-center py-6">
          <Spinner size="sm" />
        </Card>
      ) : myScore ? (
        <Card
          className="border-2 border-[#51459d]"
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: '#51459d' }}
            >
              You
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">My Score</h2>
              <span className="text-xs text-gray-500 capitalize">{period} period</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#51459d' }}>
                {myScore.score}
              </p>
              <p className="text-xs text-gray-500">Score</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#6fd943' }}>
                {myScore.deals_closed}
              </p>
              <p className="text-xs text-gray-500">Deals Closed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#3ec9d6' }}>
                {formatCurrency(myScore.deals_value)}
              </p>
              <p className="text-xs text-gray-500">Deal Value</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#ffa21d' }}>
                {myScore.activities_completed}
              </p>
              <p className="text-xs text-gray-500">Activities</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#ff3a6e' }}>
                {myScore.leads_converted}
              </p>
              <p className="text-xs text-gray-500">Leads Converted</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Leaderboard Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : entries.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-gray-400">No leaderboard data available for this period.</p>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-16">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    User
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Score
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Deals
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Value
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Activities
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Leads
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const rankStyle = RANK_STYLES[entry.rank]
                  const isTopThree = entry.rank <= 3
                  return (
                    <tr
                      key={entry.user_id}
                      className={cn(
                        'border-b border-gray-50 dark:border-gray-800 transition-colors',
                        isTopThree
                          ? 'bg-gradient-to-r from-transparent via-transparent to-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
                      )}
                    >
                      <td className="py-3 px-4 text-center">
                        {rankStyle ? (
                          <span className={cn('inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm', rankStyle.bg, rankStyle.text)}>
                            {entry.rank}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-medium">{entry.rank}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                              isTopThree ? '' : 'bg-gray-400',
                            )}
                            style={isTopThree ? { backgroundColor: '#51459d' } : undefined}
                          >
                            {entry.user_id.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {entry.user_id.slice(0, 8)}...
                            </span>
                            {rankStyle && (
                              <Badge
                                variant={entry.rank === 1 ? 'warning' : entry.rank === 2 ? 'default' : 'info'}
                                className="ml-2"
                              >
                                {rankStyle.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-lg" style={{ color: '#51459d' }}>
                          {entry.total_score.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {entry.total_deals}
                      </td>
                      <td className="py-3 px-4 text-right font-medium" style={{ color: '#6fd943' }}>
                        {formatCurrency(entry.total_value)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {entry.total_activities}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {entry.total_leads}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
