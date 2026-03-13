/**
 * MobileDashboardViewer — full-screen swipeable dashboard viewer for mobile.
 * Shows one widget per page with touch swipe navigation.
 * Only shown on screens < 768px width.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import ChartRenderer, { type ChartType } from '../../../components/charts/ChartRenderer'
import type { DashboardWidget } from '../../../api/analytics_ext'

interface MobileDashboardViewerProps {
  widgets: DashboardWidget[]
  dashboardName: string
  onClose: () => void
}

const SAMPLE_DATA: Record<string, Record<string, unknown>[]> = {
  'finance.revenue': [{ month: 'Jan', value: 450000 }, { month: 'Feb', value: 520000 }, { month: 'Mar', value: 480000 }],
  'crm.pipeline': [{ stage: 'Lead', count: 45 }, { stage: 'Qualified', count: 32 }, { stage: 'Won', count: 5 }],
  'hr.headcount': [{ dept: 'Engineering', count: 45 }, { dept: 'Sales', count: 22 }],
}

function getDefaultData(): Record<string, unknown>[] {
  return [{ name: 'A', value: 40 }, { name: 'B', value: 65 }, { name: 'C', value: 30 }]
}

export default function MobileDashboardViewer({ widgets, dashboardName, onClose }: MobileDashboardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const touchStartX = useRef<number>(0)

  const total = widgets.length

  const goNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1 < total ? prev + 1 : prev))
  }, [total])

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev))
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (delta > 50) goNext()
    else if (delta < -50) goPrev()
  }, [goNext, goPrev])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, onClose])

  const widget = widgets[currentIndex]
  const widgetData = widget
    ? (SAMPLE_DATA[widget.data_source as string] ?? getDefaultData())
    : getDefaultData()

  return (
    <div
      className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{dashboardName}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {currentIndex + 1} / {total}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {widget && (
          <>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {widget.title}
            </p>
            <div className="flex-1">
              <ChartRenderer
                type={(widget.chart_type || 'bar') as ChartType}
                data={widgetData}
                height="100%"
              />
            </div>
          </>
        )}
        {!widget && (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            No widgets available
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between px-4 pb-4">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Prev
        </button>

        {/* Dots */}
        <div className="flex gap-2 justify-center py-3">
          {widgets.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? 'bg-[#51459d]' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={`Go to widget ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={currentIndex === total - 1}
          className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Next
        </button>
      </div>
    </div>
  )
}
