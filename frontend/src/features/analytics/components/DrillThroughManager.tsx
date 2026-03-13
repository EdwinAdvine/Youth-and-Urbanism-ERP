/**
 * DrillThroughManager — Reusable drill-through navigation for analytics charts.
 *
 * Maps data sources to ERP operational pages and provides:
 * - Route resolution from data source identifiers
 * - Filter parameter encoding for drill-through navigation
 * - Drill-through popup with preview before navigating
 * - Breadcrumb trail for returning from drill-through
 */
import { useCallback, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// ── Route mapping: data source → ERP page ────────────────────────────────────

export const DRILL_ROUTES: Record<string, { path: string; label: string; module: string }> = {
  // Finance
  'finance.revenue':        { path: '/finance/invoices',       label: 'Invoices',           module: 'Finance' },
  'finance.expenses':       { path: '/finance/expenses',       label: 'Expenses',           module: 'Finance' },
  'finance.invoices':       { path: '/finance/invoices',       label: 'Invoices',           module: 'Finance' },
  'finance.journal':        { path: '/finance/journal',        label: 'Journal Entries',    module: 'Finance' },
  'finance.accounts':       { path: '/finance/accounts',       label: 'Chart of Accounts',  module: 'Finance' },
  // HR
  'hr.headcount':           { path: '/hr/employees',           label: 'Employees',          module: 'HR' },
  'hr.attendance':          { path: '/hr/attendance',          label: 'Attendance',         module: 'HR' },
  'hr.payroll':             { path: '/hr/payroll',             label: 'Payroll',            module: 'HR' },
  'hr.leave':               { path: '/hr/leave',               label: 'Leave Requests',     module: 'HR' },
  // CRM
  'crm.pipeline':           { path: '/crm/deals',             label: 'Deals',              module: 'CRM' },
  'crm.deals':              { path: '/crm/deals',             label: 'Deals',              module: 'CRM' },
  'crm.contacts':           { path: '/crm/contacts',          label: 'Contacts',           module: 'CRM' },
  'crm.companies':          { path: '/crm/companies',         label: 'Companies',          module: 'CRM' },
  // Projects
  'projects.tasks':         { path: '/projects',              label: 'Projects',           module: 'Projects' },
  'projects.milestones':    { path: '/projects',              label: 'Projects',           module: 'Projects' },
  // Inventory
  'inventory.stock':        { path: '/inventory/products',    label: 'Products',           module: 'Inventory' },
  'inventory.movements':    { path: '/inventory/movements',   label: 'Stock Movements',    module: 'Inventory' },
  // Support
  'support.tickets':        { path: '/support/tickets',       label: 'Tickets',            module: 'Support' },
  // POS
  'pos.transactions':       { path: '/pos/history',           label: 'Transaction History', module: 'POS' },
  'pos.products':           { path: '/pos/products',          label: 'POS Products',       module: 'POS' },
  // E-Commerce
  'ecommerce.orders':       { path: '/ecommerce/orders',      label: 'Orders',             module: 'E-Commerce' },
  'ecommerce.products':     { path: '/ecommerce/products',    label: 'Products',           module: 'E-Commerce' },
  // Manufacturing
  'manufacturing.work_orders': { path: '/manufacturing/work-orders', label: 'Work Orders', module: 'Manufacturing' },
}

// ── Filter encoding ──────────────────────────────────────────────────────────

export interface DrillFilter {
  dimension: string
  value: string
  operator?: 'eq' | 'in' | 'gte' | 'lte' | 'between'
}

/**
 * Encode drill-through filters into URL search params.
 * Example: ?drill_dimension=month&drill_value=Jan&drill_op=eq
 */
export function encodeDrillFilters(filters: DrillFilter[]): string {
  if (!filters.length) return ''
  const params = new URLSearchParams()
  filters.forEach((f, i) => {
    const prefix = i === 0 ? 'drill' : `drill_${i}`
    params.set(`${prefix}_dimension`, f.dimension)
    params.set(`${prefix}_value`, f.value)
    if (f.operator && f.operator !== 'eq') params.set(`${prefix}_op`, f.operator)
  })
  return `?${params.toString()}`
}

/**
 * Decode drill-through filters from current URL search params.
 */
export function decodeDrillFilters(search: string): DrillFilter[] {
  const params = new URLSearchParams(search)
  const filters: DrillFilter[] = []

  // Check for primary filter (drill_dimension)
  const dim0 = params.get('drill_dimension')
  if (dim0) {
    filters.push({
      dimension: dim0,
      value: params.get('drill_value') || '',
      operator: (params.get('drill_op') as DrillFilter['operator']) || 'eq',
    })
  }

  // Check for additional filters (drill_1_dimension, drill_2_dimension, ...)
  for (let i = 1; i < 10; i++) {
    const dim = params.get(`drill_${i}_dimension`)
    if (!dim) break
    filters.push({
      dimension: dim,
      value: params.get(`drill_${i}_value`) || '',
      operator: (params.get(`drill_${i}_op`) as DrillFilter['operator']) || 'eq',
    })
  }

  return filters
}

// ── Hook: useDrillThrough ────────────────────────────────────────────────────

export function useDrillThrough() {
  const navigate = useNavigate()
  const location = useLocation()

  /**
   * Navigate to an ERP page with drill-through filters applied.
   */
  const drillTo = useCallback(
    (dataSource: string, filters?: DrillFilter[]) => {
      const route = DRILL_ROUTES[dataSource]
      if (!route) return false

      const filterParams = filters?.length ? encodeDrillFilters(filters) : ''
      // Preserve return path for breadcrumb
      const returnPath = encodeURIComponent(location.pathname + location.search)
      const separator = filterParams ? '&' : '?'
      navigate(`${route.path}${filterParams}${separator}drill_return=${returnPath}`)
      return true
    },
    [navigate, location],
  )

  /**
   * Get the drill-through route info for a data source (without navigating).
   */
  const getRoute = useCallback((dataSource: string) => DRILL_ROUTES[dataSource] || null, [])

  /**
   * Check if drill-through is available for a data source.
   */
  const hasDrillThrough = useCallback((dataSource: string) => dataSource in DRILL_ROUTES, [])

  return { drillTo, getRoute, hasDrillThrough }
}

// ── Component: DrillThroughBreadcrumb ────────────────────────────────────────

/**
 * Shows a "Back to dashboard" breadcrumb when the user arrived via drill-through.
 * Place this at the top of ERP list pages.
 */
export function DrillThroughBreadcrumb() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const returnPath = params.get('drill_return')

  if (!returnPath) return null

  const decoded = decodeURIComponent(returnPath)
  const filters = decodeDrillFilters(location.search)

  return (
    <div className="flex items-center gap-2 px-4 py-2 mb-3 rounded-lg bg-[#51459d]/5 border border-[#51459d]/10">
      <button
        onClick={() => navigate(decoded)}
        className="flex items-center gap-1.5 text-xs text-[#51459d] hover:text-[#51459d]/80 transition-colors font-medium"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>
      {filters.length > 0 && (
        <span className="text-xs text-gray-400">
          | Filtered by: {filters.map(f => `${f.dimension} = ${f.value}`).join(', ')}
        </span>
      )}
    </div>
  )
}

