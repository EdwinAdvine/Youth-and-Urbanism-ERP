import { useState } from 'react'
import {
  useDashboardWidgets,
  useCreateWidget,
  useUpdateWidget,
  useDeleteWidget,
  type DashboardWidget,
  type DashboardWidgetCreatePayload,
} from '@/api/crm_workflows'
import { Button, Card, Spinner, Modal, Input, Select, cn, toast } from '@/components/ui'

const WIDGET_TYPES = [
  { value: 'stat_card', label: 'Stat Card' },
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
  { value: 'funnel', label: 'Funnel' },
  { value: 'leaderboard', label: 'Leaderboard' },
]

const EMPTY_FORM: Omit<DashboardWidgetCreatePayload, 'position_x' | 'position_y' | 'width' | 'height'> = {
  title: '',
  widget_type: 'stat_card',
  config: null,
}

export default function DashboardBuilderPage() {
  const { data, isLoading } = useDashboardWidgets()
  const createWidget = useCreateWidget()
  const updateWidget = useUpdateWidget()
  const deleteWidget = useDeleteWidget()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DashboardWidget | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [configStr, setConfigStr] = useState('{}')
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const widgets: DashboardWidget[] = data?.items ?? data ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setConfigStr('{}')
    setModalOpen(true)
  }

  const openEdit = (w: DashboardWidget) => {
    setEditing(w)
    setForm({
      title: w.title,
      widget_type: w.widget_type,
      config: w.config,
    })
    setConfigStr(w.config ? JSON.stringify(w.config, null, 2) : '{}')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let config: Record<string, any> | null = null
    try {
      config = JSON.parse(configStr)
    } catch {
      toast('error', 'Invalid JSON in config')
      return
    }
    try {
      if (editing) {
        await updateWidget.mutateAsync({
          id: editing.id,
          title: form.title,
          widget_type: form.widget_type,
          config,
        })
        toast('success', 'Widget updated')
      } else {
        const col = widgets.length % 3
        const row = Math.floor(widgets.length / 3)
        await createWidget.mutateAsync({
          title: form.title,
          widget_type: form.widget_type,
          config,
          position_x: col * 4,
          position_y: row,
          width: 4,
          height: 2,
        })
        toast('success', 'Widget created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save widget')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this widget?')) return
    try {
      await deleteWidget.mutateAsync(id)
      toast('success', 'Widget deleted')
    } catch {
      toast('error', 'Failed to delete widget')
    }
  }

  const handleDragStart = (e: React.MouseEvent, widgetId: string) => {
    setDragging(widgetId)
    const el = (e.target as HTMLElement).closest('[data-widget-id]') as HTMLElement
    if (el) {
      const rect = el.getBoundingClientRect()
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  const handleDragEnd = async (e: React.MouseEvent) => {
    if (!dragging) return
    const container = document.getElementById('dashboard-grid')
    if (!container) {
      setDragging(null)
      return
    }
    const rect = container.getBoundingClientRect()
    const colWidth = rect.width / 12
    const rowHeight = 120
    const newX = Math.max(0, Math.min(11, Math.round((e.clientX - rect.left - dragOffset.x) / colWidth)))
    const newY = Math.max(0, Math.round((e.clientY - rect.top - dragOffset.y) / rowHeight))

    try {
      await updateWidget.mutateAsync({ id: dragging, position_x: newX, position_y: newY })
    } catch {
      // silently ignore position save failures
    }
    setDragging(null)
  }

  // ─── Widget Renderers ────────────────────────────────────────────────────────

  const renderWidgetContent = (w: DashboardWidget) => {
    const cfg = w.config ?? {}
    switch (w.widget_type) {
      case 'stat_card':
        return (
          <div className="text-center py-4">
            <p className="text-3xl font-bold" style={{ color: '#51459d' }}>
              {cfg.value ?? '0'}
            </p>
            <p className="text-sm text-gray-500 mt-1">{cfg.label ?? w.title}</p>
          </div>
        )
      case 'chart':
        return (
          <div className="flex items-center justify-center h-full min-h-[80px]">
            <div className="text-center text-gray-400">
              <svg className="h-8 w-8 mx-auto mb-1 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4" />
              </svg>
              <span className="text-xs">Chart: {cfg.chart_type ?? 'bar'}</span>
            </div>
          </div>
        )
      case 'table':
        return (
          <div className="flex items-center justify-center h-full min-h-[80px]">
            <div className="text-center text-gray-400">
              <svg className="h-8 w-8 mx-auto mb-1 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">Table Widget</span>
            </div>
          </div>
        )
      case 'funnel':
        return (
          <div className="flex items-center justify-center h-full min-h-[80px]">
            <div className="text-center text-gray-400">
              <div className="mx-auto mb-1 space-y-0.5">
                {[100, 75, 50, 30].map((w, i) => (
                  <div
                    key={i}
                    className="h-3 rounded-sm mx-auto"
                    style={{ width: `${w}%`, backgroundColor: '#51459d', opacity: 1 - i * 0.2 }}
                  />
                ))}
              </div>
              <span className="text-xs">Funnel Widget</span>
            </div>
          </div>
        )
      case 'leaderboard':
        return (
          <div className="flex items-center justify-center h-full min-h-[80px]">
            <div className="text-center text-gray-400">
              <svg className="h-8 w-8 mx-auto mb-1 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs">Leaderboard Widget</span>
            </div>
          </div>
        )
      default:
        return <div className="text-center text-gray-400 text-sm py-4">Unknown widget type</div>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard Builder
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Drag and configure widgets to build your CRM dashboard
          </p>
        </div>
        <Button onClick={openCreate}>+ Add Widget</Button>
      </div>

      {/* Dashboard Grid */}
      {widgets.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-gray-400 mb-4">No widgets yet. Add your first dashboard widget.</p>
          <Button onClick={openCreate}>+ Add Widget</Button>
        </Card>
      ) : (
        <div
          id="dashboard-grid"
          className="grid grid-cols-12 gap-4 min-h-[400px]"
          onMouseUp={handleDragEnd}
          onMouseLeave={() => setDragging(null)}
        >
          {widgets.map((w) => {
            const colSpan = Math.min(12, Math.max(2, w.width ?? 4))
            return (
              <div
                key={w.id}
                data-widget-id={w.id}
                className={cn(
                  'group relative',
                  dragging === w.id && 'opacity-60',
                )}
                style={{ gridColumn: `span ${colSpan}` }}
              >
                <Card className="h-full relative overflow-hidden">
                  {/* Drag handle + actions (visible on hover) */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onMouseDown={(e) => handleDragStart(e, w.id)}
                      className="p-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 cursor-grab"
                      title="Drag to reposition"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openEdit(w)}
                      className="p-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-primary"
                      title="Edit"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="p-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-red-500"
                      title="Delete"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Widget title */}
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    {w.title}
                  </div>

                  {/* Widget content */}
                  {renderWidgetContent(w)}
                </Card>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Widget' : 'Add Widget'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Total Revenue"
          />
          <Select
            label="Widget Type"
            required
            value={form.widget_type}
            onChange={(e) => setForm((f) => ({ ...f, widget_type: e.target.value }))}
            options={WIDGET_TYPES}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Config (JSON)
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={5}
              value={configStr}
              onChange={(e) => setConfigStr(e.target.value)}
              placeholder='{"value": "1234", "label": "Total Deals"}'
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createWidget.isPending || updateWidget.isPending}>
              {editing ? 'Save Changes' : 'Add Widget'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
