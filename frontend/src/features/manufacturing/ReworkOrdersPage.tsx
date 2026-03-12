import { useState } from 'react'
import { Badge, Card, Select } from '../../components/ui'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

interface ReworkOrder {
  id: string
  rework_number: string
  parent_wo_id: string
  child_wo_id: string | null
  quality_check_id: string | null
  reason: string
  quantity: number
  status: string
  rework_cost: number
  created_by: string
  created_at: string
  updated_at: string
}

const statusColors: Record<string, BadgeVariant> = { pending: 'warning', in_progress: 'info', completed: 'success' }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ReworkOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('')

  const { data: reworks, isLoading } = useQuery({
    queryKey: ['rework-orders', statusFilter],
    queryFn: () => apiClient.get<ReworkOrder[]>('/manufacturing/rework-orders', {
      params: statusFilter ? { status: statusFilter } : undefined,
    }).then(r => r.data),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rework Orders</h1>
      </div>

      <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
        <option value="">All Statuses</option>
        {['pending', 'in_progress', 'completed'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </Select>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-3 px-4">Rework #</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Reason</th>
              <th className="text-left py-3 px-4">Quantity</th>
              <th className="text-left py-3 px-4">Cost</th>
              <th className="text-left py-3 px-4">Parent WO</th>
              <th className="text-left py-3 px-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>
            ) : reworks?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">No rework orders</td></tr>
            ) : reworks?.map((rw: ReworkOrder) => (
              <tr key={rw.id}>
                <td className="font-mono text-sm font-medium">{rw.rework_number}</td>
                <td><Badge variant={statusColors[rw.status] || 'default'}>{rw.status.replace('_', ' ')}</Badge></td>
                <td className="max-w-xs truncate">{rw.reason}</td>
                <td>{rw.quantity}</td>
                <td>${rw.rework_cost}</td>
                <td className="text-xs">{rw.parent_wo_id.slice(0, 8)}...</td>
                <td>{formatDate(rw.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
