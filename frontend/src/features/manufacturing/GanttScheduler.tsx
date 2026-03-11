import { useState } from 'react'
import { Button, Card, Select } from '../../components/ui'
import { useGanttData, useRunScheduler, useScenarios } from '../../api/manufacturing_planning'
import { toast } from '../../components/ui'

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function durationHours(start: string, end: string) {
  return ((new Date(end).getTime() - new Date(start).getTime()) / 3600000).toFixed(1)
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-green-500',
  skipped: 'bg-gray-400',
}

export default function GanttScheduler() {
  const [scenarioId, setScenarioId] = useState('')
  const { data: scenarios } = useScenarios()
  const { data: entries, isLoading } = useGanttData(scenarioId || undefined)
  const runScheduler = useRunScheduler()

  const handleRun = async () => {
    try {
      const result = await runScheduler.mutateAsync(scenarioId || undefined)
      toast({ title: `Scheduled ${result.scheduled} operations` })
    } catch {
      toast({ title: 'Scheduling failed', variant: 'destructive' })
    }
  }

  // Group entries by workstation
  const byWorkstation: Record<string, typeof entries> = {}
  entries?.forEach(e => {
    byWorkstation[e.workstation_id] = byWorkstation[e.workstation_id] || []
    byWorkstation[e.workstation_id]!.push(e)
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gantt Scheduler</h1>
        <div className="flex gap-2">
          <Select value={scenarioId} onChange={e => setScenarioId(e.target.value)} className="w-48">
            <option value="">Live Schedule</option>
            {scenarios?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button onClick={handleRun} loading={runScheduler.isPending}>
            Run Scheduler
          </Button>
        </div>
      </div>

      {isLoading && <Card className="p-8 text-center">Loading schedule...</Card>}

      {!isLoading && Object.keys(byWorkstation).length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          No scheduled entries. Run the scheduler to generate the production schedule.
        </Card>
      )}

      {Object.entries(byWorkstation).map(([wsId, wsEntries]) => (
        <Card key={wsId} className="overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b font-medium text-sm">
            Workstation: {wsId.slice(0, 8)}...
          </div>
          <div className="divide-y">
            {wsEntries?.sort((a, b) => a.sequence - b.sequence).map(entry => (
              <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
                <div className={`w-2 h-8 rounded ${statusColors[entry.status] || 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">WO: {entry.work_order_id.slice(0, 8)}...</div>
                  <div className="text-xs text-gray-500">
                    {formatDateTime(entry.scheduled_start)} → {formatDateTime(entry.scheduled_end)}
                    <span className="ml-2">({durationHours(entry.scheduled_start, entry.scheduled_end)}h)</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 capitalize">{entry.status}</div>
                <div className="text-xs text-gray-400">Seq {entry.sequence}</div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
