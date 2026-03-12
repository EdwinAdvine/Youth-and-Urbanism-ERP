import { Card, Badge } from '../../components/ui'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface Variance {
  id: string
  work_order_id: string
  variance_type: string
  planned_value: number
  actual_value: number
  variance_amount: number
  variance_percent: number
  calculated_at: string
  notes: string | null
}

interface Props {
  workOrderId: string
}

export default function VarianceAnalysis({ workOrderId }: Props) {
  const { data: variances, isLoading } = useQuery({
    queryKey: ['wo-variance', workOrderId],
    queryFn: () => apiClient.get<Variance[]>(`/manufacturing/work-orders/${workOrderId}/variance`).then(r => r.data),
    enabled: !!workOrderId,
  })

  if (isLoading) return <Card className="p-4">Calculating variance...</Card>
  if (!variances || variances.length === 0) return <Card className="p-4 text-gray-500">No variance data available</Card>

  return (
    <Card className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Variance Analysis</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {variances.map(v => (
          <div key={v.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">{v.variance_type}</span>
              <Badge variant={v.variance_amount > 0 ? 'danger' : v.variance_amount < 0 ? 'success' : 'default'}>
                {v.variance_percent > 0 ? '+' : ''}{v.variance_percent}%
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-gray-500">Planned</span>
              <span className="text-right">{v.planned_value}</span>
              <span className="text-gray-500">Actual</span>
              <span className="text-right">{v.actual_value}</span>
              <span className="text-gray-500">Variance</span>
              <span className={`text-right font-medium ${v.variance_amount > 0 ? 'text-red-600' : v.variance_amount < 0 ? 'text-green-600' : ''}`}>
                {v.variance_amount > 0 ? '+' : ''}{v.variance_amount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
