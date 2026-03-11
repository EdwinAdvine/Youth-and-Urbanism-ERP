import { useMemo } from 'react'

interface HeatmapChartProps {
  data: { x: string; y: string; value: number }[]
  height?: number
  colorRange?: [string, string, string]
  showValues?: boolean
  formatValue?: (v: number) => string
}

export default function HeatmapChart({
  data,
  height = 300,
  colorRange = ['#e8e0f0', '#9b8cc4', '#51459d'],
  showValues = true,
  formatValue,
}: HeatmapChartProps) {
  const { xLabels, yLabels, grid, minVal, maxVal } = useMemo(() => {
    const xs = [...new Set(data.map((d) => d.x))]
    const ys = [...new Set(data.map((d) => d.y))]
    const lookup: Record<string, number> = {}
    let min = Infinity, max = -Infinity
    for (const d of data) {
      lookup[`${d.x}__${d.y}`] = d.value
      if (d.value < min) min = d.value
      if (d.value > max) max = d.value
    }
    const grid = ys.map((y) => xs.map((x) => lookup[`${x}__${y}`] ?? 0))
    return { xLabels: xs, yLabels: ys, grid, minVal: min === Infinity ? 0 : min, maxVal: max === -Infinity ? 1 : max }
  }, [data])

  const interpolateColor = (value: number) => {
    const range = maxVal - minVal || 1
    const ratio = (value - minVal) / range
    if (ratio < 0.5) {
      const t = ratio * 2
      return lerpColor(colorRange[0], colorRange[1], t)
    }
    const t = (ratio - 0.5) * 2
    return lerpColor(colorRange[1], colorRange[2], t)
  }

  const cellH = yLabels.length > 0 ? (height - 30) / yLabels.length : height - 30

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-2" style={{ height: height - 30, paddingTop: cellH / 2 - 6 }}>
          {yLabels.map((y) => (
            <span key={y} className="text-[10px] text-gray-500 dark:text-gray-400 text-right truncate" style={{ height: cellH, lineHeight: `${cellH}px` }}>
              {y}
            </span>
          ))}
        </div>
        {/* Grid */}
        <div className="flex-1">
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${xLabels.length}, 1fr)` }}>
            {grid.flatMap((row, yi) =>
              row.map((val, xi) => (
                <div
                  key={`${yi}-${xi}`}
                  className="rounded-[4px] flex items-center justify-center transition-colors group relative"
                  style={{
                    backgroundColor: interpolateColor(val),
                    height: Math.max(cellH - 2, 20),
                  }}
                  title={`${xLabels[xi]} / ${yLabels[yi]}: ${formatValue ? formatValue(val) : val}`}
                >
                  {showValues && cellH > 24 && (
                    <span className="text-[9px] font-medium" style={{ color: val > (maxVal + minVal) / 2 ? '#fff' : '#374151' }}>
                      {formatValue ? formatValue(val) : val.toLocaleString()}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
          {/* X-axis labels */}
          <div className="grid mt-1" style={{ gridTemplateColumns: `repeat(${xLabels.length}, 1fr)` }}>
            {xLabels.map((x) => (
              <span key={x} className="text-[10px] text-gray-500 dark:text-gray-400 text-center truncate">
                {x}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}
