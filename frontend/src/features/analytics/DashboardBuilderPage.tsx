/**
 * DashboardBuilderPage — Drag-and-drop dashboard designer with ECharts,
 * cross-filtering, drill-through, and Copilot integration.
 *
 * Uses react-grid-layout for drag/drop/resize and the new ChartRenderer
 * for all visualizations. Supports 20+ chart types.
 */
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import RGL from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { useBreakpoint } from '../../hooks/useMediaQuery'

type Layout = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number }
import { Button, Input, Select, Modal, Spinner, toast } from '../../components/ui'
import {
  useDashboard, useUpdateDashboard, useDashboardWidgets,
  useCreateWidget, useUpdateWidget, useDeleteWidget,
  type DashboardWidget,
} from '../../api/analytics_ext'
import ChartRenderer, { type ChartType } from '../../components/charts/ChartRenderer'
import CopilotPanel from './components/CopilotPanel'
import BookmarkPanel from './components/BookmarkPanel'
import SlicerPanel from './components/SlicerPanel'
import { DashboardFilterProvider, useDashboardFilters } from './context/DashboardFilterContext'
import { useDashboardBuilderStore } from '../../store/dashboardBuilder'

// react-grid-layout WidthProvider — access via default export's static method
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactGridLayout = (RGL as any).WidthProvider ? (RGL as any).WidthProvider(RGL) : RGL

type WidgetForm = {
  title: string
  widget_type: string
  chart_type: string
  data_source: string
  config: string
  drill_through_route: string
}

const emptyForm: WidgetForm = {
  title: '', widget_type: 'chart', chart_type: 'bar',
  data_source: '', config: '{}', drill_through_route: '',
}

const WIDGET_TYPES = [
  { value: 'chart', label: 'Chart' },
  { value: 'kpi', label: 'KPI Card' },
  { value: 'table', label: 'Data Table' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'text', label: 'Text / Note' },
]

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'donut', label: 'Donut Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
  { value: 'radar', label: 'Radar Chart' },
  { value: 'funnel', label: 'Funnel Chart' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'treemap', label: 'Treemap' },
  { value: 'sankey', label: 'Sankey Diagram' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'waterfall', label: 'Waterfall' },
  { value: 'combo', label: 'Combo (Bar + Line)' },
  { value: 'boxplot', label: 'Box Plot' },
  { value: 'histogram', label: 'Histogram' },
  { value: 'sparkline', label: 'Sparkline' },
  { value: 'candlestick', label: 'Candlestick' },
  { value: 'bullet', label: 'Bullet Chart' },
]

const DATA_SOURCES = [
  { value: 'finance.revenue', label: 'Finance - Revenue' },
  { value: 'finance.expenses', label: 'Finance - Expenses' },
  { value: 'finance.invoices', label: 'Finance - Invoices' },
  { value: 'hr.headcount', label: 'HR - Headcount' },
  { value: 'hr.attendance', label: 'HR - Attendance' },
  { value: 'crm.pipeline', label: 'CRM - Pipeline' },
  { value: 'crm.deals', label: 'CRM - Deals' },
  { value: 'inventory.stock', label: 'Inventory - Stock Levels' },
  { value: 'support.tickets', label: 'Support - Tickets' },
  { value: 'projects.tasks', label: 'Projects - Tasks' },
  { value: 'pos.transactions', label: 'POS - Transactions' },
  { value: 'ecommerce.orders', label: 'E-Commerce - Orders' },
  { value: 'manufacturing.work_orders', label: 'Manufacturing - Work Orders' },
]

// Drill-through route mapping — click a data point → navigate to ERP page
const DRILL_THROUGH_ROUTES: Record<string, string> = {
  'finance.revenue': '/finance/invoices',
  'finance.expenses': '/finance/expenses',
  'finance.invoices': '/finance/invoices',
  'hr.headcount': '/hr/employees',
  'crm.pipeline': '/crm/deals',
  'crm.deals': '/crm/deals',
  'inventory.stock': '/inventory/products',
  'support.tickets': '/support/tickets',
  'projects.tasks': '/projects',
  'pos.transactions': '/pos/history',
  'ecommerce.orders': '/ecommerce/orders',
}

