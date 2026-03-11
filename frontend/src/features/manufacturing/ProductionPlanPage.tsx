import { useState } from 'react'
import { Card, Select, Badge, Spinner } from '../../components/ui'
import { useProductionPlan, type ProductionPlanItem } from '../../api/manufacturing_ext'

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  draft: 'default',
  planned: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

const priorityColors: Record<string, 'default' | 'warning' | 'danger' | 'info'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

export default function ProductionPlanPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: plan, isLoading, error } = useProductionPlan({ status: statusFilter || undefined })

  if (error) return <div className="p-6 text-danger">Failed to load production plan</div>

  const items = plan ?? []
  const inProgress = items.filter((i) => i.status === 'in_progress').length
  const planned = items.filter((i) => i.status === 'planned').length
  const completed = items.filter((i) => i.status === 'completed').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Plan</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of planned and active work orders</p>
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          options={[{ value: '', label: 'All Status' }, { value: 'planned', label: 'Planned' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }]} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card><p className="text-sm text-gray-500">Total</p><p className="text-2xl font-bold text-gray-900">{items.length}</p></Card>
        <Card><p className="text-sm text-gray-500">Planned</p><p className="text-2xl font-bold text-blue-600">{planned}</p></Card>
        <Card><p className="text-sm text-gray-500">In Progress</p><p className="text-2xl font-bold text-orange-600">{inProgress}</p></Card>
        <Card><p className="text-sm text-gray-500">Completed</p><p className="text-2xl font-bold text-green-600">{completed}</p></Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <Card className="text-center py-12"><p className="text-gray-400">No production items found</p></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <PlanCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlanCard({ item }: { item: ProductionPlanItem }) {
  const progress = item.planned_quantity > 0 ? (item.completed_quantity / item.planned_quantity) * 100 : 0

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-gray-500">{item.wo_number}</span>
            <Badge variant={statusColors[item.status]}>{item.status.replace(/_/g, ' ')}</Badge>
            <Badge variant={priorityColors[item.priority] || 'default'}>{item.priority}</Badge>
            {!item.material_ready && <Badge variant="danger">Material Not Ready</Badge>}
          </div>
          <h3 className="font-medium text-gray-900">{item.finished_item_name}</h3>
          <p className="text-sm text-gray-500">BOM: {item.bom_name}</p>
          <div className="flex gap-6 mt-2 text-sm text-gray-600">
            {item.workstation_name && <span>Station: {item.workstation_name}</span>}
            {item.assigned_to_name && <span>Assigned: {item.assigned_to_name}</span>}
            {item.planned_start && <span>Start: {new Date(item.planned_start).toLocaleDateString()}</span>}
            {item.planned_end && <span>End: {new Date(item.planned_end).toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="text-right min-w-[120px]">
          <p className="text-sm text-gray-500">Progress</p>
          <p className="text-lg font-bold text-gray-900">{item.completed_quantity} / {item.planned_quantity}</p>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
            <div
              className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-primary' : 'bg-gray-300'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{progress.toFixed(0)}%</p>
        </div>
      </div>
    </Card>
  )
}
