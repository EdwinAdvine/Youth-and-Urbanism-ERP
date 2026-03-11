import { ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

interface PieChartProps {
  data: { name: string; value: number; color?: string }[]
  height?: number
  innerRadius?: number
  showLegend?: boolean
  showLabels?: boolean
  formatTooltip?: (value: number) => string
}

const COLORS = ['#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e', '#4a90d9', '#9b59b6', '#e67e22']

const RADIAN = Math.PI / 180
 
function renderLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number
  }
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  if (percent < 0.05) return null
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function PieChart({
  data,
  height = 300,
  innerRadius = 0,
  showLegend = true,
  showLabels = true,
  formatTooltip,
}: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius="80%"
          dataKey="value"
          nameKey="name"
          label={showLabels ? renderLabel : false}
          labelLine={false}
          strokeWidth={2}
          stroke="#fff"
        >
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={entry.color || COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            fontSize: 12,
          }}
          formatter={formatTooltip ? (v: unknown) => [formatTooltip(Number(v))] : undefined}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            iconSize={8}
            layout="vertical"
            align="right"
            verticalAlign="middle"
          />
        )}
      </RPieChart>
    </ResponsiveContainer>
  )
}
