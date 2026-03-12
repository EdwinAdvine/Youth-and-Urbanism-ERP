import { useState } from 'react'
import {
  Card,
  Button,
  Badge,
  Input,
  Modal,
} from '@/components/ui'
import {
  useAnalyticsDashboards,
  useAnalyticsDashboard,
  useCreateDashboard,
  useUpdateDashboard,
  useDeleteDashboard,
  useAddWidget,
  useRemoveWidget,
  useHeadcountCost,
  useDEIOverview,
  type AnalyticsDashboard,
  type HeadcountCost,
} from '@/api/hr_phase3'

type WidgetType = 'headcount' | 'attrition' | 'compensation' | 'diversity' | 'performance' | 'burnout'

// ─── Widget Type Config ────────────────────────────────────────────────────────

const WIDGET_TYPES: { value: WidgetType; label: string; description: string }[] = [
  { value: 'headcount', label: 'Headcount', description: 'Total employees by department' },
  { value: 'attrition', label: 'Attrition', description: 'Turnover rate and trend' },
  { value: 'compensation', label: 'Compensation', description: 'Band compliance distribution' },
  { value: 'diversity', label: 'Diversity', description: 'Gender distribution overview' },
  { value: 'performance', label: 'Performance', description: 'Rating distribution chart' },
  { value: 'burnout', label: 'Burnout Risk', description: 'Employee risk level breakdown' },
]

const WIDGET_TYPE_COLORS: Record<WidgetType, string> = {
  headcount: 'primary',
  attrition: 'danger',
  compensation: 'success',
  diversity: 'info',
  performance: 'warning',
  burnout: 'default',
}

// ─── Widget Visualizations ────────────────────────────────────────────────────

