/**
 * ScorecardsPage — OKR-style goal tracking with traffic-light indicators.
 * Goals auto-track from live ERP data.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import DashboardHeader from './prebuilt/DashboardHeader'
import { Button, Modal, Input, Spinner } from '../../components/ui'

interface Goal {
  id: string
  name: string
  description: string
  target_value: number
  actual_value: number
  unit: string
  due_date: string
  owner: string
}

interface NewGoalForm {
  name: string
  description: string
  target_value: string
  unit: string
  due_date: string
  owner: string
}

const MOCK_GOALS: Goal[] = [
  { id: '1', name: 'Q1 Revenue', target_value: 10000000, actual_value: 7200000, unit: 'KSh', due_date: '2026-03-31', owner: 'Finance Team', description: 'Total revenue for Q1 2026' },
  { id: '2', name: 'New Hires', target_value: 15, actual_value: 9, unit: 'headcount', due_date: '2026-03-31', owner: 'HR Team', description: 'Recruit 15 new team members' },
  { id: '3', name: 'Customer NPS', target_value: 70, actual_value: 68, unit: 'score', due_date: '2026-03-31', owner: 'CRM Team', description: 'Net Promoter Score target' },
  { id: '4', name: 'Support SLA', target_value: 95, actual_value: 91, unit: '%', due_date: '2026-03-31', owner: 'Support Team', description: 'Ticket resolution within SLA' },
  { id: '5', name: 'Pipeline Value', target_value: 50000000, actual_value: 38000000, unit: 'KSh', due_date: '2026-03-31', owner: 'Sales Team', description: 'Total deals in pipeline' },
  { id: '6', name: 'Product Uptime', target_value: 99.9, actual_value: 99.97, unit: '%', due_date: '2026-03-31', owner: 'Engineering', description: 'Platform availability SLA' },
]

const EMPTY_FORM: NewGoalForm = {
  name: '',
  description: '',
  target_value: '',
  unit: '',
  due_date: '',
  owner: '',
}

function formatValue(value: number, unit: string): string {
  if (unit === 'KSh') {
    if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
    return `KSh ${value.toLocaleString()}`
  }
  return `${value.toLocaleString()} ${unit}`
}

function getStatus(pct: number): { label: string; color: string; dotColor: string; barColor: string } {
  if (pct >= 100) return { label: 'On Track', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dotColor: '#6fd943', barColor: '#6fd943' }
  if (pct >= 60)  return { label: 'At Risk',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', dotColor: '#ffa21d', barColor: '#ffa21d' }
  if (pct >= 30)  return { label: 'Behind',   color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', dotColor: '#ff7a00', barColor: '#ff7a00' }
  return           { label: 'Off Track', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dotColor: '#ff3a6e', barColor: '#ff3a6e' }
}

export default function ScorecardsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<NewGoalForm>(EMPTY_FORM)

  const { data: goals, isLoading } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: () => apiClient.get('/analytics/goals').then(r => r.data),
    placeholderData: MOCK_GOALS,
    retry: false,
  })

  const createGoal = useMutation({
    mutationFn: (payload: Omit<Goal, 'id' | 'actual_value'>) =>
      apiClient.post('/analytics/goals', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setModalOpen(false)
      setForm(EMPTY_FORM)
    },
  })

  const displayGoals = goals ?? MOCK_GOALS

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createGoal.mutate({
      name: form.name,
      description: form.description,
      target_value: Number(form.target_value),
      unit: form.unit,
      due_date: form.due_date,
      owner: form.owner,
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <DashboardHeader
          title="Scorecards & Goals"
          subtitle="Track KPIs and goals against targets"
        />
        <Button onClick={() => setModalOpen(true)} className="shrink-0">
          New Goal
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayGoals.map((goal) => {
            const pct = Math.min(Math.round((goal.actual_value / goal.target_value) * 100), 100)
            const overAchieved = goal.actual_value > goal.target_value
            const rawPct = Math.round((goal.actual_value / goal.target_value) * 100)
            const status = getStatus(rawPct)

            return (
              <div
                key={goal.id}
                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] p-5 shadow-sm flex flex-col gap-3"
              >
                {/* Title row */}
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: status.dotColor }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{goal.name}</p>
                    <p className="text-xs text-gray-400 truncate">{goal.owner}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{rawPct}%{overAchieved ? ' (exceeded)' : ''}</span>
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: status.barColor }}
                    />
                  </div>
                </div>

                {/* Values */}
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {formatValue(goal.actual_value, goal.unit)}
                    </p>
                    <p className="text-xs text-gray-400">
                      of {formatValue(goal.target_value, goal.unit)}
                    </p>
                  </div>
                </div>

                {/* Due date */}
                <div className="flex items-center gap-1 text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Due {new Date(goal.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Goal Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setForm(EMPTY_FORM) }} title="New Goal" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Goal Name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Q1 Revenue"
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 min-h-[60px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe this goal..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Target Value"
              type="number"
              value={form.target_value}
              onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
              placeholder="10000000"
              required
            />
            <Input
              label="Unit"
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              placeholder="KSh, %, headcount"
              required
            />
          </div>
          <Input
            label="Due Date"
            type="date"
            value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            required
          />
          <Input
            label="Owner"
            value={form.owner}
            onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
            placeholder="Finance Team"
            required
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => { setModalOpen(false); setForm(EMPTY_FORM) }}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createGoal.isPending}>
              {createGoal.isPending ? 'Creating...' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
