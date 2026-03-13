import { ResponsiveContainer, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useIsMobile } from '../../hooks/useMediaQuery'

interface LineChartProps {
  data: Record<string, unknown>[]
  lines: { dataKey: string; color?: string; name?: string; strokeDasharray?: string }[]
  xKey?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  formatTooltip?: (value: number) => string
  formatXAxis?: (value: string) => string
}

const COLORS = ['#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e']

export default function LineChart({
  data,
  lines,
  xKey = 'name',
  height = 300,
  showGrid = true,
  showLegend = true,
  formatTooltip,
  formatXAxis,
}: LineChartProps) {
  const isMobile = useIsMobile()
  const tickSize = isMobile ? 10 : 11
  const legendSize = isMobile ? 10 : 12

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RLineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: tickSize, fill: '#9ca3af' }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickLine={false}
          tickFormatter={formatXAxis}
        />
        <YAxis
          tick={{ fontSize: tickSize, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
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
            wrapperStyle={{ fontSize: legendSize }}
            iconType="circle"
            iconSize={8}
          />
        )}
        {lines.map((line, i) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color || COLORS[i % COLORS.length]}
            name={line.name || line.dataKey}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            strokeDasharray={line.strokeDasharray}
          />
        ))}
      </RLineChart>
    </ResponsiveContainer>
  )
}
