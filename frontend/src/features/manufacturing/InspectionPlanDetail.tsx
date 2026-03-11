import { useParams, useNavigate } from 'react-router-dom'
import { Badge, Card, Table } from '../../components/ui'
import { useInspectionPlan } from '../../api/manufacturing_quality'

export default function InspectionPlanDetail() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const { data: plan, isLoading } = useInspectionPlan(planId!)

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!plan) return <div className="p-6">Plan not found</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => navigate('/manufacturing/inspection-plans')}>
            ← Back to Plans
          </button>
          <h1 className="text-2xl font-bold">{plan.plan_number}: {plan.name}</h1>
        </div>
        <Badge variant={plan.is_active ? 'green' : 'gray'}>{plan.is_active ? 'Active' : 'Inactive'}</Badge>
      </div>

      <Card className="p-4">
        <p className="text-sm text-gray-600 mb-4">{plan.description || 'No description'}</p>
        <div className="text-sm space-y-1">
          <div><span className="text-gray-500">Version:</span> v{plan.version}</div>
          {plan.bom_id && <div><span className="text-gray-500">BOM:</span> {plan.bom_id}</div>}
          {plan.routing_step_id && <div><span className="text-gray-500">Routing Step:</span> {plan.routing_step_id}</div>}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-lg mb-4">Checklist Items ({plan.items?.length || 0})</h2>
        <Table>
          <thead>
            <tr>
              <th>#</th>
              <th>Parameter</th>
              <th>Type</th>
              <th>Target</th>
              <th>Limits</th>
              <th>Critical</th>
              <th>Sample Size</th>
            </tr>
          </thead>
          <tbody>
            {plan.items?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-4 text-gray-500">No checklist items</td></tr>
            ) : plan.items?.map((item) => (
              <tr key={item.id}>
                <td>{item.sequence}</td>
                <td className="font-medium">{item.parameter_name}</td>
                <td className="capitalize">{item.measurement_type}</td>
                <td>{item.target_value || '—'}</td>
                <td className="text-sm">
                  {item.lower_limit != null || item.upper_limit != null
                    ? `${item.lower_limit ?? '—'} – ${item.upper_limit ?? '—'} ${item.unit_of_measure || ''}`
                    : '—'}
                </td>
                <td>{item.is_critical ? <Badge variant="red">Critical</Badge> : '—'}</td>
                <td>{item.sample_size}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
