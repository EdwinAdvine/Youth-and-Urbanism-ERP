/**
 * DashboardFilterContext — Powers cross-filtering between dashboard widgets.
 *
 * When a user clicks a data point in Chart A, the filter propagates to all
 * other widgets on the same dashboard. This creates the Power BI-style
 * interactive filtering experience.
 *
 * Usage:
 *   <DashboardFilterProvider>
 *     <Widget onDataClick={handleClick} />
 *     <Widget filters={activeFilters} />
 *   </DashboardFilterProvider>
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface DashboardFilter {
  sourceWidgetId: string
  dimension: string
  value: string | number
  operator: 'eq' | 'in' | 'between'
}

export interface FilterState {
  filters: DashboardFilter[]
  globalDateRange?: { start: string; end: string }
  globalModule?: string
}

interface DashboardFilterContextValue {
  filterState: FilterState
  activeFilters: DashboardFilter[]
  globalDateRange: { start: string; end: string } | undefined
  globalModule: string | undefined
  addFilter: (filter: DashboardFilter) => void
  removeFilter: (sourceWidgetId: string, dimension?: string) => void
  clearFilters: () => void
  setGlobalDateRange: (range: { start: string; end: string } | undefined) => void
  setGlobalModule: (module: string | undefined) => void
  getFiltersForWidget: (widgetId: string) => DashboardFilter[]
  buildFilterSQL: (widgetId: string) => string
}

const DashboardFilterContext = createContext<DashboardFilterContextValue | null>(null)

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [filterState, setFilterState] = useState<FilterState>({ filters: [] })

  const addFilter = useCallback((filter: DashboardFilter) => {
    setFilterState(prev => {
      // Remove existing filter from same source + dimension, then add new
      const remaining = prev.filters.filter(
        f => !(f.sourceWidgetId === filter.sourceWidgetId && f.dimension === filter.dimension)
      )
      return { ...prev, filters: [...remaining, filter] }
    })
  }, [])

  const removeFilter = useCallback((sourceWidgetId: string, dimension?: string) => {
    setFilterState(prev => ({
      ...prev,
      filters: prev.filters.filter(f =>
        dimension
          ? !(f.sourceWidgetId === sourceWidgetId && f.dimension === dimension)
          : f.sourceWidgetId !== sourceWidgetId
      ),
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilterState({ filters: [], globalDateRange: undefined, globalModule: undefined })
  }, [])

  const setGlobalDateRange = useCallback((range: { start: string; end: string } | undefined) => {
    setFilterState(prev => ({ ...prev, globalDateRange: range }))
  }, [])

  const setGlobalModule = useCallback((module: string | undefined) => {
    setFilterState(prev => ({ ...prev, globalModule: module }))
  }, [])

  const getFiltersForWidget = useCallback((widgetId: string): DashboardFilter[] => {
    // Return all filters EXCEPT those from the widget itself (to avoid self-filtering)
    return filterState.filters.filter(f => f.sourceWidgetId !== widgetId)
  }, [filterState.filters])

  const buildFilterSQL = useCallback((widgetId: string): string => {
    const filters = getFiltersForWidget(widgetId)
    if (filters.length === 0) return ''

    const clauses = filters.map(f => {
      const safeVal = typeof f.value === 'string' ? `'${f.value.replace(/'/g, "''")}'` : f.value
      return `${f.dimension} = ${safeVal}`
    })
    return ` AND ${clauses.join(' AND ')}`
  }, [getFiltersForWidget])

  const value = useMemo<DashboardFilterContextValue>(() => ({
    filterState,
    activeFilters: filterState.filters,
    globalDateRange: filterState.globalDateRange,
    globalModule: filterState.globalModule,
    addFilter,
    removeFilter,
    clearFilters,
    setGlobalDateRange,
    setGlobalModule,
    getFiltersForWidget,
    buildFilterSQL,
  }), [filterState, addFilter, removeFilter, clearFilters, setGlobalDateRange, setGlobalModule, getFiltersForWidget, buildFilterSQL])

  return (
    <DashboardFilterContext.Provider value={value}>
      {children}
    </DashboardFilterContext.Provider>
  )
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardFilterContext)
  if (!ctx) {
    throw new Error('useDashboardFilters must be used within a DashboardFilterProvider')
  }
  return ctx
}

export default DashboardFilterContext
