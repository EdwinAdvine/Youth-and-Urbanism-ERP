import { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../../components/ui'
import apiClient from '../../api/client'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

interface BoardItem {
  id: string
  wo_number: string
  status: string
  priority: string
  planned_quantity: number
  completed_quantity: number
  progress_percent: number
  planned_start: string | null
  planned_end: string | null
  actual_start: string | null
  workstation_id: string | null
  schedule_entries: number
  current_step: { id: string; status: string; sequence: number } | null
}

const priorityColors: Record<string, BadgeVariant> = { high: 'danger', medium: 'warning', low: 'default' }
const statusColors: Record<string, BadgeVariant> = { planned: 'default', in_progress: 'info', completed: 'success' }

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${percent >= 100 ? 'bg-green-500' : percent >= 50 ? 'bg-blue-500' : 'bg-yellow-400'}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

export default function ProductionBoard() {
  const [items, setItems] = useState<BoardItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const r = await apiClient.get<BoardItem[]>('/manufacturing/production-board')
      setItems(r.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000) // auto-refresh every 30s
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Board</h1>
          <div className="text-xs text-gray-400">Auto-refreshes every 30s</div>
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      {loading && <Card className="p-8 text-center">Loading production board...</Card>}

      {!loading && items.length === 0 && (
        <Card className="p-8 text-center text-gray-500">No active work orders on the production floor.</Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map(item => (
          <Card key={item.id} className={`p-4 space-y-3 ${item.priority === 'high' ? 'border-t-2 border-t-red-500' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono font-semibold">{item.wo_number}</div>
                <div className="flex gap-1 mt-1">
                  <Badge variant={statusColors[item.status] || 'default'} className="text-xs">{item.status.replace('_', ' ')}</Badge>
                  <Badge variant={priorityColors[item.priority] || 'default'} className="text-xs">{item.priority}</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{item.progress_percent}%</div>
                <div className="text-xs text-gray-500">{item.completed_quantity}/{item.planned_quantity}</div>
              </div>
            </div>

            <ProgressBar percent={item.progress_percent} />

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              {item.planned_start && (
                <div>
                  <span className="font-medium">Start: </span>
                  {new Date(item.planned_start).toLocaleDateString()}
                </div>
              )}
              {item.planned_end && (
                <div>
                  <span className="font-medium">Due: </span>
                  {new Date(item.planned_end).toLocaleDateString()}
                </div>
              )}
              <div>
                <span className="font-medium">Steps: </span>{item.schedule_entries}
              </div>
              {item.current_step && (
                <div>
                  <span className="font-medium">Current: </span>Step {item.current_step.sequence}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
