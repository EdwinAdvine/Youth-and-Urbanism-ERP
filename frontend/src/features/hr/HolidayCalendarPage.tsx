import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useHolidays,
  useCreateHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
  type Holiday,
  type HolidayCreatePayload,
} from '../../api/hr_phase1'

const defaultForm: HolidayCreatePayload = {
  name: '',
  country_code: '',
  holiday_date: '',
  is_recurring: false,
  is_half_day: false,
}

export default function HolidayCalendarPage() {
  const [countryFilter, setCountryFilter] = useState('')
  const [yearFilter, setYearFilter] = useState<number | ''>('')

  const { data: holidays, isLoading } = useHolidays({
    country_code: countryFilter || undefined,
    year: yearFilter || undefined,
  })
  const createHoliday = useCreateHoliday()
  const updateHoliday = useUpdateHoliday()
  const deleteHoliday = useDeleteHoliday()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Holiday | null>(null)
  const [form, setForm] = useState<HolidayCreatePayload>(defaultForm)

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(holiday: Holiday) {
    setEditing(holiday)
    setForm({
      name: holiday.name,
      country_code: holiday.country_code,
      holiday_date: holiday.holiday_date.slice(0, 10),
      is_recurring: holiday.is_recurring,
      is_half_day: holiday.is_half_day,
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      updateHoliday.mutate(
        { holidayId: editing.id, data: form },
        {
          onSuccess: () => { toast('success', 'Holiday updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update holiday'),
        }
      )
    } else {
      createHoliday.mutate(form, {
        onSuccess: () => { toast('success', 'Holiday created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create holiday'),
      })
    }
  }

  function handleDelete(holiday: Holiday) {
    if (!confirm(`Delete holiday "${holiday.name}"?`)) return
    deleteHoliday.mutate(holiday.id, {
      onSuccess: () => toast('success', 'Holiday deleted'),
      onError: () => toast('error', 'Failed to delete holiday'),
    })
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (h: Holiday) => (
        <p className="font-medium text-gray-900 dark:text-gray-100">{h.name}</p>
      ),
    },
    {
      key: 'country_code',
      label: 'Country',
      render: (h: Holiday) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{h.country_code.toUpperCase()}</span>
      ),
    },
    {
      key: 'holiday_date',
      label: 'Date',
      render: (h: Holiday) => new Date(h.holiday_date).toLocaleDateString(),
    },
    {
      key: 'is_recurring',
      label: 'Recurring',
      render: (h: Holiday) => (
        <span className={h.is_recurring ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
          {h.is_recurring ? (
            <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
        </span>
      ),
    },
    {
      key: 'is_half_day',
      label: 'Half Day',
      render: (h: Holiday) => (
        <span className={h.is_half_day ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}>
          {h.is_half_day ? (
            <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (h: Holiday) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(h)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(h)}>Delete</Button>
        </div>
      ),
    },
  ]

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Holiday Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">Manage public holidays by country</p>
        </div>
        <Button onClick={openCreate}>Add Holiday</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Countries' },
            { value: 'US', label: 'United States' },
            { value: 'GB', label: 'United Kingdom' },
            { value: 'KE', label: 'Kenya' },
            { value: 'DE', label: 'Germany' },
            { value: 'IN', label: 'India' },
            { value: 'CA', label: 'Canada' },
            { value: 'AU', label: 'Australia' },
          ]}
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="w-48"
        />
        <Input
          type="number"
          placeholder="Year"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : '')}
          className="w-32"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={(holidays as Holiday[]) ?? []}
          keyExtractor={(h) => h.id}
          emptyText="No holidays found."
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Holiday' : 'Add Holiday'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Select
            label="Country"
            required
            options={[
              { value: '', label: 'Select country...' },
              { value: 'US', label: 'United States' },
              { value: 'GB', label: 'United Kingdom' },
              { value: 'KE', label: 'Kenya' },
              { value: 'DE', label: 'Germany' },
              { value: 'IN', label: 'India' },
              { value: 'CA', label: 'Canada' },
              { value: 'AU', label: 'Australia' },
            ]}
            value={form.country_code}
            onChange={(e) => setForm((p) => ({ ...p, country_code: e.target.value }))}
          />
          <Input
            label="Date"
            type="date"
            required
            value={form.holiday_date}
            onChange={(e) => setForm((p) => ({ ...p, holiday_date: e.target.value }))}
          />
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_recurring ?? false}
                onChange={(e) => setForm((p) => ({ ...p, is_recurring: e.target.checked }))}
                className="rounded border-gray-300"
              />
              Recurring yearly
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_half_day ?? false}
                onChange={(e) => setForm((p) => ({ ...p, is_half_day: e.target.checked }))}
                className="rounded border-gray-300"
              />
              Half day
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createHoliday.isPending || updateHoliday.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