function HeadcountWidget() {
  const { data, isLoading } = useHeadcountCost()
  if (isLoading) return <SkeletonWidget />
  const rawDepts: HeadcountCost[] = Array.isArray(data) ? data : []
  const maxCount = Math.max(...rawDepts.map((d) => d.headcount), 1)
  return (
    <div className="space-y-2">
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {rawDepts.reduce((sum, d) => sum + d.headcount, 0)}
      </p>
      <p className="text-xs text-gray-500 mb-3">Total headcount</p>
      <div className="space-y-1.5">
        {rawDepts.slice(0, 5).map((d) => (
          <div key={d.department} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20 truncate">{d.department}</span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full"
                style={{ width: `${(d.headcount / maxCount) * 100}%`, backgroundColor: '#51459d' }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-6 text-right">{d.headcount}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AttritionWidget() {
  return (
    <div className="space-y-2">
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">8.4%</p>
      <p className="text-xs text-gray-500 mb-3">Annual attrition rate</p>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-danger">▲ 1.2%</span>
        <span className="text-xs text-gray-500">vs last quarter</span>
      </div>
      <div className="mt-2 space-y-1">
        {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => {
          const val = [6.1, 7.2, 8.4, 8.4][i]
          return (
            <div key={q} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4">{q}</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: `${(val / 10) * 100}%`, backgroundColor: '#ff3a6e' }} />
              </div>
              <span className="text-xs text-gray-500">{val}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompensationWidget() {
  const bands = [
    { label: 'Above Band', pct: 18, color: '#ff3a6e' },
    { label: 'Within Band', pct: 65, color: '#6fd943' },
    { label: 'Below Band', pct: 17, color: '#ffa21d' },
  ]
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Band compliance</p>
      {bands.map(b => (
        <div key={b.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">{b.label}</span>
            <span className="font-medium">{b.pct}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
            <div className="h-2.5 rounded-full" style={{ width: `${b.pct}%`, backgroundColor: b.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DiversityWidget() {
  const { data, isLoading } = useDEIOverview()
  if (isLoading) return <SkeletonWidget />

  const genderDist = data?.gender_distribution
  const distribution: { gender: string; count: number; percentage?: number }[] = genderDist
    ? Object.entries(genderDist).map(([gender, count]) => ({ gender, count: count as number }))
    : [
      { gender: 'male', count: 55, percentage: 55 },
      { gender: 'female', count: 38, percentage: 38 },
      { gender: 'other', count: 5, percentage: 5 },
      { gender: 'not_specified', count: 2, percentage: 2 },
    ]

  const colorMap: Record<string, string> = {
    male: '#51459d',
    female: '#3ec9d6',
    other: '#ffa21d',
    not_specified: '#aaa',
  }
  const total = distribution.reduce((s, d) => s + d.count, 0)

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-2">Gender distribution ({total} employees)</p>
      <div className="flex flex-wrap gap-1.5">
        {distribution.map(d => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
          return (
            <div
              key={d.gender}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ backgroundColor: colorMap[d.gender] + '22' }}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorMap[d.gender] }} />
              <span className="text-xs capitalize text-gray-700 dark:text-gray-300">
                {d.gender.replace('_', ' ')}: {d.count} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PerformanceWidget() {
  const dist = [
    { label: 'Exceptional', pct: 12, color: '#6fd943' },
    { label: 'Exceeds', pct: 28, color: '#3ec9d6' },
    { label: 'Meets', pct: 42, color: '#51459d' },
    { label: 'Below', pct: 13, color: '#ffa21d' },
    { label: 'Needs Improvement', pct: 5, color: '#ff3a6e' },
  ]
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-2">Performance distribution</p>
      {dist.map(d => (
        <div key={d.label}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-gray-600 dark:text-gray-400 truncate">{d.label}</span>
            <span className="font-medium ml-2">{d.pct}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div className="h-2 rounded-full" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function BurnoutWidget() {
  const levels = [
    { label: 'Low', pct: 54, color: '#6fd943' },
    { label: 'Moderate', pct: 28, color: '#ffa21d' },
    { label: 'High', pct: 13, color: '#ff7043' },
    { label: 'Severe', pct: 5, color: '#ff3a6e' },
  ]
  const total = 100
  let offset = 0
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Burnout risk levels</p>
      <div className="relative w-24 h-24 mx-auto">
        <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
          {levels.map(l => {
            const pct = (l.pct / total) * 100
            const dasharray = `${pct} ${100 - pct}`
            const dashoffset = -offset
            offset += pct
            return (
              <circle
                key={l.label}
                cx="18" cy="18" r="15.9155"
                fill="transparent"
                stroke={l.color}
                strokeWidth="3.5"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Risk</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {levels.map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{l.label}: {l.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WidgetContent({ type }: { type: WidgetType }) {
  switch (type) {
    case 'headcount': return <HeadcountWidget />
    case 'attrition': return <AttritionWidget />
    case 'compensation': return <CompensationWidget />
    case 'diversity': return <DiversityWidget />
    case 'performance': return <PerformanceWidget />
    case 'burnout': return <BurnoutWidget />
  }
}

function SkeletonWidget() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="space-y-1.5 mt-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full" />
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CustomDashboardBuilder() {
  const { data: dashboards, isLoading: loadingList } = useAnalyticsDashboards()
  const [activeDashboardId, setActiveDashboardId] = useState<string>('')

  const dashboardList = Array.isArray(dashboards)
    ? dashboards
    : (dashboards as { items?: AnalyticsDashboard[] })?.items ?? []

  const activeDashboard = dashboardList.find(d => d.id === activeDashboardId) ?? dashboardList[0]
  const { data: dashboardDetail, isLoading: loadingDetail } = useAnalyticsDashboard(activeDashboard?.id ?? '')

  const createDashboard = useCreateDashboard()
  const updateDashboard = useUpdateDashboard()
  const deleteDashboard = useDeleteDashboard()
  const addWidget = useAddWidget()
  const removeWidget = useRemoveWidget()

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddWidget, setShowAddWidget] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [openWidgetMenu, setOpenWidgetMenu] = useState<string | null>(null)

  // Forms
  const [dashboardForm, setDashboardForm] = useState({ name: '', description: '', is_shared: false })
  const [widgetForm, setWidgetForm] = useState<{ widget_type: WidgetType; title: string }>({
    widget_type: 'headcount',
    title: '',
  })

  const detail = (dashboardDetail ?? activeDashboard) as AnalyticsDashboard & {
    layout?: Array<{ id: string; type: string; title: string; config: Record<string, unknown>; position: Record<string, number> }>
    widget_count?: number
  }

  const widgets = detail?.layout ?? []

  function openCreate() {
    setDashboardForm({ name: '', description: '', is_shared: false })
    setShowCreateModal(true)
  }

  function openEdit() {
    if (!detail) return
    setDashboardForm({
      name: detail.name,
      description: detail.description ?? '',
      is_shared: detail.is_shared,
    })
    setShowEditModal(true)
  }

  async function handleCreate() {
    if (!dashboardForm.name.trim()) return
    const res = await createDashboard.mutateAsync({
      name: dashboardForm.name,
      description: dashboardForm.description || undefined,
      is_shared: dashboardForm.is_shared,
    })
    setActiveDashboardId(res.id)
    setShowCreateModal(false)
  }

  async function handleUpdate() {
    if (!detail) return
    await updateDashboard.mutateAsync({
      id: detail.id,
      name: dashboardForm.name,
      description: dashboardForm.description || undefined,
      is_shared: dashboardForm.is_shared,
    })
    setShowEditModal(false)
  }

  async function handleDelete() {
    if (!detail) return
    await deleteDashboard.mutateAsync(detail.id)
    setShowDeleteConfirm(false)
    setActiveDashboardId('')
  }

  async function handleAddWidget() {
    if (!detail || !widgetForm.title.trim()) return
    await addWidget.mutateAsync({
      dashboardId: detail.id,
      widget: { widget_type: widgetForm.widget_type, title: widgetForm.title },
    })
    setShowAddWidget(false)
    setWidgetForm({ widget_type: 'headcount', title: '' })
  }

  async function handleRemoveWidget(widgetId: string) {
    if (!detail) return
    await removeWidget.mutateAsync({ dashboardId: detail.id, widgetId })
    setOpenWidgetMenu(null)
  }

  async function handleShareToggle() {
    if (!detail) return
    await updateDashboard.mutateAsync({
      id: detail.id,
      is_shared: !detail.is_shared,
    })
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Left Sidebar ── */}
      <aside className="w-64 shrink-0 border-r border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">People Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Your custom dashboards</p>
        </div>

        <div className="p-3">
          <Button
            size="sm"
            className="w-full"
            onClick={openCreate}
            loading={createDashboard.isPending}
          >
            + New Dashboard
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loadingList ? (
            <div className="space-y-2 p-2 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700 rounded-lg" />
              ))}
            </div>
          ) : dashboardList.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">
              No dashboards yet. Create your first one above.
            </p>
          ) : (
            dashboardList.map(d => (
              <button
                key={d.id}
                onClick={() => setActiveDashboardId(d.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors group relative ${
                  (activeDashboard?.id === d.id)
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{d.name}</span>
                  {d.is_shared && (
                    <span className="text-xs text-gray-400 ml-1" title="Shared">
                      <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </span>
                  )}
                </div>
                {d.is_shared && (
                  <Badge variant="info" className="mt-1 text-xs">Shared</Badge>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Area ── */}
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
        {!detail ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Dashboard Selected</h3>
              <p className="text-sm text-gray-500 mb-4">Create a new dashboard or select one from the sidebar.</p>
              <Button onClick={openCreate}>Create Dashboard</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Dashboard Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{detail.name}</h2>
                {detail.is_shared && <Badge variant="info">Shared</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareToggle}
                  loading={updateDashboard.isPending}
                >
                  {detail.is_shared ? 'Unshare' : 'Share Dashboard'}
                </Button>
                <Button variant="ghost" size="sm" onClick={openEdit}>Edit</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete
                </Button>
                <Button size="sm" onClick={() => setShowAddWidget(true)}>
                  + Add Widget
                </Button>
              </div>
            </div>

            {/* Widget Grid */}
            {loadingDetail ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-56 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700" />
                ))}
              </div>
            ) : widgets.length === 0 ? (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm mb-3">This dashboard has no widgets yet.</p>
                  <Button size="sm" onClick={() => setShowAddWidget(true)}>Add Your First Widget</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {widgets.map((w) => {
                  const wType = (w.type ?? 'headcount') as WidgetType
                  return (
                    <Card key={w.id} className="relative">
                      {/* Widget Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{w.title}</h3>
                          <Badge
                            variant={WIDGET_TYPE_COLORS[wType] as 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'}
                            className="mt-1"
                          >
                            {WIDGET_TYPES.find(t => t.value === wType)?.label ?? wType}
                          </Badge>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setOpenWidgetMenu(openWidgetMenu === w.id ? null : w.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </button>
                          {openWidgetMenu === w.id && (
                            <div className="absolute right-0 top-8 z-20 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                              <button
                                onClick={() => setOpenWidgetMenu(null)}
                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                Edit Config
                              </button>
                              <button
                                onClick={() => handleRemoveWidget(w.id)}
                                className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Widget Content */}
                      <WidgetContent type={wType} />
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Create Dashboard Modal ── */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Dashboard" size="md">
        <div className="space-y-4">
          <Input
            label="Dashboard Name"
            placeholder="e.g. Q1 People Overview"
            value={dashboardForm.name}
            onChange={e => setDashboardForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={3}
              placeholder="Optional description"
              value={dashboardForm.description}
              onChange={e => setDashboardForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dashboardForm.is_shared}
              onChange={e => setDashboardForm(f => ({ ...f, is_shared: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Share with team</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createDashboard.isPending}>Create Dashboard</Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Dashboard Modal ── */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Dashboard" size="md">
        <div className="space-y-4">
          <Input
            label="Dashboard Name"
            value={dashboardForm.name}
            onChange={e => setDashboardForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={3}
              value={dashboardForm.description}
              onChange={e => setDashboardForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dashboardForm.is_shared}
              onChange={e => setDashboardForm(f => ({ ...f, is_shared: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Share with team</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdate} loading={updateDashboard.isPending}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Widget Modal ── */}
      <Modal open={showAddWidget} onClose={() => setShowAddWidget(false)} title="Add Widget" size="lg">
        <div className="space-y-5">
          <Input
            label="Widget Title"
            placeholder="e.g. Department Headcount"
            value={widgetForm.title}
            onChange={e => setWidgetForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Widget Type</label>
            <div className="grid grid-cols-2 gap-2">
              {WIDGET_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setWidgetForm(f => ({ ...f, widget_type: t.value }))}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${
                    widgetForm.widget_type === t.value
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAddWidget(false)}>Cancel</Button>
            <Button onClick={handleAddWidget} loading={addWidget.isPending}>Add Widget</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Dashboard" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete <strong>{detail?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteDashboard.isPending}>Delete</Button>
        </div>
      </Modal>

      {/* Close widget menu on outside click */}
      {openWidgetMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenWidgetMenu(null)} />
      )}
    </div>
  )
}
