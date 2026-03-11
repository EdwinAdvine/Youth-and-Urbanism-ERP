import { useState, useMemo } from 'react'
import {
  useContentCalendar,
  useCreateCalendarItem,
  useUpdateCalendarItem,
  useDeleteCalendarItem,
  type ContentCalendarItem,
  type CalendarItemCreatePayload,
} from '../../api/crm_marketing'
import { Button, Badge, Card, Spinner, Modal, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'

const CONTENT_TYPES = ['blog', 'social', 'email', 'video', 'webinar'] as const
const STATUSES = ['idea', 'draft', 'scheduled', 'published'] as const

const contentTypeColor: Record<string, string> = {
  blog: '#51459d',
  social: '#3ec9d6',
  email: '#ffa21d',
  video: '#ff3a6e',
  webinar: '#6fd943',
}

const statusVariant: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  idea: 'default',
  draft: 'info',
  scheduled: 'warning',
  published: 'success',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const defaultForm: CalendarItemCreatePayload = {
  title: '',
  content_type: 'blog',
  scheduled_date: '',
  status: 'idea',
  description: '',
  campaign_id: '',
  assigned_to: '',
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const days: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= totalDays; d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function ContentCalendarPage() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: items, isLoading } = useContentCalendar({
    content_type: typeFilter || undefined,
    status: statusFilter || undefined,
  })
  const createItem = useCreateCalendarItem()
  const updateItem = useUpdateCalendarItem()
  const deleteItem = useDeleteCalendarItem()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ContentCalendarItem | null>(null)
  const [form, setForm] = useState<CalendarItemCreatePayload>(defaultForm)

  // Group items by date
  const itemsByDate = useMemo(() => {
    const map: Record<string, ContentCalendarItem[]> = {}
    ;(items ?? []).forEach((item: ContentCalendarItem) => {
      const key = item.scheduled_date?.slice(0, 10) ?? ''
      if (!map[key]) map[key] = []
      map[key].push(item)
    })
    return map
  }, [items])

  const weeks = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])
  const monthLabel = new Date(viewYear, viewMonth).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  })

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  function openCreateForDate(day: number) {
    setEditing(null)
    setForm({
      ...defaultForm,
      scheduled_date: dateKey(viewYear, viewMonth, day),
    })
    setShowModal(true)
  }

  function openEdit(item: ContentCalendarItem) {
    setEditing(item)
    setForm({
      title: item.title,
      content_type: item.content_type,
      scheduled_date: item.scheduled_date?.slice(0, 10) ?? '',
      status: item.status,
      description: item.description ?? '',
      campaign_id: item.campaign_id ?? '',
      assigned_to: item.assigned_to ?? '',
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      campaign_id: form.campaign_id || null,
      assigned_to: form.assigned_to || null,
    }

    if (editing) {
      updateItem.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast('success', 'Calendar item updated')
            setShowModal(false)
          },
          onError: () => toast('error', 'Failed to update item'),
        }
      )
    } else {
      createItem.mutate(payload, {
        onSuccess: () => {
          toast('success', 'Calendar item created')
          setShowModal(false)
        },
        onError: () => toast('error', 'Failed to create item'),
      })
    }
  }

  function handleDelete() {
    if (!editing) return
    if (!window.confirm('Delete this calendar item?')) return
    deleteItem.mutate(editing.id, {
      onSuccess: () => {
        toast('success', 'Item deleted')
        setShowModal(false)
      },
      onError: () => toast('error', 'Failed to delete item'),
    })
  }

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate())

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Content Calendar
          </h1>
          <p className="text-sm text-gray-500 mt-1">Plan and schedule marketing content</p>
        </div>
      </div>

      {/* ── Filters + Month Nav ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3">
          <Select
            options={[
              { value: '', label: 'All Types' },
              ...CONTENT_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
            ]}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-40"
          />
          <Select
            options={[
              { value: '', label: 'All Statuses' },
              ...STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={prevMonth}>
            &larr;
          </Button>
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-[180px] text-center">
            {monthLabel}
          </span>
          <Button variant="ghost" size="sm" onClick={nextMonth}>
            &rarr;
          </Button>
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex gap-4 flex-wrap">
        {CONTENT_TYPES.map((t) => (
          <div key={t} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: contentTypeColor[t] }}
            />
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {/* ── Calendar Grid ────────────────────────────────────────────────── */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {WEEKDAYS.map((d) => (
                  <th
                    key={d}
                    className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center border-b border-gray-200 dark:border-gray-700"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((day, di) => {
                    if (day === null) {
                      return (
                        <td
                          key={di}
                          className="border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30"
                          style={{ height: 100 }}
                        />
                      )
                    }
                    const key = dateKey(viewYear, viewMonth, day)
                    const dayItems = itemsByDate[key] ?? []
                    const isToday = key === todayKey

                    return (
                      <td
                        key={di}
                        className="border border-gray-100 dark:border-gray-800 align-top p-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                        style={{ height: 100, minWidth: 120 }}
                        onClick={() => openCreateForDate(day)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                              isToday ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                            }`}
                            style={isToday ? { backgroundColor: '#51459d' } : undefined}
                          >
                            {day}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {dayItems.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className="text-[10px] leading-tight px-1.5 py-0.5 rounded truncate text-white font-medium cursor-pointer"
                              style={{
                                backgroundColor: contentTypeColor[item.content_type] ?? '#51459d',
                                borderRadius: 6,
                              }}
                              title={`${item.title} (${item.status})`}
                              onClick={(e) => {
                                e.stopPropagation()
                                openEdit(item)
                              }}
                            >
                              {item.title}
                            </div>
                          ))}
                          {dayItems.length > 3 && (
                            <p className="text-[10px] text-gray-400 px-1">
                              +{dayItems.length - 3} more
                            </p>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Calendar Item' : 'New Calendar Item'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Content Type"
              options={CONTENT_TYPES.map((t) => ({
                value: t,
                label: t.charAt(0).toUpperCase() + t.slice(1),
              }))}
              value={form.content_type}
              onChange={(e) => setForm((p) => ({ ...p, content_type: e.target.value }))}
            />
            <Select
              label="Status"
              options={STATUSES.map((s) => ({
                value: s,
                label: s.charAt(0).toUpperCase() + s.slice(1),
              }))}
              value={form.status ?? 'idea'}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            />
          </div>

          <Input
            label="Scheduled Date"
            type="date"
            required
            value={form.scheduled_date}
            onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Campaign ID (optional)"
              placeholder="Link to a campaign"
              value={form.campaign_id ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, campaign_id: e.target.value }))}
            />
            <Input
              label="Assigned To (optional)"
              placeholder="User ID"
              value={form.assigned_to ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
            />
          </div>

          {editing && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Badge variant={statusVariant[editing.status] ?? 'default'}>{editing.status}</Badge>
              <span>Created: {new Date(editing.created_at).toLocaleDateString()}</span>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <div>
              {editing && (
                <Button
                  variant="ghost"
                  type="button"
                  className="text-danger"
                  onClick={handleDelete}
                  loading={deleteItem.isPending}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createItem.isPending || updateItem.isPending}>
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