// ── Component: DrillThroughPopup ─────────────────────────────────────────────

interface DrillThroughPopupProps {
  dataSource: string
  clickedData: { name: string; value: unknown } | null
  position: { x: number; y: number } | null
  onClose: () => void
  onDrill: (filters: DrillFilter[]) => void
}

/**
 * Small popup that appears when clicking a chart data point, offering
 * drill-through navigation with the clicked value as a filter.
 */
export function DrillThroughPopup({ dataSource, clickedData, position, onClose, onDrill }: DrillThroughPopupProps) {
  const route = DRILL_ROUTES[dataSource]
  if (!route || !clickedData || !position) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Popup */}
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[200px] animate-in fade-in zoom-in-95 duration-150"
        style={{ left: position.x, top: position.y }}
      >
        <p className="text-xs text-gray-500 mb-2">
          {clickedData.name}: <span className="font-medium text-gray-900 dark:text-white">{String(clickedData.value)}</span>
        </p>
        <button
          onClick={() => {
            onDrill([{ dimension: clickedData.name, value: String(clickedData.value) }])
            onClose()
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-[#3ec9d6]/10 text-[#3ec9d6] hover:bg-[#3ec9d6]/20 transition-colors font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Drill through to {route.label}
        </button>
        <p className="text-[10px] text-gray-400 mt-1.5">{route.module} &middot; {route.path}</p>
      </div>
    </>
  )
}

// ── Hook: useChartDrillThrough (combines popup + navigation) ─────────────────

export function useChartDrillThrough(dataSource: string) {
  const { drillTo } = useDrillThrough()
  const [popup, setPopup] = useState<{
    data: { name: string; value: unknown }
    position: { x: number; y: number }
  } | null>(null)

  const handleChartClick = useCallback((params: { name: string; value: unknown; event?: { offsetX?: number; offsetY?: number } }) => {
    setPopup({
      data: { name: params.name, value: params.value },
      position: {
        x: (params.event?.offsetX ?? 200) + 16,
        y: (params.event?.offsetY ?? 200) + 16,
      },
    })
  }, [])

  const handleDrill = useCallback(
    (filters: DrillFilter[]) => {
      drillTo(dataSource, filters)
    },
    [drillTo, dataSource],
  )

  const closePopup = useCallback(() => setPopup(null), [])

  const PopupElement = popup ? (
    <DrillThroughPopup
      dataSource={dataSource}
      clickedData={popup.data}
      position={popup.position}
      onClose={closePopup}
      onDrill={handleDrill}
    />
  ) : null

  return { handleChartClick, PopupElement, closePopup }
}
