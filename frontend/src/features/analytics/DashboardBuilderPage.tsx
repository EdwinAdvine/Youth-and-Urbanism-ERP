import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, Select, Modal, Spinner, toast } from '../../components/ui'
import {
  useDashboard, useUpdateDashboard, useDashboardWidgets,
  useCreateWidget, useUpdateWidget, useDeleteWidget,
  type DashboardWidget,
} from '../../api/analytics_ext'

type WidgetForm = {
  title: string
  widget_type: string
  chart_type: string
  data_source: string
  position_x: number
  position_y: number
  width: number
  height: number
  config: string
}

const emptyForm: WidgetForm = {
  title: '', widget_type: 'chart', chart_type: 'bar',
  data_source: '', position_x: 0, position_y: 0,
  width: 1, height: 1, config: '{}',
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
]

const WIDTH_OPTIONS = [
  { value: '1', label: '1 Column' },
  { value: '2', label: '2 Columns' },
  { value: '3', label: '3 Columns (Full)' },
]

const HEIGHT_OPTIONS = [
  { value: '1', label: '1 Row' },
  { value: '2', label: '2 Rows' },
]

const WIDGET_ICONS: Record<string, JSX.Element> = {
  chart: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  kpi: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  ),
  table: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  gauge: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  text: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7" />
    </svg>
  ),
}

export default function DashboardBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: dashboard, isLoading: dashLoading } = useDashboard(id || '')
  const { data: widgets, isLoading: widgetsLoading } = useDashboardWidgets(id || '')
  const updateDashboard = useUpdateDashboard()
  const createWidget = useCreateWidget()
  const updateWidget = useUpdateWidget()
  const deleteWidget = useDeleteWidget()

  const [showModal, setShowModal] = useState(false)
  const [editWidget, setEditWidget] = useState<DashboardWidget | null>(null)
  const [form, setForm] = useState<WidgetForm>(emptyForm)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dashName, setDashName] = useState('')
  const [nameInitialized, setNameInitialized] = useState(false)

  if (dashboard && !nameInitialized) {
    setDashName(dashboard.name)
    setNameInitialized(true)
  }

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
      position_x: w.position_x,
      position_y: w.position_y,
      width: w.width,
      height: w.height,
      config: JSON.stringify(w.config || {}),
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
      position_x: form.position_x,
      position_y: form.position_y,
      width: form.width,
      height: form.height,
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

  const widgetList = widgets || []
  const selected = widgetList.find((w) => w.id === selectedId)

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center gap-4 shrink-0">
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

      <div className="flex-1 flex overflow-hidden">
        {/* Widget Library Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-800 p-4 overflow-y-auto shrink-0">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Widget Library</h3>
          <div className="space-y-2 mb-6">
            {WIDGET_TYPES.map((wt) => (
              <button
                key={wt.value}
                className="w-full flex items-center gap-3 p-2.5 rounded-[8px] border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-primary/30 transition-colors text-left"
                onClick={() => {
                  setForm({ ...emptyForm, widget_type: wt.value, title: wt.label })
                  setEditWidget(null)
                  setShowModal(true)
                }}
              >
                <span className="text-gray-500">{WIDGET_ICONS[wt.value]}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{wt.label}</span>
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
                className={`w-full text-left text-xs px-2.5 py-2 rounded-[8px] transition-colors ${ selectedId === w.id ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800' }`}
                onClick={() => setSelectedId(w.id)}
              >
                {w.title}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Canvas */}
        <div className="flex-1 p-5 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          {widgetList.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <p className="text-sm text-gray-400 mb-2">No widgets yet</p>
                <p className="text-xs text-gray-300 mb-4">Add widgets from the sidebar or library</p>
                <Button size="sm" onClick={openCreate}>Add Your First Widget</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 auto-rows-[160px]">
              {widgetList.map((w) => (
                <div
                  key={w.id}
                  className={`rounded-[10px] border-2 transition-all cursor-pointer ${ selectedId === w.id ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-200 bg-white dark:bg-gray-800 hover:border-primary/30' }`}
                  style={{
                    gridColumn: `span ${Math.min(w.width || 1, 3)}`,
                    gridRow: `span ${Math.min(w.height || 1, 2)}`,
                  }}
                  onClick={() => setSelectedId(w.id)}
                >
                  <div className="p-4 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">{WIDGET_ICONS[w.widget_type] || WIDGET_ICONS.text}</span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{w.title}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(w) }}
                          className="text-gray-300 hover:text-primary transition-colors p-0.5"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
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
                    <div className="flex-1 bg-gray-50 dark:bg-gray-950 rounded-[8px] border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-xs text-gray-400 block">{w.widget_type}{w.chart_type ? ` - ${w.chart_type}` : ''}</span>
                        {w.data_source && <span className="text-[10px] text-gray-300 block mt-0.5">{w.data_source}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Config Panel */}
        {selected && (
          <div className="w-64 bg-white dark:bg-gray-800 border-l border-gray-100 dark:border-gray-800 p-4 overflow-y-auto shrink-0">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Widget Properties</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Title</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selected.title}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Type</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selected.widget_type}</p>
              </div>
              {selected.chart_type && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Chart Type</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selected.chart_type}</p>
                </div>
              )}
              {selected.data_source && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Data Source</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selected.data_source}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Width</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selected.width} col</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Height</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selected.height} row</p>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                <Button size="sm" className="w-full" onClick={() => openEdit(selected)}>Edit Widget</Button>
                <Button size="sm" variant="danger" className="w-full" onClick={() => handleDeleteWidget(selected.id)}>Remove</Button>
              </div>
            </div>
          </div>
        )}
      </div>

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
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Width"
              options={WIDTH_OPTIONS}
              value={String(form.width)}
              onChange={(e) => setForm({ ...form, width: Number(e.target.value) })}
            />
            <Select
              label="Height"
              options={HEIGHT_OPTIONS}
              value={String(form.height)}
              onChange={(e) => setForm({ ...form, height: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Config (JSON)</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px]"
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
