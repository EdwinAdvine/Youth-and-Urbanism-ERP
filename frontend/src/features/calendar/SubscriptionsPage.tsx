import { useState } from 'react'
import { Card, Button, Modal, Input, Table, Badge, toast } from '../../components/ui'
import {
  useCalendarSubscriptions,
  useCreateSubscription,
  useDeleteSubscription,
  type CalendarSubscription,
} from '../../api/calendar_ext'

export default function SubscriptionsPage() {
  const { data: subs, isLoading } = useCalendarSubscriptions()
  const createSub = useCreateSubscription()
  const deleteSub = useDeleteSubscription()

  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState('#51459d')

  const handleCreate = () => {
    if (!name.trim() || !url.trim()) return toast('error', 'Name and URL are required')
    createSub.mutate(
      { name, url, color },
      {
        onSuccess: () => {
          toast('success', 'Subscription added')
          setShowModal(false)
          setName('')
          setUrl('')
          setColor('#51459d')
        },
        onError: () => toast('error', 'Failed to add subscription'),
      }
    )
  }

  const handleDelete = (sub: CalendarSubscription) => {
    if (!confirm(`Remove subscription "${sub.name}"?`)) return
    deleteSub.mutate(sub.id, {
      onSuccess: () => toast('success', 'Subscription removed'),
      onError: () => toast('error', 'Failed to remove subscription'),
    })
  }

  const columns = [
    {
      key: 'color',
      label: '',
      className: 'w-8',
      render: (sub: CalendarSubscription) => (
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: sub.color ?? '#51459d' }} />
      ),
    },
    { key: 'name', label: 'Name', render: (sub: CalendarSubscription) => <span className="font-medium text-gray-700">{sub.name}</span> },
    {
      key: 'url',
      label: 'URL',
      render: (sub: CalendarSubscription) => (
        <span className="text-xs text-gray-400 truncate block max-w-[300px]" title={sub.url}>{sub.url}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (sub: CalendarSubscription) => (
        <Badge variant={sub.is_active ? 'success' : 'default'}>{sub.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'last_synced',
      label: 'Last Synced',
      render: (sub: CalendarSubscription) => (
        <span className="text-sm text-gray-500">
          {sub.last_synced ? new Date(sub.last_synced).toLocaleString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (sub: CalendarSubscription) => (
        <Button size="sm" variant="ghost" onClick={() => handleDelete(sub)}>
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-1">Subscribe to external calendars via iCal URLs</p>
        </div>
        <Button onClick={() => setShowModal(true)}>Add Subscription</Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={subs ?? []}
          loading={isLoading}
          emptyText="No calendar subscriptions. Add one to import external events."
          keyExtractor={(s) => s.id}
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Calendar Subscription">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Holidays" />
          <Input label="iCal URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
              <span className="text-sm text-gray-500">{color}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createSub.isPending}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
