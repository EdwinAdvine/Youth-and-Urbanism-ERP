import { ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

interface BarChartProps {
  data: Record<string, unknown>[]
  bars: { dataKey: string; color?: string; name?: string; stackId?: string }[]
  xKey?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  layout?: 'horizontal' | 'vertical'
  formatTooltip?: (value: number) => string
}

const COLORS = ['#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e']

export default function BarChart({
  data,
  bars,
  xKey = 'name',
  height = 300,
  showGrid = true,
  showLegend = true,
  layout = 'horizontal',
  formatTooltip,
}: BarChartProps) {
  const isVertical = layout === 'vertical'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart
        data={data}
        layout={layout}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
        {isVertical ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis dataKey={xKey} type="category" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={80} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={50} />
          </>
        )}
        <Tooltip
          contentStyle={{
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            fontSize: 12,
          }}
          formatter={formatTooltip ? (v: unknown) => [formatTooltip(Number(v))] : undefined}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" iconSize={10} />}
        {bars.map((bar, i) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            fill={bar.color || COLORS[i % COLORS.length]}
            name={bar.name || bar.dataKey}
            radius={[4, 4, 0, 0]}
            stackId={bar.stackId}
            maxBarSize={40}
          />
        ))}
      </RBarChart>
    </ResponsiveContainer>
  )
}
