/**
 * SlicerPanel — global slicer/filter pane for dashboard pages.
 *
 * A collapsible side panel that lets users add, edit, and remove
 * cross-dashboard filters. Works with DashboardFilterContext to
 * propagate selections to all widgets on the page.
 */
import { useState } from 'react'
import { useDashboardFilters, type DashboardFilter } from '../context/DashboardFilterContext'

type FilterOperator = DashboardFilter['operator']

interface SlicerConfig {
  label: string
  dimension: string
  type: 'date_range' | 'text' | 'number' | 'select'
  options?: string[]
}

const COMMON_SLICERS: SlicerConfig[] = [
  { label: 'Date Range', dimension: 'date', type: 'date_range' },
  { label: 'Module', dimension: 'module', type: 'select', options: ['Finance', 'HR', 'CRM', 'Projects', 'Inventory', 'Support', 'E-Commerce', 'POS'] },
  { label: 'Status', dimension: 'status', type: 'select', options: ['active', 'inactive', 'pending', 'completed', 'cancelled', 'draft'] },
  { label: 'Priority', dimension: 'priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
]

interface SlicerPanelProps {
  open: boolean
  onClose: () => void
}

export default function SlicerPanel({ open, onClose }: SlicerPanelProps) {
  const { activeFilters, addFilter, removeFilter, clearFilters, globalDateRange, setGlobalDateRange } = useDashboardFilters()
  const [customDimension, setCustomDimension] = useState('')
  const [customValue, setCustomValue] = useState('')
  const [customOperator, setCustomOperator] = useState<FilterOperator>('eq')

  const handleAddCustom = () => {
    if (!customDimension.trim() || !customValue.trim()) return
    addFilter({
      sourceWidgetId: 'slicer',
      dimension: customDimension.trim(),
      value: customValue.trim(),
      operator: customOperator,
    })
    setCustomDimension('')
    setCustomValue('')
  }

  const handleSelectSlicer = (config: SlicerConfig, value: string) => {
    // Remove existing filter for this dimension from slicer
    const existing = activeFilters.find(f => f.sourceWidgetId === 'slicer' && f.dimension === config.dimension)
    if (existing) removeFilter(existing.sourceWidgetId, existing.dimension)

    if (value) {
      addFilter({
        sourceWidgetId: 'slicer',
        dimension: config.dimension,
        value,
        operator: 'eq',
      })
    }
  }

  if (!open) return null

  return (
    <>
      {/* Mobile backdrop */}
      <div className="fixed inset-0 z-20 bg-black/20 lg:hidden" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-72 z-30 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Filters</span>
            {activeFilters.length > 0 && (
              <span className="text-[10px] bg-[#51459d] text-white rounded-full px-1.5 py-0.5">{activeFilters.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilters.length > 0 && (
              <button onClick={clearFilters} className="text-[10px] text-[#ff3a6e] hover:underline">Clear all</button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Global Date Range */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date Range</label>
            <div className="space-y-1.5">
              <input
                type="date"
                className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/20"
                value={globalDateRange?.start || ''}
                onChange={e => setGlobalDateRange({ start: e.target.value, end: globalDateRange?.end || '' })}
                placeholder="From"
              />
              <input
                type="date"
                className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/20"
                value={globalDateRange?.end || ''}
                onChange={e => setGlobalDateRange({ start: globalDateRange?.start || '', end: e.target.value })}
                placeholder="To"
              />
            </div>
          </div>

          {/* Quick Slicers */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Filters</label>
            <div className="space-y-2">
              {COMMON_SLICERS.filter(s => s.type === 'select').map(config => {
                const active = activeFilters.find(f => f.sourceWidgetId === 'slicer' && f.dimension === config.dimension)
                return (
                  <div key={config.dimension}>
                    <label className="block text-[10px] text-gray-400 mb-1">{config.label}</label>
                    <select
                      className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/20"
                      value={active?.value || ''}
                      onChange={e => handleSelectSlicer(config, e.target.value)}
                    >
                      <option value="">All</option>
                      {config.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Custom Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Custom Filter</label>
            <div className="space-y-2">
              <input
                className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/20"
                placeholder="Field (e.g. customer_name)"
                value={customDimension}
                onChange={e => setCustomDimension(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  className="text-xs px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
                  value={customOperator}
                  onChange={e => setCustomOperator(e.target.value as FilterOperator)}
                >
                  <option value="eq">equals</option>
                  <option value="in">contains</option>
                </select>
                <input
                  className="text-xs px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
                  placeholder="Value"
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                />
              </div>
              <button
                onClick={handleAddCustom}
                disabled={!customDimension.trim() || !customValue.trim()}
                className="w-full text-xs py-2 rounded-lg bg-[#51459d] text-white hover:bg-[#51459d]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Filter
              </button>
            </div>
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Active Filters</label>
              <div className="space-y-1.5">
                {activeFilters.map((f, i) => (
                  <div
                    key={`${f.dimension}-${f.value}-${i}`}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#51459d]/5 border border-[#51459d]/10"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-medium text-[#51459d] mr-1">{f.dimension}</span>
                      <span className="text-[10px] text-gray-400">{f.operator}</span>
                      <span className="text-[10px] text-gray-700 dark:text-gray-300 ml-1 truncate block">{f.value}</span>
                    </div>
                    <button
                      onClick={() => removeFilter(f.sourceWidgetId, f.dimension)}
                      className="text-gray-300 hover:text-[#ff3a6e] transition-colors ml-2 shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
