interface GaugeChartProps {
  value: number
  max?: number
  min?: number
  label?: string
  unit?: string
  thresholds?: { value: number; color: string; label?: string }[]
  size?: number
}

const DEFAULT_THRESHOLDS = [
  { value: 30, color: '#ff3a6e' },
  { value: 70, color: '#ffa21d' },
  { value: 100, color: '#6fd943' },
]

export default function GaugeChart({
  value,
  max = 100,
  min = 0,
  label,
  unit = '%',
  thresholds = DEFAULT_THRESHOLDS,
  size = 180,
}: GaugeChartProps) {
  const range = max - min
  const pct = Math.min(Math.max((value - min) / range, 0), 1)
  const angle = pct * 180 // 0-180 degrees for semicircle

  const cx = size / 2
  const cy = size / 2 + 10
  const radius = size / 2 - 20
  const strokeWidth = 14

  // Determine color based on thresholds
  let color = thresholds[thresholds.length - 1]?.color || '#6fd943'
  const normalizedVal = pct * 100
  for (const t of thresholds) {
    if (normalizedVal <= t.value) {
      color = t.color
      break
    }
  }

  // Arc path helpers
  const polarToCartesian = (angle: number) => ({
    x: cx + radius * Math.cos((180 + angle) * Math.PI / 180),
    y: cy + radius * Math.sin((180 + angle) * Math.PI / 180),
  })

  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(endAngle)
    const end = polarToCartesian(startAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        {/* Background arc */}
        <path
          d={describeArc(0, 180)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {angle > 0 && (
          <path
            d={describeArc(0, Math.min(angle, 179.5))}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        )}
        {/* Needle dot */}
        {(() => {
          const pos = polarToCartesian(angle)
          return <circle cx={pos.x} cy={pos.y} r={4} fill={color} stroke="#fff" strokeWidth={2} />
        })()}
        {/* Center value */}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100" fontSize={20} fontWeight={700}>
          {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
          <tspan fontSize={11} className="fill-gray-400">{unit}</tspan>
        </text>
        {/* Min/Max labels */}
        <text x={cx - radius} y={cy + 16} textAnchor="middle" fontSize={9} className="fill-gray-400">{min}</text>
        <text x={cx + radius} y={cy + 16} textAnchor="middle" fontSize={9} className="fill-gray-400">{max}</text>
      </svg>
      {label && <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">{label}</p>}
    </div>
  )
}
