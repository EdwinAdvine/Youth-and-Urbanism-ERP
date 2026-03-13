import { useState, useCallback } from 'react'
import type { CalendarSource } from './MultiCalendarSidebar'

// ── Types ───────────────────────────────────────────────────────────────────

interface OverlayCalendar extends CalendarSource {
  opacity: number // 0-100
}

interface CalendarOverlayProps {
  calendars: CalendarSource[]
  onChange: (calendars: CalendarSource[]) => void
  /** Called when overlay opacity changes (for rendering events with opacity) */
  onOverlayChange?: (overlays: Record<string, number>) => void
}

const STORAGE_KEY = 'era-calendar-overlays'

function getStoredOpacities(): Record<string, number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CalendarOverlay({
  calendars,
  onChange,
  onOverlayChange,
}: CalendarOverlayProps) {
  const [opacities, setOpacities] = useState<Record<string, number>>(getStoredOpacities)
  const [overlayMode, setOverlayMode] = useState(false)

  const overlayCalendars: OverlayCalendar[] = calendars.map(cal => ({
    ...cal,
    opacity: opacities[cal.id] ?? (cal.enabled ? 100 : 0),
  }))

  const updateOpacity = useCallback((id: string, value: number) => {
    const updated = { ...opacities, [id]: value }
    setOpacities(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    onOverlayChange?.(updated)
  }, [opacities, onOverlayChange])

  const toggle = (id: string) => {
    const updated = calendars.map(c =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    )
    onChange(updated)
  }

  const toggleOverlayMode = () => {
    setOverlayMode(!overlayMode)
  }

  const enabledCount = calendars.filter(c => c.enabled).length

  return (
    <div>
      {/* Header with overlay toggle */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          My Calendars
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{enabledCount}/{calendars.length}</span>
          <button
            onClick={toggleOverlayMode}
            title={overlayMode ? 'Hide opacity controls' : 'Show overlay controls'}
            className={`p-0.5 rounded transition-colors ${
              overlayMode
                ? 'text-[#51459d] bg-[#51459d]/10'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar list */}
      <div className="space-y-0.5">
        {overlayCalendars.map(cal => (
          <div key={cal.id} className="group">
            <button
              onClick={() => toggle(cal.id)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              {/* Color swatch with opacity */}
              <div
                className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-colors ${
                  cal.enabled ? 'border-transparent' : 'border-gray-300'
                }`}
                style={
                  cal.enabled
                    ? {
                        backgroundColor: cal.color,
                        opacity: overlayMode ? (cal.opacity / 100) : 1,
                      }
                    : undefined
                }
              >
                {cal.enabled && (
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Name + opacity badge */}
              <span className={`text-xs flex-1 transition-colors ${
                cal.enabled ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-400'
              }`}>
                {cal.name}
              </span>

              {overlayMode && cal.enabled && (
                <span className="text-[9px] text-gray-400 tabular-nums">
                  {cal.opacity}%
                </span>
              )}
            </button>

            {/* Opacity slider — only shown in overlay mode for enabled calendars */}
            {overlayMode && cal.enabled && (
              <div className="px-2 pb-1.5 flex items-center gap-2">
                <div className="w-4" /> {/* Spacer to align with checkbox */}
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={cal.opacity}
                  onChange={e => updateOpacity(cal.id, parseInt(e.target.value))}
                  className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${cal.color}20 0%, ${cal.color} 100%)`,
                    accentColor: cal.color,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Color legend for overlay mode */}
      {overlayMode && enabledCount > 1 && (
        <div className="mt-3 px-2">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1.5">Overlay Preview</p>
          <div className="relative h-8 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {overlayCalendars
              .filter(c => c.enabled)
              .map((cal, idx, arr) => (
                <div
                  key={cal.id}
                  className="absolute inset-0 rounded-lg"
                  style={{
                    backgroundColor: cal.color,
                    opacity: cal.opacity / 100,
                    zIndex: idx,
                    // Offset each layer slightly to show the blend
                    left: `${(idx / arr.length) * 20}%`,
                    right: `${((arr.length - 1 - idx) / arr.length) * 20}%`,
                  }}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
