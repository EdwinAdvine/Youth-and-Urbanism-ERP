import { Card } from '../../components/ui'
import { useSPCControlChart } from '../../api/manufacturing_quality'

interface Props {
  planItemId: string
  workOrderId?: string
}

export default function SPCChart({ planItemId, workOrderId }: Props) {
  const { data: chart, isLoading } = useSPCControlChart(planItemId, workOrderId)

  if (isLoading) return <Card className="p-4"><p>Loading SPC data...</p></Card>
  if (!chart) return <Card className="p-4"><p>No SPC data available</p></Card>

  const { statistics, data_points, plan_item } = chart
  const maxVal = Math.max(...data_points.map(d => d.measured_value), statistics.ucl || 0, plan_item.upper_limit || 0)
  const minVal = Math.min(...data_points.map(d => d.measured_value), statistics.lcl || 0, plan_item.lower_limit || 0)
  const range = maxVal - minVal || 1
  const chartHeight = 200
  const chartWidth = Math.max(data_points.length * 20, 400)

  const yScale = (val: number) => chartHeight - ((val - minVal) / range) * chartHeight

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">SPC Control Chart — {plan_item.parameter_name}</h3>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>Mean: {statistics.mean}</span>
          {statistics.ucl && <span>UCL: {statistics.ucl}</span>}
          {statistics.lcl && <span>LCL: {statistics.lcl}</span>}
          <span>OOC: {statistics.out_of_control_count}/{statistics.total_points}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight + 40} className="border rounded">
          {/* UCL line */}
          {statistics.ucl != null && (
            <line x1={0} y1={yScale(statistics.ucl)} x2={chartWidth} y2={yScale(statistics.ucl)}
              stroke="#ff3a6e" strokeDasharray="5,5" strokeWidth={1} />
          )}
          {/* LCL line */}
          {statistics.lcl != null && (
            <line x1={0} y1={yScale(statistics.lcl)} x2={chartWidth} y2={yScale(statistics.lcl)}
              stroke="#ff3a6e" strokeDasharray="5,5" strokeWidth={1} />
          )}
          {/* Mean line */}
          <line x1={0} y1={yScale(statistics.mean)} x2={chartWidth} y2={yScale(statistics.mean)}
            stroke="#51459d" strokeWidth={1} />
          {/* Spec limits */}
          {plan_item.upper_limit != null && (
            <line x1={0} y1={yScale(plan_item.upper_limit)} x2={chartWidth} y2={yScale(plan_item.upper_limit)}
              stroke="#ffa21d" strokeDasharray="3,3" strokeWidth={1} />
          )}
          {plan_item.lower_limit != null && (
            <line x1={0} y1={yScale(plan_item.lower_limit)} x2={chartWidth} y2={yScale(plan_item.lower_limit)}
              stroke="#ffa21d" strokeDasharray="3,3" strokeWidth={1} />
          )}
          {/* Data points */}
          {data_points.map((dp, i) => {
            const x = 10 + i * 20
            const y = yScale(dp.measured_value)
            return (
              <g key={dp.id}>
                {i > 0 && (
                  <line
                    x1={10 + (i - 1) * 20} y1={yScale(data_points[i - 1].measured_value)}
                    x2={x} y2={y}
                    stroke="#51459d" strokeWidth={1}
                  />
                )}
                <circle cx={x} cy={y} r={3}
                  fill={dp.is_out_of_control ? '#ff3a6e' : '#51459d'} />
              </g>
            )
          })}
          {/* Labels */}
          <text x={5} y={chartHeight + 15} fontSize={10} fill="#888">
            {data_points.length} data points
          </text>
        </svg>
      </div>

      <div className="flex gap-6 text-xs">
        <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#51459d]" /> Mean</div>
        <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#ff3a6e]" style={{ borderTop: '1px dashed' }} /> Control Limits</div>
        <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#ffa21d]" style={{ borderTop: '1px dashed' }} /> Spec Limits</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#ff3a6e]" /> Out of Control</div>
      </div>
    </Card>
  )
}