// ── SAMPLE DATA for preview (real data comes from API in production) ────────
const SAMPLE_DATA: Record<string, Record<string, unknown>[]> = {
  'finance.revenue': [
    { month: 'Jan', revenue: 450000, target: 400000 },
    { month: 'Feb', revenue: 520000, target: 450000 },
    { month: 'Mar', revenue: 480000, target: 500000 },
    { month: 'Apr', revenue: 610000, target: 550000 },
    { month: 'May', revenue: 580000, target: 600000 },
    { month: 'Jun', revenue: 720000, target: 650000 },
  ],
  'finance.expenses': [
    { category: 'Payroll', amount: 250000 },
    { category: 'Rent', amount: 80000 },
    { category: 'Marketing', amount: 45000 },
    { category: 'IT', amount: 35000 },
    { category: 'Travel', amount: 20000 },
  ],
  'crm.pipeline': [
    { stage: 'Lead', count: 45, value: 2500000 },
    { stage: 'Qualified', count: 32, value: 1800000 },
    { stage: 'Proposal', count: 18, value: 1200000 },
    { stage: 'Negotiation', count: 8, value: 800000 },
    { stage: 'Won', count: 5, value: 500000 },
  ],
  'hr.headcount': [
    { department: 'Engineering', count: 45 },
    { department: 'Sales', count: 22 },
    { department: 'Marketing', count: 15 },
    { department: 'HR', count: 8 },
    { department: 'Finance', count: 12 },
    { department: 'Operations', count: 18 },
  ],
  'support.tickets': [
    { month: 'Jan', open: 23, resolved: 45, pending: 8 },
    { month: 'Feb', open: 18, resolved: 52, pending: 5 },
    { month: 'Mar', open: 31, resolved: 38, pending: 12 },
    { month: 'Apr', open: 15, resolved: 55, pending: 3 },
    { month: 'May', open: 22, resolved: 48, pending: 7 },
    { month: 'Jun', open: 19, resolved: 61, pending: 4 },
  ],
}

function getDefaultSample(): Record<string, unknown>[] {
  return [
    { name: 'A', value: 40 },
    { name: 'B', value: 65 },
    { name: 'C', value: 30 },
    { name: 'D', value: 85 },
    { name: 'E', value: 55 },
  ]
}

// ── Inner builder (needs filter context) ────────────────────────────────────

