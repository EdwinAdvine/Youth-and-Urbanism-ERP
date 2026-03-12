import { useState } from 'react'
import { useChartPresets, useGenerateChart, type ChartPreset, type ChartData } from '../../api/docs'

const MODULE_COLORS: Record<string, string> = {
  finance: 'bg-green-50 border-green-200 text-green-700',
  hr: 'bg-blue-50 border-blue-200 text-blue-700',
  crm: 'bg-pink-50 border-pink-200 text-pink-700',
  projects: 'bg-purple-50 border-purple-200 text-purple-700',
  support: 'bg-amber-50 border-amber-200 text-amber-700',
  pos: 'bg-orange-50 border-orange-200 text-orange-700',
  inventory: 'bg-teal-50 border-teal-200 text-teal-700',
}

interface ChartInsertDialogProps {
  open: boolean
  onClose: () => void
  onInsert?: (chartData: ChartData) => void
}

export default function ChartInsertDialog({ open, onClose, onInsert }: ChartInsertDialogProps) {
  const { data: presetsData } = useChartPresets()
  const generateMut = useGenerateChart()
  const [selected, setSelected] = useState<ChartPreset | null>(null)
  const [generatedChart, setGeneratedChart] = useState<ChartData | null>(null)

  if (!open) return null

  const presets = presetsData?.charts ?? []

  const handleGenerate = async (preset: ChartPreset) => {
    setSelected(preset)
    const result = await generateMut.mutateAsync({ chart_id: preset.id })
    setGeneratedChart(result)
  }

  const handleInsert = () => {
    if (generatedChart) {
      onInsert?.(generatedChart)
      setSelected(null)
      setGeneratedChart(null)
      onClose()
    }
  }

  const maxVal = generatedChart ? Math.max(...(generatedChart.datasets[0]?.data || [1])) : 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#51459d]/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {generatedChart ? 'Chart Preview' : 'Insert ERP Chart'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!generatedChart ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">Select a chart to generate from live ERP data.</p>
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleGenerate(p)}
                  disabled={generateMut.isPending && selected?.id === p.id}
                  className="w-full flex items-center gap-3 p-3 rounded-[8px] border border-gray-100 dark:border-gray-700 hover:border-[#51459d]/30 hover:bg-[#51459d]/5 transition-all text-left disabled:opacity-50"
                >
                  <div className={`w-9 h-9 rounded-[6px] border flex items-center justify-center text-[10px] font-bold shrink-0 ${MODULE_COLORS[p.module] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                    {p.chart_type === 'bar' ? '|||' : p.chart_type === 'pie' ? 'O' : p.chart_type === 'line' ? '~' : '|||'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.description}</p>
                  </div>
                  <span className="text-[9px] font-medium uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-full shrink-0">
                    {p.chart_type}
                  </span>
                  {generateMut.isPending && selected?.id === p.id && (
                    <svg className="animate-spin h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => { setGeneratedChart(null); setSelected(null) }}
                className="flex items-center gap-1 text-xs text-[#51459d] hover:underline"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to charts
              </button>

              {/* Simple bar chart preview */}
              <div className="bg-gray-50 dark:bg-gray-950 rounded-[8px] p-4">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{generatedChart.title}</h4>
                <div className="space-y-1.5">
                  {generatedChart.labels.map((label, i) => {
                    const val = generatedChart.datasets[0]?.data[i] || 0
                    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-20 truncate text-right">{label}</span>
                        <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-700 rounded-[4px] overflow-hidden">
                          <div
                            className="h-full bg-[#51459d] rounded-[4px] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 w-16 text-right">
                          {typeof val === 'number' && val > 1000 ? `${(val / 1000).toFixed(1)}K` : val}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <p className="text-[10px] text-gray-400 text-center">
                {generatedChart.datasets[0]?.data.length || 0} data points from live ERP data
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {generatedChart && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 shrink-0">
            <button
              onClick={() => { setGeneratedChart(null); setSelected(null) }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
            >
              Insert Chart
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
