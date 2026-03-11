interface FunnelStage {
  name: string
  value: number
  color?: string
}

interface FunnelChartProps {
  data: FunnelStage[]
  height?: number
  showValues?: boolean
  showPercentages?: boolean
  formatValue?: (v: number) => string
}

const COLORS = ['#51459d', '#6f5cb8', '#8d74d3', '#ab8cee', '#c9a4ff', '#e0c4ff', '#f0dcff']

export default function FunnelChart({
  data,
  height = 300,
  showValues = true,
  showPercentages = true,
  formatValue,
}: FunnelChartProps) {
  if (data.length === 0) return null

  const maxVal = data[0]?.value || 1
  const stageHeight = (height - 20) / data.length

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex flex-col items-center gap-1">
        {data.map((stage, i) => {
          const widthPct = Math.max(20, (stage.value / maxVal) * 100)
          const convRate = i > 0 && data[i - 1].value > 0
            ? ((stage.value / data[i - 1].value) * 100).toFixed(1)
            : null

          return (
            <div key={stage.name} className="w-full flex items-center gap-3">
              <div className="flex-1 flex justify-center">
                <div
                  className="rounded-[6px] flex items-center justify-center transition-all duration-300 hover:opacity-90 relative"
                  style={{
                    width: `${widthPct}%`,
                    height: Math.max(stageHeight - 4, 28),
                    backgroundColor: stage.color || COLORS[i % COLORS.length],
                  }}
                >
                  <div className="flex items-center gap-2 px-3">
                    <span className="text-white text-xs font-medium truncate">{stage.name}</span>
                    {showValues && (
                      <span className="text-white/80 text-[10px]">
                        {formatValue ? formatValue(stage.value) : stage.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {showPercentages && (
                <div className="w-16 text-right">
                  {convRate !== null ? (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {convRate}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300">-</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