function DashboardBuilderInner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: dashboard, isLoading: dashLoading } = useDashboard(id || '')
  const { data: widgets, isLoading: widgetsLoading } = useDashboardWidgets(id || '')
  const updateDashboard = useUpdateDashboard()
  const createWidget = useCreateWidget()
  const updateWidget = useUpdateWidget()
  const deleteWidget = useDeleteWidget()

  const { addFilter, activeFilters, clearFilters } = useDashboardFilters()
  const breakpoint = useBreakpoint()
  const isMobile = breakpoint === 'mobile'
  const isTablet = breakpoint === 'tablet'
  const gridCols = isMobile ? 1 : isTablet ? 2 : 12
  const isDragEnabled = !isMobile
  const isResizeEnabled = !isMobile && !isTablet

  const [showModal, setShowModal] = useState(false)
  const [showCopilot, setShowCopilot] = useState(false)
  const [showSlicer, setShowSlicer] = useState(false)
  const [editWidget, setEditWidget] = useState<DashboardWidget | null>(null)
  const { push: pushHistory, undo: undoHistory, redo: redoHistory, canUndo, canRedo } = useDashboardBuilderStore()

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoHistory()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redoHistory()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undoHistory, redoHistory])
  const [form, setForm] = useState<WidgetForm>(emptyForm)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dashName, setDashName] = useState('')
  const [nameInitialized, setNameInitialized] = useState(false)

  if (dashboard && !nameInitialized) {
    setDashName(dashboard.name)
    setNameInitialized(true)
  }

  const widgetList = useMemo(() => widgets || [], [widgets])

  // Convert widgets to react-grid-layout format
  const layout: Layout[] = useMemo(() =>
    widgetList.map((w, i) => {
      if (isMobile) {
        return { i: w.id, x: 0, y: i * 4, w: 1, h: 4, minW: 1, minH: 2 }
      }
      if (isTablet) {
        return { i: w.id, x: (i % 2), y: Math.floor(i / 2) * 4, w: 1, h: 4, minW: 1, minH: 2 }
      }
      return {
        i: w.id,
        x: (w as unknown as Record<string, number>).position_x ?? (i % 3) * 4,
        y: (w as unknown as Record<string, number>).position_y ?? Math.floor(i / 3) * 4,
        w: (w.width || 1) * 4,
        h: (w.height || 1) * 3,
        minW: 2,
        minH: 2,
      }
    }),
  [widgetList, isMobile, isTablet])

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    // Persist layout changes for each widget
    let changed = false
    newLayout.forEach(l => {
      const widget = widgetList.find(w => w.id === l.i)
      if (!widget) return

      const oldX = (widget as unknown as Record<string, number>).position_x ?? 0
      const oldY = (widget as unknown as Record<string, number>).position_y ?? 0
      const oldW = widget.width || 1
      const oldH = widget.height || 1

      if (l.x !== oldX || l.y !== oldY || Math.ceil(l.w / 4) !== oldW || Math.ceil(l.h / 3) !== oldH) {
        changed = true
        updateWidget.mutate({
          id: widget.id,
          title: widget.title,
          widget_type: widget.widget_type,
          position_x: l.x,
          position_y: l.y,
          width: Math.max(1, Math.ceil(l.w / 4)),
          height: Math.max(1, Math.ceil(l.h / 3)),
        })
      }
    })
    // Push to undo/redo history when layout actually changed
    if (changed) {
      pushHistory(newLayout.map(l => ({ id: l.i, x: l.x, y: l.y, w: l.w, h: l.h })))
    }
  }, [widgetList, updateWidget, pushHistory])

  // Drill-through handler — clicking a chart data point
  const handleDataClick = useCallback((widgetId: string, dataSource: string) => (params: { name: string; value: unknown }) => {
    // Add cross-filter
    addFilter({
      sourceWidgetId: widgetId,
      dimension: params.name,
      value: String(params.value),
      operator: 'eq',
    })

    // Offer drill-through if route exists
    const route = DRILL_THROUGH_ROUTES[dataSource]
    if (route) {
      toast('info', `Click again to drill through to ${route}`)
    }
  }, [addFilter])

  const openCreate = () => {
    setEditWidget(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (w: DashboardWidget) => {
    setEditWidget(w)
    setForm({
      title: w.title,
      widget_type: w.widget_type,
      chart_type: w.chart_type || 'bar',
      data_source: w.data_source || '',
      config: JSON.stringify(w.config || {}),
      drill_through_route: '',
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast('error', 'Widget title is required'); return }

    let parsedConfig = {}
    try { parsedConfig = JSON.parse(form.config) } catch { toast('error', 'Invalid JSON config'); return }

    const payload = {
      dashboard_id: id!,
      title: form.title,
      widget_type: form.widget_type as 'chart' | 'kpi' | 'table' | 'gauge' | 'map' | 'text',
      chart_type: form.widget_type === 'chart' ? form.chart_type : undefined,
      data_source: form.data_source || '',
      position_x: 0,
      position_y: 0,
      width: 1,
      height: 1,
      config: parsedConfig,
    }

    try {
      if (editWidget) {
        await updateWidget.mutateAsync({ id: editWidget.id, ...payload })
        toast('success', 'Widget updated')
      } else {
        await createWidget.mutateAsync(payload)
        toast('success', 'Widget added')
      }
      setShowModal(false)
    } catch {
      toast('error', 'Failed to save widget')
    }
  }

  const handleDeleteWidget = async (wid: string) => {
    if (!confirm('Remove this widget?')) return
    try {
      await deleteWidget.mutateAsync(wid)
      toast('success', 'Widget removed')
      if (selectedId === wid) setSelectedId(null)
    } catch {
      toast('error', 'Failed to remove widget')
    }
  }

  const handleSaveDashboard = async () => {
    if (!dashboard) return
    try {
      await updateDashboard.mutateAsync({ id: dashboard.id, name: dashName })
      toast('success', 'Dashboard saved')
    } catch {
      toast('error', 'Failed to save dashboard')
    }
  }

  if (dashLoading || widgetsLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  if (!dashboard) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400 mb-4">Dashboard not found</p>
        <Button variant="ghost" onClick={() => navigate('/analytics/dashboards')}>Back to Dashboards</Button>
      </div>
    )
  }

  const selected = widgetList.find((w) => w.id === selectedId)

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/analytics/dashboards')}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <input
          className="text-base font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none flex-1 min-w-0"
          value={dashName}
          onChange={(e) => setDashName(e.target.value)}
          onBlur={handleSaveDashboard}
        />

        {/* Filter indicator */}
        {activeFilters.length > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-[#51459d]/10 text-[#51459d] hover:bg-[#51459d]/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {activeFilters.length} filter{activeFilters.length > 1 ? 's' : ''} active
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Undo / Redo */}
        <button
          onClick={() => undoHistory()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={() => redoHistory()}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>

        {/* Bookmarks */}
        {id && <BookmarkPanel dashboardId={id} />}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCopilot(!showCopilot)}
          className={showCopilot ? 'bg-[#51459d]/10 border-[#51459d]' : ''}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Copilot
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSlicer(!showSlicer)}
          className={showSlicer ? 'bg-[#51459d]/10 border-[#51459d]' : ''}
          title="Filters / Slicers"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </Button>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Widget
        </Button>
        <Button size="sm" onClick={handleSaveDashboard} loading={updateDashboard.isPending}>
          Save
        </Button>
      </div>

      {/* Copilot Panel (collapsible) */}
      {showCopilot && (
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <CopilotPanel />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Widget Library Sidebar */}
        <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-800 p-4 overflow-y-auto shrink-0 hidden md:block">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Widget Library</h3>
          <div className="space-y-1.5 mb-6">
            {WIDGET_TYPES.map((wt) => (
              <button
                key={wt.value}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-[#51459d]/30 transition-colors text-left text-xs"
                onClick={() => {
                  setForm({ ...emptyForm, widget_type: wt.value, title: wt.label })
                  setEditWidget(null)
                  setShowModal(true)
                }}
              >
                <span className="text-gray-500 text-[10px]">+</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{wt.label}</span>
              </button>
            ))}
          </div>

          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Widgets ({widgetList.length})
          </h3>
          <div className="space-y-1">
            {widgetList.map((w) => (
              <button
                key={w.id}
                className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors ${
                  selectedId === w.id
                    ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedId(w.id)}
              >
                {w.title}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Canvas — react-grid-layout */}
        <div className="flex-1 p-5 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          {widgetList.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <p className="text-sm text-gray-400 mb-2">No widgets yet</p>
                <p className="text-xs text-gray-300 mb-4">Add widgets from the sidebar or use Copilot to generate a dashboard</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={openCreate}>Add Widget</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCopilot(true)}>Ask Copilot</Button>
                </div>
              </div>
            </div>
          ) : (
            <ReactGridLayout
              className="layout"
              layout={layout}
              cols={gridCols}
              rowHeight={80}
              onLayoutChange={isDragEnabled ? handleLayoutChange : undefined}
              draggableHandle=".drag-handle"
              isDraggable={isDragEnabled}
              isResizable={isResizeEnabled}
              compactType="vertical"
              margin={[12, 12]}
            >
              {widgetList.map((w) => {
                const sampleData = SAMPLE_DATA[w.data_source || ''] || getDefaultSample()
                const chartType = (w.chart_type || w.widget_type || 'bar') as ChartType

                return (
                  <div
                    key={w.id}
                    className={`rounded-xl border-2 transition-all bg-white dark:bg-gray-800 overflow-hidden ${
                      selectedId === w.id
                        ? 'border-[#51459d] shadow-lg'
                        : 'border-gray-200 dark:border-gray-700 hover:border-[#51459d]/30'
                    }`}
                    onClick={() => setSelectedId(w.id)}
                  >
                    {/* Widget header (drag handle) */}
                    <div className={`drag-handle flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 ${isDragEnabled ? 'cursor-move' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="4" cy="4" r="1.5" /><circle cx="12" cy="4" r="1.5" />
                          <circle cx="4" cy="8" r="1.5" /><circle cx="12" cy="8" r="1.5" />
                          <circle cx="4" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" />
                        </svg>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{w.title}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(w) }}
                          className="text-gray-300 hover:text-[#51459d] transition-colors p-0.5"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {DRILL_THROUGH_ROUTES[w.data_source || ''] && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(DRILL_THROUGH_ROUTES[w.data_source || '']) }}
                            className="text-gray-300 hover:text-[#3ec9d6] transition-colors p-0.5"
                            title="Drill through to source"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteWidget(w.id) }}
                          className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Widget body — renders chart */}
                    <div className="p-2 h-[calc(100%-36px)]">
                      {w.widget_type === 'kpi' ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">
                              {sampleData[0] ? String(Object.values(sampleData[0])[1] ?? '0') : '0'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{w.data_source}</p>
                          </div>
                        </div>
                      ) : w.widget_type === 'text' ? (
                        <div className="flex items-center justify-center h-full text-sm text-gray-500 p-4">
                          {(w.config as Record<string, string>)?.text || 'Text widget — edit to add content'}
                        </div>
                      ) : (
                        <ChartRenderer
                          type={chartType}
                          data={sampleData}
                          config={{
                            xKey: Object.keys(sampleData[0] || {})[0],
                            yKeys: Object.keys(sampleData[0] || {}).slice(1),
                            nameKey: Object.keys(sampleData[0] || {})[0],
                            valueKey: Object.keys(sampleData[0] || {})[1],
                            showLegend: false,
                          }}
                          height="100%"
                          responsive
                          onDataClick={handleDataClick(w.id, w.data_source || '')}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </ReactGridLayout>
          )}
        </div>

        {/* Config Panel */}
        {selected && (
          <div className="w-60 bg-white dark:bg-gray-800 border-l border-gray-100 dark:border-gray-800 p-4 overflow-y-auto shrink-0 hidden lg:block">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Widget Properties</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Title</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selected.title}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Type</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{selected.widget_type}</p>
              </div>
              {selected.chart_type && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Chart Type</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{selected.chart_type}</p>
                </div>
              )}
              {selected.data_source && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Data Source</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selected.data_source}</p>
                </div>
              )}

              {/* Drill-through link */}
              {DRILL_THROUGH_ROUTES[selected.data_source || ''] && (
                <button
                  onClick={() => navigate(DRILL_THROUGH_ROUTES[selected.data_source || ''])}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-[#3ec9d6]/10 text-[#3ec9d6] hover:bg-[#3ec9d6]/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Drill through to source
                </button>
              )}

              <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                <Button size="sm" className="w-full" onClick={() => openEdit(selected)}>Edit Widget</Button>
                <Button size="sm" variant="danger" className="w-full" onClick={() => handleDeleteWidget(selected.id)}>Remove</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slicer / Filter Panel */}
      <SlicerPanel open={showSlicer} onClose={() => setShowSlicer(false)} />

      {/* Widget Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editWidget ? 'Edit Widget' : 'Add Widget'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            placeholder="Widget title"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Widget Type"
              options={WIDGET_TYPES}
              value={form.widget_type}
              onChange={(e) => setForm({ ...form, widget_type: e.target.value })}
            />
            {form.widget_type === 'chart' && (
              <Select
                label="Chart Type"
                options={CHART_TYPES}
                value={form.chart_type}
                onChange={(e) => setForm({ ...form, chart_type: e.target.value })}
              />
            )}
          </div>
          <Select
            label="Data Source"
            options={[{ value: '', label: 'Select data source...' }, ...DATA_SOURCES]}
            value={form.data_source}
            onChange={(e) => setForm({ ...form, data_source: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Config (JSON)</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 min-h-[80px] text-gray-900 dark:text-gray-100"
              value={form.config}
              onChange={(e) => setForm({ ...form, config: e.target.value })}
              placeholder="{}"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createWidget.isPending || updateWidget.isPending}>
              {editWidget ? 'Update' : 'Add Widget'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Exported with filter context provider ───────────────────────────────────
export default function DashboardBuilderPage() {
  return (
    <DashboardFilterProvider>
      <DashboardBuilderInner />
    </DashboardFilterProvider>
  )
}
